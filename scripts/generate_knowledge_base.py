from fpdf import FPDF
from pathlib import Path

OUTPUT_DIR = Path("knowledge_base")


class DocumentPDF(FPDF):
    """Custom PDF class with consistent header and footer styling."""

    def __init__(self, title: str):
        super().__init__()
        self.doc_title = title

    def header(self):
        self.set_font("Helvetica", "B", 11)
        self.set_fill_color(30, 30, 80)
        self.set_text_color(255, 255, 255)
        self.cell(0, 10, f"  ISRO NOC COPILOT - {self.doc_title}", fill=True)
        self.ln(6)
        self.set_text_color(0, 0, 0)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f"CONFIDENTIAL - Internal Use Only | Page {self.page_no()}", align="C")

    def section_title(self, title: str):
        self.set_font("Helvetica", "B", 12)
        self.set_fill_color(220, 230, 245)
        self.cell(0, 8, f"  {title}", fill=True)
        self.ln(4)
        self.set_font("Helvetica", "", 10)

    def body_text(self, text: str):
        self.set_font("Helvetica", "", 10)
        self.multi_cell(0, 6, text)
        self.ln(3)


# ── Document 1: Runbook ──────────────────────────────────────────────────────

def create_runbook() -> None:
    """Generate the NOC Standard Operating Procedures runbook PDF."""
    pdf = DocumentPDF("NETWORK RUNBOOK v3.2")
    pdf.add_page()

    pdf.section_title("1. PURPOSE AND SCOPE")
    pdf.body_text(
        "This runbook defines Standard Operating Procedures (SOPs) for the Network Operations "
        "Center (NOC) managing MPLS and SD-WAN infrastructure. It covers fault isolation, "
        "escalation paths, and restoration procedures for Tier-1 through Tier-3 incidents."
    )

    pdf.section_title("2. BGP TROUBLESHOOTING PROCEDURE")
    pdf.body_text(
        "BGP Route Flapping:\n"
        "Symptom: Routes appear and disappear from the routing table repeatedly.\n"
        "Step 1: Run 'show bgp summary' to identify unstable neighbors.\n"
        "Step 2: Check interface counters - 'show interface <if>' for CRC errors.\n"
        "Step 3: Enable route flap dampening: 'bgp dampening 15 750 2000 60'.\n"
        "Step 4: If flapping persists, isolate the peer with 'neighbor <ip> shutdown'.\n"
        "Step 5: Escalate to Tier-2 if not resolved within 30 minutes.\n\n"
        "BGP Neighbor Down:\n"
        "Step 1: Verify physical connectivity - ping the neighbor IP.\n"
        "Step 2: Check BGP timers: 'show bgp neighbors <ip> | inc hold'.\n"
        "Step 3: Verify AS number matches: 'show run | section router bgp'.\n"
        "Step 4: Clear BGP session: 'clear ip bgp <ip> soft'.\n"
        "Step 5: If MD5 authentication mismatch, re-enter password on both peers."
    )

    pdf.section_title("3. MPLS LINK FAILURE PROCEDURE")
    pdf.body_text(
        "Symptom: Traffic loss on MPLS circuit, LDP session dropped.\n"
        "Step 1: Confirm alarm in NMS - identify affected PE router and circuit ID.\n"
        "Step 2: Check LDP session: 'show mpls ldp neighbor'.\n"
        "Step 3: Verify RSVP-TE tunnels: 'show mpls traffic-eng tunnels brief'.\n"
        "Step 4: Test LSP ping: 'ping mpls ipv4 <prefix>/32 repeat 100'.\n"
        "Step 5: If physical failure confirmed, open ticket with carrier.\n"
        "Step 6: Activate backup path: 'no shutdown' on backup interface.\n"
        "Step 7: Verify traffic restored via NetFlow dashboard within 5 minutes.\n"
        "Escalation: P1 incidents must be escalated to Tier-2 within 15 minutes."
    )

    pdf.section_title("4. SD-WAN OVERLAY TROUBLESHOOTING")
    pdf.body_text(
        "Symptom: Branch site loses connectivity to data center.\n"
        "Step 1: Log into vManage - navigate to Monitor > Network.\n"
        "Step 2: Check tunnel status: Control Connections must show 'Up'.\n"
        "Step 3: Verify BFD sessions: 'show sdwan bfd sessions'.\n"
        "Step 4: Check policy application: 'show sdwan policy from-vsmart'.\n"
        "Step 5: Restart WAN Edge if no control connections: 'request system reboot'.\n"
        "Step 6: If vSmart unreachable, failover to secondary controller.\n"
        "Critical: Never reboot more than one WAN Edge in the same region simultaneously."
    )

    pdf.section_title("5. ESCALATION MATRIX")
    pdf.body_text(
        "P1 (Critical) - Service Down     : Escalate to Tier-2 in 15 min, NOC Manager in 30 min.\n"
        "P2 (High)     - Degraded Service : Escalate to Tier-2 in 1 hour.\n"
        "P3 (Medium)   - Minor Impact     : Resolve within 4 hours or escalate.\n"
        "P4 (Low)      - No Impact        : Resolve within 24 hours.\n\n"
        "Escalation contacts:\n"
        "  Tier-2 Network Engineer : +91-11-2345-6789 (24x7)\n"
        "  NOC Manager             : +91-11-2345-6790\n"
        "  Vendor TAC (Cisco)      : 1-800-553-2447\n"
        "  ISP NOC (BSNL Leased)   : 1800-180-1503"
    )

    pdf.section_title("6. CHANGE MANAGEMENT GUIDELINES")
    pdf.body_text(
        "All changes to production routers must follow this process:\n"
        "1. Raise Change Request (CR) in ServiceNow at least 48 hours before.\n"
        "2. Obtain approval from Network Architect and NOC Manager.\n"
        "3. Schedule during approved maintenance window: Saturday 02:00-05:00 IST.\n"
        "4. Have rollback plan documented before starting.\n"
        "5. Test in staging environment if available.\n"
        "6. Post-change verification: ping, traceroute, BGP summary check.\n"
        "Emergency changes during P1 incidents are exempt but must be documented within 2 hours."
    )

    path = OUTPUT_DIR / "runbook.pdf"
    pdf.output(str(path))
    print(f"  [OK] Created: {path}")


