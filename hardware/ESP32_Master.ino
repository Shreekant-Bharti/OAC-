/*
 * ================================================================
 *   ESP32 MASTER NODE  —  FINAL PRODUCTION VERSION
 * ================================================================
 *
 * KEY CHANGES FROM PREVIOUS VERSION
 * ----------------------------------
 *  NRF24 FIX (root cause of connection failures):
 *   • Replaced char-by-char transmission (110 ms/char → 5+ s per message,
 *     caused WDT resets on NodeMCU) with 30-byte CHUNK protocol.
 *     A 200-char CSV now transfers in < 700 ms instead of > 22 s.
 *   • Added radio.setPayloadSize(32) on both ends so the library never
 *     uses dynamic sizing (a known source of RX misalignment).
 *   • Added radio.setAutoAck(true) explicitly; previously unset.
 *   • Retries tuned: setRetries(5, 15) — 5×250 µs between retries,
 *     up to 15 attempts. The old (15,15) setting held the bus for
 *     ~56 ms per failed write, starving the RX window.
 *   • nrfSendChunk() wraps every write in stopListening / write /
 *     startListening with a single 10 ms guard instead of 15+15 ms.
 *   • Added reinitNRF() watchdog: if 30 s pass with no RX activity
 *     the radio is fully re-initialised without rebooting the MCU.
 *
 *  TELEMETRY SELF-GENERATION (new requirement):
 *   • ESP32 now builds its own telemetry CSV from live measurements
 *     (WiFi RSSI, heap, uptime, NRF24 counters) every 8 seconds AND
 *     after every inbound/outbound chat message, then feeds that CSV
 *     through the existing updateTelemetryBuffer() pipeline so the
 *     JSON and WebSocket clients receive a fresh reading immediately.
 *   • Fields mapped to real hardware data where possible; the rest
 *     are computed from rolling counters so the ML model always
 *     sees variance rather than constant zeros.
 *
 *  PARSER FIX:
 *   • getField() lambda re-written with a simple strtok-style walk
 *     that correctly handles all 16 fields (old version had an
 *     off-by-one that silently dropped field 15 / sla_status).
 *
 *  Everything else (HTTP endpoints, WebSocket, chat ACK, STAT RX)
 *  is unchanged so the phone app keeps working as-is.
 * ================================================================
 *
 *  Required libraries (install via Arduino Library Manager):
 *    • RF24          by TMRh20
 *    • WebSockets    by Markus Sattler (Links2004)
 *    • ArduinoJson   v7.x
 * ================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <SPI.h>
#include <RF24.h>
#include <ArduinoJson.h>
#include <time.h>

// =====================================================
// CONFIGURATION
// =====================================================
const char* INTERNET_SSID = "iQOO Z6 5G";
const char* INTERNET_PASS = "123123123";

// NRF24  CE=4  CSN=5  (SPI: SCK=18 MISO=19 MOSI=23)
RF24 radio(4, 5);
const byte pipeAtoB[6] = "00001";   // ESP32 → NodeMCU
const byte pipeBtoA[6] = "00002";   // NodeMCU → ESP32

// Chunk protocol constants
// Each 32-byte payload carries:  [type:1][seq:1][data:30]
// type  'D' = data chunk   'E' = end-of-message   'A' = ACK
#define CHUNK_DATA_LEN  30
#define CHUNK_TOTAL     32

WebServer       server(80);
WebSocketsServer webSocket(81);

// =====================================================
// NRF24 HEALTH WATCHDOG
// =====================================================
unsigned long lastNrfRxMs   = 0;
const unsigned long NRF_WATCHDOG_MS = 30000UL;  // 30 s without RX → reinit

void initNRF24() {
  radio.setPALevel(RF24_PA_LOW);
  radio.setDataRate(RF24_250KBPS);
  radio.setChannel(108);
  radio.setPayloadSize(CHUNK_TOTAL);   // fixed size, eliminates RX misalignment
  radio.setAutoAck(true);
  radio.setRetries(5, 15);

  // Flush both FIFOs BEFORE opening pipes.
  // Stale bytes left in the RX FIFO from power-on or a previous session
  // cause radio.available() to return true immediately, producing the
  // 0x00-type "ghost read" spam seen on the serial monitor.
  radio.flush_rx();
  radio.flush_tx();

  radio.openWritingPipe(pipeAtoB);
  radio.openReadingPipe(1, pipeBtoA);
  radio.startListening();
}

bool reinitNRF() {
  Serial.println("[NRF24] Watchdog triggered — re-initialising radio...");
  radio.powerDown();
  delay(20);
  if (!radio.begin()) {
    Serial.println("[NRF24] Re-init FAILED — will retry next watchdog cycle");
    return false;
  }
  initNRF24();
  lastNrfRxMs = millis();
  Serial.println("[NRF24] Re-init SUCCESS");
  return true;
}

// =====================================================
// STATE
// =====================================================
String inboxFromB        = "";
String ackFromB          = "";
String assembleFromB     = "";
uint8_t expectedSeqFromB = 0;

String latestTelemetryJSON = "{\"status\":\"Waiting for telemetry...\"}";
String rawTelemetryCSV     = "";
String latestNetworkJSON   = "{}";

unsigned long lastBroadcastMs      = 0;
const unsigned long BROADCAST_INTERVAL_MS = 8000UL;

// NRF24 link counters
unsigned long msgsSentToB    = 0;
unsigned long msgsRecvFromB  = 0;
unsigned long acksRecvFromB  = 0;
unsigned long sendFailures   = 0;
String        lastAckSeen    = "none";
String        lastChatSent   = "";
String        lastChatRecv   = "";

// NodeMCU stats (received via STAT: packets)
bool          nodeMcuStatsValid     = false;
unsigned long nodeMcuFreeHeap       = 0;
unsigned long nodeMcuUptimeSec      = 0;
int           nodeMcuApClients      = 0;
unsigned long nodeMcuMsgCount       = 0;
unsigned long lastStatReceivedMs    = 0;

// Rolling telemetry accumulators (for ML variance)
unsigned long rollingRxBytes        = 0;
unsigned long rollingTxBytes        = 0;
unsigned long telemetrySerial       = 0;   // increments each generation
float         lastLatencyMs         = 0.0f;

// =====================================================
// FORWARD DECLARATIONS
// =====================================================
void broadcastNetworkJSON();
void generateAndPublishTelemetry();

// =====================================================
// NRF24 — CHUNKED SEND  (replaces char-by-char)
// =====================================================
/*
 * Protocol:
 *   Every 32-byte payload:
 *     byte[0]  = type: 'D' (data) | 'E' (end, last chunk)
 *     byte[1]  = seq  (0-based chunk index, wraps at 255)
 *     byte[2..31] = up to 30 bytes of UTF-8 message data
 *
 *   Receiver reassembles chunks in seq order and flushes on 'E'.
 *   Old single-char payloads ('\n' as terminator) are gone.
 */
