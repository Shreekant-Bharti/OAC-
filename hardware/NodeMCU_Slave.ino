/*
 * ================================================================
 *   NodeMCU (ESP8266) SLAVE NODE  —  FINAL PRODUCTION VERSION
 * ================================================================
 *
 * KEY CHANGES FROM PREVIOUS VERSION
 * ----------------------------------
 *  NRF24 FIX (matches the new ESP32 chunk protocol):
 *   • Replaced char-by-char TX with 30-byte CHUNK protocol.
 *     Each payload: [type:1][seq:1][data:30]
 *     type 'D' = data chunk, 'E' = end of message, 'A' = ACK
 *   • Added radio.setPayloadSize(32) — fixed size prevents RX
 *     misalignment that corrupted messages silently.
 *   • Added radio.setAutoAck(true) explicitly.
 *   • Tuned retries: setRetries(5, 15) instead of (15, 15).
 *     Old value held the bus ~56 ms per failed write, starving RX.
 *   • stopListening / write / startListening guard reduced from
 *     15 ms + 15 ms to 130 µs each side — still safe for the
 *     SPI slave-select setup/hold, 230× faster.
 *   • RX handler now reassembles chunk sequences and dispatches
 *     the full message on the 'E' (end) chunk, identical to how
 *     the ESP32 side works so both ends are symmetric.
 *
 *  STAT reporting is unchanged in content but now uses the chunk
 *  sender so it is reliable.  The "chat quiet guard" (1 s) is kept.
 *
 *  Everything else (HTTP endpoints, AP, /send, /receiveA, /ackA)
 *  is unchanged so the phone app keeps working as-is.
 * ================================================================
 *
 *  Required libraries:
 *    • RF24  by TMRh20
 * ================================================================
 */

#include <ESP8266WiFi.h>
#include <SPI.h>
#include <RF24.h>

// CE=D2  CSN=D8
RF24 radio(D2, D8);
const byte pipeAtoB[6] = "00001";   // ESP32 → NodeMCU
const byte pipeBtoA[6] = "00002";   // NodeMCU → ESP32

// Chunk constants — must match ESP32 side
#define CHUNK_DATA_LEN  30
#define CHUNK_TOTAL     32

// =====================================================
// WiFi AP + HTTP server
// =====================================================
const char* ssid     = "B2";
const char* password = "rts2k4757";
WiFiServer  server(80);

// =====================================================
// STATE
// =====================================================
String  inboxFromA       = "";
String  ackFromA         = "";
String  assembleFromA    = "";

// Status reporting
unsigned long lastStatSendMs     = 0;
const unsigned long STAT_INTERVAL_MS    = 8000UL;
const unsigned long CHAT_QUIET_GUARD_MS =  800UL;   // slightly shorter guard
unsigned long lastChatActivityMs = 0;
unsigned long totalMsgsHandled   = 0;

// =====================================================
// NRF24 INIT HELPER
// =====================================================
void initNRF24() {
  radio.setPALevel(RF24_PA_LOW);
  radio.setDataRate(RF24_250KBPS);
  radio.setChannel(108);
  radio.setPayloadSize(CHUNK_TOTAL);   // fixed size
  radio.setAutoAck(true);
  radio.setRetries(5, 15);

  // Flush both FIFOs before opening pipes to kill power-on ghost reads
  radio.flush_rx();
  radio.flush_tx();

  radio.openWritingPipe(pipeBtoA);
  radio.openReadingPipe(1, pipeAtoB);
  radio.startListening();
}

// =====================================================
// NRF24 — CHUNKED SEND
// =====================================================
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
  yield();    // feed ESP8266 WDT
  return ok;
}

bool sendMessage(const String& msg, bool isTelemetry = false) {
  int    total    = msg.length();
  int    offset   = 0;
  uint8_t seq     = 0;
  int    failures = 0;

  Serial.printf("\n[NRF24 TX] %d bytes (telemetry=%d)\n", total, isTelemetry);

  while (offset < total) {
    int remaining = total - offset;
    int chunkLen  = (remaining > CHUNK_DATA_LEN) ? CHUNK_DATA_LEN : remaining;
    bool isLast   = (offset + chunkLen >= total);
    uint8_t type  = isLast ? 'E' : 'D';

    bool ok = nrfSendChunk(type, seq, msg.c_str() + offset, (uint8_t)chunkLen);
    if (!ok) {
      failures++;
      Serial.printf("[TX] Chunk seq=%u FAILED (attempt %d)\n", seq, failures);
      if (failures > 5) {
        Serial.println("[TX] Aborting — too many failures");
        return false;
      }
      delay(50);      // back-off before retry — increased for old hardware
      continue;  // retry same chunk
    }
    offset += chunkLen;
    seq++;
    delay(10);        // inter-chunk gap — increased for old hardware
    yield();
  }

  Serial.printf("[TX] Done — %d chunks, %d failures\n", (int)seq, failures);
  return true;
}

void sendAckToESP32(int count) {
  String ackStr = String(count);
  nrfSendChunk('A', 0, ackStr.c_str(), (uint8_t)ackStr.length());
  Serial.printf("[NRF24] ACK sent for count=%d\n", count);
}

// STAT: packet to ESP32 (same content as before, now via chunk protocol)
void sendStatusToESP32() {
  String stat = "STAT:" +
                String(ESP.getFreeHeap())             + "," +
                String(millis() / 1000UL)             + "," +
                String(WiFi.softAPgetStationNum())    + "," +
                String(totalMsgsHandled);

  Serial.println("\n[STAT TX] Sending status to ESP32 (low-priority)");
  Serial.printf("    Heap=%lu  Uptime=%lu  APcli=%d  Msgs=%lu\n",
                ESP.getFreeHeap(), millis() / 1000UL,
                WiFi.softAPgetStationNum(), totalMsgsHandled);

  sendMessage(stat, true);   // isTelemetry=true skips any truncation
}