# ── Document 2: Incident Reports ─────────────────────────────────────────────

def create_incident_report() -> None:
    """Generate historical incident reports PDF."""
    pdf = DocumentPDF("INCIDENT REPORT ARCHIVE 2024-2025")
    pdf.add_page()

    pdf.section_title("INCIDENT #INC-2024-0831 - SEVERITY: P1")
    pdf.body_text(
        "Date       : 2024-08-31 | 03:14 IST\n"
        "Duration   : 47 minutes\n"
        "Affected   : 3 branch sites (Mumbai, Pune, Nashik) - total 840 users\n"
        "Root Cause : BGP session between PE-MUM-01 and CE-PUN-02 dropped due to "
        "interface flap on GigabitEthernet0/0/1 caused by a faulty SFP module.\n\n"
        "Timeline:\n"
        "  03:14 - NMS alert: BGP neighbor down on PE-MUM-01.\n"
        "  03:17 - NOC Tier-1 acknowledged, began ping tests.\n"
        "  03:22 - Physical layer checked; CRC errors found on Gi0/0/1.\n"
        "  03:31 - Tier-2 escalated; SFP identified as faulty.\n"
        "  03:58 - Spare SFP installed; BGP session re-established.\n"
        "  04:01 - All traffic restored. Incident closed.\n\n"
        "Resolution: Replace SFP-10G-SR on PE-MUM-01 Gi0/0/1 with spare unit.\n"
        "Prevention: Quarterly SFP health checks added to maintenance schedule.\n"
        "Lessons Learned: Keep 2x spare SFPs of each type in every PoP."
    )

    pdf.section_title("INCIDENT #INC-2024-1115 - SEVERITY: P2")
    pdf.body_text(
        "Date       : 2024-11-15 | 14:32 IST\n"
        "Duration   : 2 hours 18 minutes\n"
        "Affected   : SD-WAN overlay - 12 branch sites, partial connectivity\n"
        "Root Cause : vSmart controller certificate expired. BFD sessions dropped "
        "across all WAN Edge routers causing policy push failure.\n\n"
        "Timeline:\n"
        "  14:32 - Users report slow internet; vManage shows 'Control Down'.\n"
        "  14:40 - NOC checks vSmart; certificate expiry error in logs.\n"
        "  15:10 - New certificate generated via Cisco PKI portal.\n"
        "  15:55 - Certificate pushed to vSmart; control connections restored.\n"
        "  16:50 - All BFD sessions re-established. Incident closed.\n\n"
        "Resolution: Renew vSmart certificate, restart orchestration services.\n"
        "Prevention: Certificate expiry monitoring added to Zabbix with 30-day alert.\n"
        "Lessons Learned: vSmart and vBond certificates must be tracked in CMDB."
    )

    pdf.section_title("INCIDENT #INC-2025-0203 - SEVERITY: P1")
    pdf.body_text(
        "Date       : 2025-02-03 | 22:55 IST\n"
        "Duration   : 1 hour 12 minutes\n"
        "Affected   : Core MPLS backbone - 100% traffic loss on Delhi-Bangalore link\n"
        "Root Cause : RSVP-TE tunnel misconfiguration after emergency change. "
        "Explicit route configured with wrong next-hop IP causing black-hole routing.\n\n"
        "Timeline:\n"
        "  22:55 - NMS: MPLS tunnel TR-DEL-BLR-01 down, traffic rerouting.\n"
        "  23:02 - Backup tunnel TR-DEL-BLR-02 also failed. Full outage.\n"
        "  23:15 - Change log reviewed; recent TE config change identified.\n"
        "  23:28 - Rollback executed; original tunnel config restored.\n"
        "  23:47 - Tunnel restored. Traffic confirmed via NetFlow.\n"
        "  00:07 - Incident closed.\n\n"
        "Resolution: Rollback RSVP-TE explicit route to previous configuration.\n"
        "Prevention: TE configuration changes now require pre-implementation lab test.\n"
        "Lessons Learned: Emergency changes still need peer review before applying."
    )

    pdf.section_title("INCIDENT #INC-2025-0419 - SEVERITY: P3")
    pdf.body_text(
        "Date       : 2025-04-19 | 09:10 IST\n"
        "Duration   : 3 hours 40 minutes\n"
        "Affected   : QoS policy mismatch - VoIP degradation at 4 branches\n"
        "Root Cause : SD-WAN application-aware routing policy pushed incorrect DSCP "
        "markings after vManage template update, causing VoIP traffic to use Best Effort queue.\n\n"
        "Timeline:\n"
        "  09:10 - Helpdesk tickets: voice quality poor at HYD/CHN/BLR/KOC branches.\n"
        "  09:45 - NOC confirmed VoIP DSCP EF marking missing post template push.\n"
        "  10:30 - Cisco TAC engaged for vManage template rollback assistance.\n"
        "  12:50 - Correct QoS template re-applied. VoIP quality restored.\n\n"
        "Resolution: Rollback SD-WAN QoS policy template to version 2.1.3.\n"
        "Prevention: QoS template changes to be validated in lab before production push."
    )

    path = OUTPUT_DIR / "incident.pdf"
    pdf.output(str(path))
    print(f"  [OK] Created: {path}")