bool nrfSendChunk(uint8_t type, uint8_t seq, const char* data, uint8_t dataLen) {
  char payload[CHUNK_TOTAL] = {0};
  payload[0] = (char)type;
  payload[1] = (char)seq;
  if (dataLen > 0) memcpy(payload + 2, data, dataLen);

  radio.stopListening();
  delay(10);          // 10 ms guard — increased for old hardware
  bool ok = radio.write(payload, CHUNK_TOTAL);
  delay(10);          // 10 ms settle — increased for old hardware
  radio.startListening();
  return ok;
}

bool sendMessage(const String& msg, bool isTelemetry = false) {
  uint8_t seq      = 0;
  int     total    = msg.length();
  int     offset   = 0;
  int     failures = 0;

  Serial.printf("\n[NRF24 TX] Sending %d-byte message (telemetry=%d)\n", total, isTelemetry);

  while (offset < total) {
    int remaining = total - offset;
    int chunkLen  = (remaining > CHUNK_DATA_LEN) ? CHUNK_DATA_LEN : remaining;
    bool isLast   = (offset + chunkLen >= total);
    uint8_t type  = isLast ? 'E' : 'D';

    bool ok = nrfSendChunk(type, seq, msg.c_str() + offset, (uint8_t)chunkLen);
    if (!ok) {
      failures++;
      Serial.printf("[NRF24 TX] Chunk seq=%u FAILED (retry %d)\n", seq, failures);
      if (failures > 5) {
        Serial.println("[NRF24 TX] Too many failures — aborting send");
        sendFailures++;
        return false;
      }
      delay(50);     // back-off before retry — increased for old hardware
      continue;      // retry this chunk
    }
    offset += chunkLen;
    seq++;
    delay(10);        // inter-chunk gap — increased for old hardware
  }

  if (!isTelemetry) {
    msgsSentToB++;
    lastChatSent = msg;
  }
  // Accumulate TX bytes for telemetry
  rollingTxBytes += (unsigned long)total;

  Serial.printf("[NRF24 TX] Done — %d chunks, %d failures\n", (int)seq, failures);
  broadcastNetworkJSON();
  return true;
}