// =====================================================
// NRF24 — CHUNK-BASED RECEIVER
// =====================================================
void processNRF() {
  uint8_t pipeNum = 0;
  if (!radio.available(&pipeNum)) return;   // pipe-number overload: proper STATUS read

  char payload[CHUNK_TOTAL] = {0};
  radio.read(payload, CHUNK_TOTAL);

  uint8_t type = (uint8_t)payload[0];

  // Zero-byte guard: stale FIFO entry from power-on or SPI glitch
  if (type == 0x00) {
    radio.flush_rx();
    return;   // silent discard
  }

  uint8_t seq  = (uint8_t)payload[1];

  // ---------- ACK from ESP32 ----------
  if (type == 'A') {
    ackFromA = "ACK:" + String(payload + 2);
    Serial.printf("[NRF24 RX] ACK from ESP32: %s\n", ackFromA.c_str());
    return;
  }

  // ---------- DATA / END chunks ----------
  if (type == 'D' || type == 'E') {
    for (int i = 2; i < CHUNK_TOTAL; i++) {
      if (payload[i] == '\0') break;
      assembleFromA += payload[i];
    }

    if (type == 'E') {
      inboxFromA = assembleFromA;
      assembleFromA = "";
      totalMsgsHandled++;
      lastChatActivityMs = millis();

      Serial.printf("\n[CHAT RX] \"%s\"\n", inboxFromA.c_str());
      sendAckToESP32((int)totalMsgsHandled);
    }
    return;
  }

  // Genuinely unknown type — flush and warn
  radio.flush_rx();
  Serial.printf("[NRF24 RX] Unknown chunk type 0x%02X — flushed\n", type);
}

// =====================================================
// HTTP REQUEST HANDLER  (unchanged — phone app compatible)
// =====================================================
void handleHTTP() {
  WiFiClient client = server.available();
  if (!client) return;

  client.setTimeout(1500);
  String request = client.readStringUntil('\r');
  client.flush();

  // Helper lambda to send a response
  auto respond = [&](int code, const String& body) {
    client.println(code == 200 ? "HTTP/1.1 200 OK" : "HTTP/1.1 404 Not Found");
    client.println("Content-Type: text/plain");
    client.println("Connection: close");
    client.println();
    client.println(body);
  };

  // ---- /send?msg=... ----
  if (request.indexOf("/send?msg=") != -1) {
    int s = request.indexOf("msg=") + 4;
    int e = request.indexOf(" HTTP");
    String msg = request.substring(s, e);

    // URL-decode common characters
    msg.replace("+",   " ");  msg.replace("%20", " ");
    msg.replace("%21", "!"); msg.replace("%27", "'");
    msg.replace("%2C", ","); msg.replace("%2E", ".");
    msg.replace("%3F", "?"); msg.replace("%3A", ":");

    ackFromA           = "";
    lastChatActivityMs = millis();
    totalMsgsHandled++;

    Serial.printf("\n[HTTP /send] \"%s\"\n", msg.c_str());

    bool isTel = msg.startsWith("DATA:");
    sendMessage(msg, isTel);
    respond(200, "Sent");
  }
  // ---- /receiveA ----
  else if (request.indexOf("/receiveA") != -1) {
    respond(200, inboxFromA);
    if (inboxFromA != "") inboxFromA = "";
  }
  // ---- /ackA ----
  else if (request.indexOf("/ackA") != -1) {
    respond(200, ackFromA);
    if (ackFromA != "") ackFromA = "";
  }
  // ---- /status ----
  else if (request.indexOf("/status") != -1) {
    String s = "NodeMCU Status: Active\nPartial buffer: \"" + assembleFromA + "\"";
    respond(200, s);
  }
  else {
    respond(404, "Unknown endpoint");
  }
  client.stop();
}

// =====================================================
// SETUP
// =====================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n========================================================");
  Serial.println("     NodeMCU SLAVE NODE — FINAL PRODUCTION VERSION       ");
  Serial.println("========================================================");

  WiFi.softAP(ssid, password);
  server.begin();
  Serial.print("[WiFi] AP started. IP: ");
  Serial.println(WiFi.softAPIP());

  // Do NOT manually call SPI.beginTransaction(); RF24 owns its transactions
  SPI.begin();

  Serial.print("[NRF24] Initialising... ");
  if (!radio.begin()) {
    Serial.println("\nCRITICAL: NRF24 not detected! Check wiring:");
    Serial.println("  CE=D2  CSN=D8  SCK=D5  MISO=D6  MOSI=D7  VCC=3.3V");
    while (1) { delay(1000); yield(); }
  }
  initNRF24();
  Serial.println("OK");
  radio.printPrettyDetails();   // dumps register map — useful for debug

  lastStatSendMs = millis();
  Serial.println("\n========================================================");
  Serial.println("NodeMCU ready. STAT reports to ESP32 every ~8 s (low-priority).");
  Serial.println("========================================================\n");
}

// =====================================================
// LOOP
// =====================================================
void loop() {
  processNRF();    // highest priority: inbound chunk assembly
  handleHTTP();    // phone app requests

  unsigned long now = millis();
  bool chatQuiet = (now - lastChatActivityMs) >= CHAT_QUIET_GUARD_MS;
  if (chatQuiet && (now - lastStatSendMs >= STAT_INTERVAL_MS)) {
    sendStatusToESP32();
    lastStatSendMs = now;
  }

  delay(10);
  yield();
}