# ── Document 3: Network Topology ─────────────────────────────────────────────

def create_topology_document() -> None:
    """Generate the network topology and device inventory PDF."""
    pdf = DocumentPDF("NETWORK TOPOLOGY AND DEVICE INVENTORY")
    pdf.add_page()

    pdf.section_title("1. NETWORK OVERVIEW")
    pdf.body_text(
        "The network consists of a dual-tier MPLS core with SD-WAN overlay for branch connectivity. "
        "The backbone connects 4 Points of Presence (PoPs): Delhi (primary hub), Mumbai, Bangalore, "
        "and Hyderabad. Each PoP contains redundant PE routers. 38 branch sites connect via SD-WAN "
        "WAN Edge routers using dual ISP links (BSNL MPLS primary, Airtel broadband secondary)."
    )

    pdf.section_title("2. CORE ROUTERS - PE DEVICES")
    pdf.body_text(
        "PE-DEL-01  | Cisco ASR 9001  | Delhi DC Primary    | 192.168.10.1  | AS 65001\n"
        "PE-DEL-02  | Cisco ASR 9001  | Delhi DC Secondary  | 192.168.10.2  | AS 65001\n"
        "PE-MUM-01  | Cisco ASR 9006  | Mumbai PoP          | 192.168.20.1  | AS 65001\n"
        "PE-MUM-02  | Cisco ASR 9006  | Mumbai PoP Backup   | 192.168.20.2  | AS 65001\n"
        "PE-BLR-01  | Cisco ASR 9001  | Bangalore PoP       | 192.168.30.1  | AS 65001\n"
        "PE-HYD-01  | Cisco ASR 9001  | Hyderabad PoP       | 192.168.40.1  | AS 65001\n\n"
        "All PE routers run: IOS-XR 7.9.2 | BGP-4 | MPLS LDP + RSVP-TE | IS-IS Level-2"
    )

    pdf.section_title("3. SD-WAN CONTROLLERS")
    pdf.body_text(
        "vManage-01 (Primary)    | 10.0.0.10 | vManage 20.9.3  | Delhi DC\n"
        "vManage-02 (Secondary)  | 10.0.0.11 | vManage 20.9.3  | Mumbai DC\n"
        "vSmart-01               | 10.0.0.20 | vSmart 20.9.3   | Delhi DC\n"
        "vSmart-02               | 10.0.0.21 | vSmart 20.9.3   | Bangalore DC\n"
        "vBond-01                | 10.0.0.30 | vBond 20.9.3    | Public DMZ\n\n"
        "Certificate Authority   : Cisco PKI | Renewal cycle: Every 12 months\n"
        "vManage admin URL       : https://10.0.0.10:443"
    )

    pdf.section_title("4. BRANCH WAN EDGE DEVICES")
    pdf.body_text(
        "Branch naming convention: WE-<CITY>-<INDEX>\n\n"
        "WE-AGR-01  | Cisco Catalyst 8200  | Agra Branch       | 10.1.1.1  | BSNL+Airtel\n"
        "WE-LKO-01  | Cisco Catalyst 8200  | Lucknow Branch    | 10.1.2.1  | BSNL+Jio\n"
        "WE-JDP-01  | Cisco Catalyst 8300  | Jodhpur Branch    | 10.1.3.1  | BSNL+Airtel\n"
        "WE-PUN-01  | Cisco Catalyst 8300  | Pune Branch       | 10.1.4.1  | BSNL+Airtel\n"
        "WE-PUN-02  | Cisco Catalyst 8200  | Pune Branch-2     | 10.1.4.2  | BSNL+Airtel\n"
        "WE-CHN-01  | Cisco Catalyst 8300  | Chennai Branch    | 10.1.5.1  | BSNL+ACT\n"
        "WE-KOC-01  | Cisco Catalyst 8200  | Kochi Branch      | 10.1.6.1  | BSNL+Airtel\n"
        "[... 31 additional branch sites follow same naming convention]"
    )

    pdf.section_title("5. MPLS BACKBONE LINKS")
    pdf.body_text(
        "Delhi     -> Mumbai    : 10 Gbps STM-64 | Carrier: BSNL Leased | SLA: 99.99%\n"
        "Delhi     -> Bangalore : 10 Gbps STM-64 | Carrier: Tata Comm   | SLA: 99.99%\n"
        "Delhi     -> Hyderabad : 1 Gbps  STM-16 | Carrier: BSNL Leased | SLA: 99.95%\n"
        "Mumbai    -> Bangalore : 10 Gbps STM-64 | Carrier: Reliance    | SLA: 99.99%\n"
        "Mumbai    -> Hyderabad : 1 Gbps  STM-16 | Carrier: BSNL Leased | SLA: 99.95%\n"
        "Bangalore -> Hyderabad : 1 Gbps  STM-16 | Carrier: Tata Comm   | SLA: 99.95%\n\n"
        "All backbone links are protected by RSVP-TE Fast Reroute (FRR) with 50ms convergence."
    )

    pdf.section_title("6. IP ADDRESS PLAN")
    pdf.body_text(
        "Loopback addresses    : 192.168.0.0/24  (all PE/P routers)\n"
        "MPLS backbone links   : 172.16.0.0/16\n"
        "Branch LAN subnets    : 10.0.0.0/8      (each branch /24)\n"
        "SD-WAN overlay        : 100.64.0.0/10   (RFC6598 carrier-grade NAT range)\n"
        "Management network    : 10.255.0.0/24   (out-of-band)\n"
        "NMS servers           : 10.255.0.10-20\n"
        "IPAM Tool             : phpIPAM at https://ipam.noc.internal"
    )

    pdf.section_title("7. CRITICAL DEPENDENCIES")
    pdf.body_text(
        "DNS Servers    : 10.255.0.10 (primary), 10.255.0.11 (secondary)\n"
        "NTP Servers    : 10.255.0.5 (Stratum-1, GPS-synced)\n"
        "TACACS+        : 10.255.0.15 (authentication for all network devices)\n"
        "Syslog Server  : 10.255.0.16 (ELK Stack)\n"
        "SNMP Community : noc-monitor-2024 (read-only)\n"
        "Zabbix NMS     : https://nms.noc.internal\n"
        "NetFlow Collector: 10.255.0.17 (Grafana dashboard)\n\n"
        "WARNING: If TACACS+ server is unreachable, use local fallback account.\n"
        "Local credentials are stored in sealed envelope in NOC safe."
    )

    path = OUTPUT_DIR / "topology.pdf"
    pdf.output(str(path))
    print(f"  [OK] Created: {path}")


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)

    print("=" * 50)
    print("  Generating NOC Knowledge Base Documents")
    print("=" * 50)

    create_runbook()
    create_incident_report()
    create_topology_document()

    print("=" * 50)
    print("  All 3 documents created in knowledge_base/")
    print("=" * 50)


if __name__ == "__main__":
    main()