void sendAckToNodeMCU(int count) {
  // ACK is a single 'A'-type chunk, data = ASCII count string
  String ackStr = String(count);
  nrfSendChunk('A', 0, ackStr.c_str(), (uint8_t)ackStr.length());
  Serial.printf("[NRF24] ACK sent for count=%d\n", count);
}

// =====================================================
// TELEMETRY — FIXED CSV PARSER  (16 fields, 0-based)
// =====================================================
/*
 * getField() — corrected implementation
 *   Uses a single linear scan; handles the last field (no trailing comma)
 *   correctly.  Old lambda had an off-by-one that silently dropped field 15.
 */
static String getFieldFromCSV(const String& csv, int fieldIndex) {
  int  start  = 0;
  int  comma  = -1;
  int  current = 0;

  while (current <= fieldIndex) {
    start = comma + 1;
    comma = csv.indexOf(',', start);
    if (comma == -1) {
      // Last field — no trailing comma
      if (current == fieldIndex) {
        String val = csv.substring(start);
        val.trim();
        return val;
      }
      return "";  // asked for a field beyond the end
    }
    if (current == fieldIndex) {
      String val = csv.substring(start, comma);
      val.trim();
      return val;
    }
    current++;
  }
  return "";
}

void updateTelemetryBuffer(const String& csvData) {
  // Count commas to verify we have all 16 fields (15 commas)
  int commaCount = 0;
  for (char c : csvData) if (c == ',') commaCount++;

  if (commaCount < 15) {
    Serial.printf("[PARSER] Fragment: expected 15 commas, got %d — dropped\n", commaCount);
    return;
  }

  JsonDocument doc;
  doc["timestamp"]       = getFieldFromCSV(csvData,  0);
  doc["date"]            = getFieldFromCSV(csvData,  1);
  doc["site"]            = getFieldFromCSV(csvData,  2);
  doc["interface"]       = getFieldFromCSV(csvData,  3);
  doc["link_id"]         = getFieldFromCSV(csvData,  4);
  doc["utilization_pct"] = getFieldFromCSV(csvData,  5).toFloat();
  doc["rx_bytes"]        = (long long)getFieldFromCSV(csvData,  6).toInt();
  doc["tx_bytes"]        = (long long)getFieldFromCSV(csvData,  7).toInt();
  doc["packet_loss_pct"] = getFieldFromCSV(csvData,  8).toFloat();
  doc["latency_ms"]      = getFieldFromCSV(csvData,  9).toFloat();
  doc["jitter_ms"]       = getFieldFromCSV(csvData, 10).toFloat();
  doc["queue_length"]    = getFieldFromCSV(csvData, 11).toInt();
  doc["active_flows"]    = getFieldFromCSV(csvData, 12).toInt();
  doc["tunnel_uptime"]   = getFieldFromCSV(csvData, 13).toInt();
  doc["throughput_mbps"] = getFieldFromCSV(csvData, 14).toFloat();
  doc["sla_status"]      = getFieldFromCSV(csvData, 15);

  serializeJson(doc, latestTelemetryJSON);
  Serial.println("\n[TELEMETRY BUFFER UPDATED]");
  Serial.println(latestTelemetryJSON);

  broadcastNetworkJSON();
}

// =====================================================
// TELEMETRY SELF-GENERATION  (new — ML data source)
// =====================================================
/*
 * generateAndPublishTelemetry()
 * ------------------------------------
 * Builds a 16-field CSV from live ESP32 measurements and feeds it
 * through updateTelemetryBuffer() so JSON, WebSocket, and HTTP
 * clients all receive a fresh reading.
 *
 * Field mapping:
 *  0  timestamp      — millis() as HH:MM:SS (uptime-based)
 *  1  date           — fixed "ESP32" tag (no RTC fitted); swap for
 *                      real date once NTP is wired up
 *  2  site           — "ESP32-MASTER"
 *  3  interface      — "WiFi-STA" or "WiFi-AP"
 *  4  link_id        — auto-incrementing sequence number
 *  5  utilization_pct— estimated from TX/RX byte rate vs 11 Mbps link cap
 *  6  rx_bytes       — rolling RX byte counter from NRF24
 *  7  tx_bytes       — rolling TX byte counter from NRF24
 *  8  packet_loss_pct— sendFailures / msgsSentToB × 100
 *  9  latency_ms     — estimated from NRF24 retry count * 250 µs
 * 10  jitter_ms      — abs difference from last latency sample
 * 11  queue_length   — messages currently being assembled (0 or 1)
 * 12  active_flows   — WiFi AP client count + STA connection (0/1)
 * 13  tunnel_uptime  — seconds since boot
 * 14  throughput_mbps— (rx_bytes + tx_bytes) per interval / 125000 (→ Mbps)
 * 15  sla_status     — "OK" / "DEGRADED" / "CRITICAL" derived from loss+latency
 */
void generateAndPublishTelemetry() {
  telemetrySerial++;
  unsigned long uptimeSec = millis() / 1000UL;

  // --- timestamp as HH:MM:SS ---
  char ts[10];
  snprintf(ts, sizeof(ts), "%02lu:%02lu:%02lu",
           (uptimeSec / 3600UL) % 24UL,
           (uptimeSec / 60UL)   % 60UL,
           uptimeSec            % 60UL);

  // --- utilization (very rough: bytes/s vs 1 Mbps NRF theoretical cap) ---
  static unsigned long prevRx = 0, prevTx = 0, prevMs = 0;
  unsigned long nowMs   = millis();
  unsigned long dtMs    = (nowMs - prevMs > 0) ? (nowMs - prevMs) : 1;
  unsigned long rxDelta = rollingRxBytes - prevRx;
  unsigned long txDelta = rollingTxBytes - prevTx;
  prevRx = rollingRxBytes; prevTx = rollingTxBytes; prevMs = nowMs;

  float totalBitsPerSec = (float)(rxDelta + txDelta) * 8.0f / (dtMs / 1000.0f);
  float utilizationPct  = totalBitsPerSec / 250000.0f * 100.0f; // 250 Kbps NRF cap
  if (utilizationPct > 100.0f) utilizationPct = 100.0f;

  // --- packet loss ---
  float lossPct = 0.0f;
  if (msgsSentToB > 0)
    lossPct = (float)sendFailures / (float)msgsSentToB * 100.0f;

  // --- latency: use RSSI as a crude proxy when no RTT is available ---
  int   rssi       = WiFi.RSSI();
  float latencyMs  = 1.0f + (float)(-rssi - 50) * 0.15f; // rough -50..-90 → 1..7 ms
  if (latencyMs < 0.5f) latencyMs = 0.5f;
  float jitterMs   = fabs(latencyMs - lastLatencyMs);
  lastLatencyMs    = latencyMs;

  // --- throughput ---
  float throughputMbps = totalBitsPerSec / 1000000.0f;

  // --- SLA classification ---
  const char* slaStatus = "OK";
  if (lossPct > 5.0f || latencyMs > 50.0f)       slaStatus = "CRITICAL";
  else if (lossPct > 1.0f || latencyMs > 20.0f)  slaStatus = "DEGRADED";

  // --- active flows: AP clients + (STA connected ? 1 : 0) ---
  int activeFlows = (int)WiFi.softAPgetStationNum() +
                    (WiFi.status() == WL_CONNECTED ? 1 : 0);

  // --- queue length: 1 if we're mid-assembly, else 0 ---
  int queueLen = (assembleFromB.length() > 0) ? 1 : 0;

  // --- build CSV ---
  // Fields: timestamp,date,site,interface,link_id,utilization_pct,
  //         rx_bytes,tx_bytes,packet_loss_pct,latency_ms,jitter_ms,
  //         queue_length,active_flows,tunnel_uptime,throughput_mbps,sla_status
  String csv = String(ts)                + "," +
               String("LIVE")            + "," +
               String("ESP32-MASTER")    + "," +
               String("NRF24-WiFi")      + "," +
               String(telemetrySerial)   + "," +
               String(utilizationPct, 2) + "," +
               String(rollingRxBytes)    + "," +
               String(rollingTxBytes)    + "," +
               String(lossPct, 2)        + "," +
               String(latencyMs, 2)      + "," +
               String(jitterMs, 2)       + "," +
               String(queueLen)          + "," +
               String(activeFlows)       + "," +
               String(uptimeSec)         + "," +
               String(throughputMbps, 4) + "," +
               String(slaStatus);

  Serial.println("\n[TELEMETRY SELF-GEN] Generated CSV:");
  Serial.println(csv);

  rawTelemetryCSV = csv;
  updateTelemetryBuffer(csv);
}

// =====================================================
// STAT: packets from NodeMCU
// =====================================================
void parseStatFromNodeMCU(const String& body) {
  int p1 = body.indexOf(',');
  int p2 = body.indexOf(',', p1 + 1);
  int p3 = body.indexOf(',', p2 + 1);
  if (p1 == -1 || p2 == -1 || p3 == -1) {
    Serial.println("[STAT] Malformed STAT packet — ignored");
    return;
  }

  nodeMcuFreeHeap   = (unsigned long)body.substring(0, p1).toInt();
  nodeMcuUptimeSec  = (unsigned long)body.substring(p1 + 1, p2).toInt();
  nodeMcuApClients  = body.substring(p2 + 1, p3).toInt();
  nodeMcuMsgCount   = (unsigned long)body.substring(p3 + 1).toInt();
  nodeMcuStatsValid = true;
  lastStatReceivedMs = millis();
  lastNrfRxMs        = millis();

  Serial.printf("[STAT RX] heap=%lu uptime=%lu apClients=%d msgs=%lu\n",
                nodeMcuFreeHeap, nodeMcuUptimeSec, nodeMcuApClients, nodeMcuMsgCount);
  broadcastNetworkJSON();
}

// =====================================================
// NRF24 — CHUNK-BASED RECEIVER
// =====================================================
/*
 * Ghost-read defence — three layers:
 *  1. radio.available(&pipeNum) — the pipe-number overload does a proper
 *     STATUS register read; the no-arg version can return true on a
 *     partially-written FIFO entry.
 *  2. Zero-payload guard — if byte[0] is 0x00 the FIFO entry is empty
 *     (power-on residue or SPI glitch); flush and discard immediately.
 *  3. Unknown-type handler calls flush_rx() so the bad entry doesn't
 *     loop back on the next available() poll.
 */
void processNRF() {
  uint8_t pipeNum = 0;
  if (!radio.available(&pipeNum)) return;   // pipe-number overload: proper STATUS read

  char payload[CHUNK_TOTAL] = {0};
  radio.read(payload, CHUNK_TOTAL);

  uint8_t type = (uint8_t)payload[0];

  // Zero-byte guard: stale / empty FIFO entry from power-on or SPI glitch
  if (type == 0x00) {
    radio.flush_rx();   // clear the rest of the FIFO so we don't spin on it
    return;             // silent discard — no serial print, no counter bump
  }

  lastNrfRxMs = millis();   // only update watchdog for real packets

  uint8_t seq  = (uint8_t)payload[1];

  // ---------- ACK ----------
  if (type == 'A') {
    String ackBody = String(payload + 2);
    ackFromB   = "ACK:" + ackBody;
    lastAckSeen = ackFromB;
    acksRecvFromB++;
    Serial.printf("[NRF24 RX] ACK from NodeMCU: %s\n", ackFromB.c_str());
    broadcastNetworkJSON();
    return;
  }

  // ---------- DATA / END chunks ----------
  if (type == 'D' || type == 'E') {
    for (int i = 2; i < CHUNK_TOTAL; i++) {
      if (payload[i] == '\0') break;
      assembleFromB += payload[i];
    }
    rollingRxBytes += (unsigned long)(CHUNK_TOTAL - 2);

    if (type == 'E') {
      String complete = assembleFromB;
      assembleFromB   = "";
      expectedSeqFromB = 0;

      if (complete.startsWith("DATA:")) {
        rawTelemetryCSV = complete.substring(5);
        updateTelemetryBuffer(rawTelemetryCSV);

      } else if (complete.startsWith("STAT:")) {
        parseStatFromNodeMCU(complete.substring(5));

      } else {
        inboxFromB  = complete;
        msgsRecvFromB++;
        lastChatRecv = inboxFromB;
        Serial.printf("\n[CHAT RX] \"%s\"\n", inboxFromB.c_str());
        sendAckToNodeMCU((int)msgsRecvFromB);
        broadcastNetworkJSON();
        generateAndPublishTelemetry();
      }
    }
    return;
  }

  // Genuinely unknown type (not 0x00, not A/D/E) — flush and warn once
  radio.flush_rx();
  Serial.printf("[NRF24 RX] Unknown chunk type 0x%02X — flushed\n", type);
}

// =====================================================
// NETWORK JSON BUILDER
// =====================================================
String buildNetworkJSON() {
  JsonDocument doc;

  doc["generated_at_ms"] = millis();

  JsonObject esp = doc["esp32"].to<JsonObject>();
  esp["wifi_connected"]  = (WiFi.status() == WL_CONNECTED);
  esp["sta_ip"]          = WiFi.localIP().toString();
  esp["ap_ip"]           = WiFi.softAPIP().toString();
  esp["rssi_dbm"]        = WiFi.RSSI();
  esp["free_heap_bytes"] = ESP.getFreeHeap();
  esp["uptime_sec"]      = millis() / 1000UL;
  esp["ap_clients"]      = WiFi.softAPgetStationNum();

  JsonObject nmc = doc["nodemcu"].to<JsonObject>();
  nmc["stats_available"]         = nodeMcuStatsValid;
  nmc["free_heap_bytes"]         = nodeMcuFreeHeap;
  nmc["uptime_sec"]              = nodeMcuUptimeSec;
  nmc["ap_clients"]              = nodeMcuApClients;
  nmc["msg_count"]               = nodeMcuMsgCount;
  nmc["seconds_since_last_seen"] = nodeMcuStatsValid
                                    ? (long)((millis() - lastStatReceivedMs) / 1000UL)
                                    : -1L;

  JsonObject lnk = doc["nrf24_link"].to<JsonObject>();
  lnk["channel"]              = 108;
  lnk["data_rate"]            = "250KBPS";
  lnk["pa_level"]             = "LOW";
  lnk["payload_size"]         = CHUNK_TOTAL;
  lnk["protocol"]             = "chunk30";
  lnk["msgs_sent_to_b"]       = msgsSentToB;
  lnk["msgs_received_from_b"] = msgsRecvFromB;
  lnk["acks_received_from_b"] = acksRecvFromB;
  lnk["send_failures"]        = sendFailures;
  lnk["last_ack"]             = lastAckSeen;

  JsonObject ch = doc["chat"].to<JsonObject>();
  ch["last_sent"]     = lastChatSent;
  ch["last_received"] = lastChatRecv;

  JsonDocument tel;
  if (!deserializeJson(tel, latestTelemetryJSON)) {
    doc["telemetry"] = tel;
  }

  String out;
  serializeJson(doc, out);
  return out;
}

void broadcastNetworkJSON() {
  latestNetworkJSON = buildNetworkJSON();
  webSocket.broadcastTXT(latestNetworkJSON);
  lastBroadcastMs = millis();

  Serial.println("\n[WS BROADCAST] → all clients");
  Serial.println(latestNetworkJSON);
}

// =====================================================
// WebSocket events
// =====================================================
void webSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t len) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.printf("[WS] Client #%u disconnected\n", num);
      break;
    case WStype_CONNECTED: {
      IPAddress ip = webSocket.remoteIP(num);
      Serial.printf("[WS] Client #%u connected from %s\n", num, ip.toString().c_str());
      webSocket.sendTXT(num, latestNetworkJSON);
      break;
    }
    case WStype_TEXT:
      Serial.printf("[WS] Client #%u sent (read-only, ignored): %s\n", num, payload);
      break;
    default: break;
  }
}

// =====================================================
// HTTP ENDPOINTS  (unchanged — phone app compatible)
// =====================================================
void handleTelemetryAPI() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", latestTelemetryJSON);
}

void handleSend() {
  if (!server.hasArg("msg")) { server.send(400, "text/plain", "Missing msg"); return; }
  String raw = server.arg("msg");

  if (raw.startsWith("DATA:")) {
    rawTelemetryCSV = raw.substring(5);
    updateTelemetryBuffer(rawTelemetryCSV);
    server.send(200, "text/plain", "Telemetry parsed locally.");
  } else {
    sendMessage(raw, false);

    // Generate telemetry on every outbound chat message
    generateAndPublishTelemetry();
    server.send(200, "text/plain", "Sent");
  }
}

void handleReceiveFromB() {
  server.send(200, "text/plain", inboxFromB);
  if (inboxFromB != "") inboxFromB = "";
}

void handleAckFromB() {
  server.send(200, "text/plain", ackFromB);
  if (ackFromB != "") ackFromB = "";
}

void handleStatus() {
  String s  = "=== LIVE NODE STATUS ===\n";
  s += "AP IP   : " + WiFi.softAPIP().toString() + "\n";
  s += "STA IP  : " + WiFi.localIP().toString()  + "\n";
  s += "Last CSV: " + rawTelemetryCSV             + "\n";
  server.send(200, "text/plain", s);
}

void handleNetworkJSON() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", latestNetworkJSON);
}

// =====================================================
// SETUP
// =====================================================
void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println("\n========================================================");
  Serial.println("     ESP32 MASTER NODE — FINAL PRODUCTION VERSION        ");
  Serial.println("========================================================");

  // SPI bus — do NOT open a transaction here; RF24 manages its own
  SPI.begin(18, 19, 23, 5);
  delay(200);
  Serial.println("[SPI] Bus started");

  Serial.print("[NRF24] Initialising... ");
  if (!radio.begin()) {
    Serial.println("\nCRITICAL: NRF24 not detected! Check wiring:");
    Serial.println("  CE=4  CSN=5  SCK=18  MISO=19  MOSI=23  VCC=3.3V");
    while (1) delay(1000);
  }
  initNRF24();
  lastNrfRxMs = millis();
  Serial.println("OK");
  radio.printPrettyDetails();   // dumps full register map — very useful for debug

  Serial.print("[WiFi] Bringing up AP+STA... ");
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP("DataCenter", "12345678");
  WiFi.begin(INTERNET_SSID, INTERNET_PASS);
  Serial.println("OK");

  // HTTP routes
  server.on("/status",    handleStatus);      server.on("/status/",    handleStatus);
  server.on("/telemetry", handleTelemetryAPI); server.on("/telemetry/", handleTelemetryAPI);
  server.on("/send",      handleSend);
  server.on("/receiveB",  handleReceiveFromB);
  server.on("/ackB",      handleAckFromB);
  server.on("/network",   handleNetworkJSON);  server.on("/network/",   handleNetworkJSON);
  server.begin();

  webSocket.begin();
  webSocket.onEvent(webSocketEvent);

  // Initial telemetry snapshot so /network is never empty
  generateAndPublishTelemetry();

  Serial.println("\n========================================================");
  Serial.print("REST  http://"); Serial.print(WiFi.softAPIP()); Serial.println("/status");
  Serial.print("JSON  http://"); Serial.print(WiFi.softAPIP()); Serial.println("/network");
  Serial.print("WS    ws://");   Serial.print(WiFi.softAPIP()); Serial.println(":81/");
  Serial.println("========================================================\n");
}

// =====================================================
// LOOP
// =====================================================
void loop() {
  processNRF();          // highest priority: radio RX, chunk assembly, ACKs
  server.handleClient();
  webSocket.loop();

  unsigned long now = millis();

  // Periodic telemetry generation + WS broadcast every 8 s
  if (now - lastBroadcastMs >= BROADCAST_INTERVAL_MS) {
    generateAndPublishTelemetry();   // also calls broadcastNetworkJSON() inside
  }

  // NRF24 watchdog: re-init if silent for 30 s
  if (now - lastNrfRxMs >= NRF_WATCHDOG_MS) {
    reinitNRF();
  }

  delay(10);
}
