"""Generate CourtFlow SRD PDF for TIE 251."""
from fpdf import FPDF
from fpdf.enums import XPos, YPos


class SRD(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(80, 80, 80)
        self.cell(0, 8, "CourtFlow - Specification and Requirements Document", align="C",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(200, 200, 200)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(3)

    def footer(self):
        self.set_y(-13)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"{self.page_no()}", align="C")

    def cover_page(self):
        self.add_page()
        self.ln(30)
        self.set_font("Helvetica", "B", 28)
        self.set_text_color(0, 0, 0)
        self.cell(0, 14, "CourtFlow", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_font("Helvetica", "", 13)
        self.set_text_color(80, 80, 80)
        self.cell(0, 8, "Integrated Match Video Capture & Intelligence System",
                  align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(3)
        self.cell(0, 8, "Specification and Requirements Document (SRD)",
                  align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(14)
        self.set_draw_color(0, 0, 0)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(10)
        meta = [
            ("Version:", "1.0"),
            ("Date:", "May 11, 2026"),
            ("Course:", "TIE 251 - Specification and Requirements"),
            ("Team:", "CourtFlow Team"),
            ("Repository:", "https://github.com/Alsadegzahra/CF"),
            ("Live Demo:", "https://courtflow-mqns.onrender.com"),
        ]
        for label, value in meta:
            self.set_font("Helvetica", "B", 11)
            self.set_text_color(0, 0, 0)
            self.cell(38, 7, label)
            self.set_font("Helvetica", "", 11)
            self.cell(0, 7, value, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def toc_entry(self, title, page_hint=""):
        self.set_font("Helvetica", "", 11)
        self.set_text_color(0, 0, 0)
        dots = "." * max(2, 68 - len(title))
        self.cell(0, 7, f"{title} {dots} {page_hint}",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def h1(self, text):
        self.ln(4)
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(0, 0, 0)
        self.cell(0, 9, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(0, 0, 0)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(3)

    def h2(self, text):
        self.ln(3)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(0, 0, 0)
        self.cell(0, 8, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(1)

    def h3(self, text):
        self.ln(2)
        self.set_font("Helvetica", "BI", 11)
        self.set_text_color(40, 40, 40)
        self.cell(0, 7, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def body(self, text):
        self.set_font("Helvetica", "", 10.5)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 6, text)
        self.ln(2)

    def bullet(self, text, indent=6):
        self.set_font("Helvetica", "", 10.5)
        self.set_text_color(30, 30, 30)
        self.set_x(self.l_margin + indent)
        self.cell(5, 6, "-")
        avail = self.w - self.r_margin - (self.l_margin + indent + 5)
        self.multi_cell(avail, 6, text)
        self.set_x(self.l_margin)

    def table(self, headers, rows, col_widths=None):
        if col_widths is None:
            w = (self.w - self.l_margin - self.r_margin) / len(headers)
            col_widths = [w] * len(headers)
        self.set_font("Helvetica", "B", 9.5)
        self.set_fill_color(230, 230, 230)
        self.set_text_color(0, 0, 0)
        for i, h in enumerate(headers):
            self.cell(col_widths[i], 8, h, border=1, fill=True)
        self.ln()
        self.set_font("Helvetica", "", 9.5)
        fill = False
        self.set_fill_color(248, 248, 248)
        for row in rows:
            # Calculate row height based on longest cell
            max_lines = 1
            for i, cell in enumerate(row):
                chars_per_line = col_widths[i] / 2.1
                lines = max(1, len(cell) // int(chars_per_line) + 1)
                max_lines = max(max_lines, lines)
            row_h = max(7, max_lines * 5.5)
            y_start = self.get_y()
            x_start = self.l_margin
            for i, cell in enumerate(row):
                self.set_xy(x_start, y_start)
                self.multi_cell(col_widths[i], row_h / max(1, (len(cell) // int(col_widths[i] / 2.1) + 1)),
                                cell, border=1, fill=fill)
                x_start += col_widths[i]
            self.set_y(y_start + row_h)
            fill = not fill
        self.ln(3)


def build():
    pdf = SRD(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(20, 20, 20)

    # ── Cover ──────────────────────────────────────────────────────────────
    pdf.cover_page()

    # ── Table of Contents ──────────────────────────────────────────────────
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Table of Contents", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_draw_color(0, 0, 0)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(4)
    toc = [
        "1. Project Idea & Problem Statement",
        "2. Objectives",
        "3. Target Users",
        "4. System Scope",
        "   4.1 In-Scope (MVP)",
        "   4.2 Out of Scope",
        "5. Functional Requirements",
        "   5.1 Match Capture",
        "   5.2 Post-Match Processing",
        "   5.3 Replay & Access",
        "6. Non-Functional Requirements",
        "7. Assumptions",
        "8. Constraints",
        "9. Expected Outcomes",
    ]
    for entry in toc:
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(0, 7, entry, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # ── Section 1 ──────────────────────────────────────────────────────────
    pdf.add_page()
    pdf.h1("1. Project Idea & Problem Statement")

    pdf.h2("1.1 Project Idea")
    pdf.body(
        "CourtFlow is a court-installed video intelligence system for padel. A fixed overhead "
        "camera records each match automatically. After the match, the system processes the "
        "recording through a computer-vision pipeline to produce structured analytics: per-player "
        "movement heatmaps, physical load metrics, spatial zone coverage, and motion-based "
        "highlight clips. Players access results through a bilingual (English/Arabic) web dashboard "
        "without needing any technical setup."
    )

    pdf.h2("1.2 Problem Statement")
    pdf.body(
        "Padel players frequently repeat the same tactical and positioning errors across matches "
        "without recognising them. During play, attention is focused on winning the point - there "
        "is no opportunity for in-game reflection. After the match, players rely on memory, "
        "emotions, or brief verbal comments that are incomplete and often biased."
    )
    pdf.body(
        "As a result, players finish matches without a clear understanding of what went wrong, "
        "which mistakes were repeated, or whether their positioning changed across rallies. Over "
        "time this leads to slow skill development, recurring frustration, and difficulty "
        "translating practice into match improvement."
    )
    pdf.body(
        "No affordable, install-and-forget solution currently exists that gives recreational and "
        "semi-professional padel players objective, post-match movement intelligence from their own "
        "court footage."
    )

    # ── Section 2 ──────────────────────────────────────────────────────────
    pdf.h1("2. Objectives")
    objectives = [
        "Deliver a reliable end-to-end post-match analytics pipeline that processes a padel match "
        "video into structured movement metrics without manual intervention.",
        "Provide per-player physical load metrics: total distance covered, average and maximum "
        "speed, sprint count, acceleration/deceleration load, and lateral movement percentage.",
        "Generate spatial intelligence outputs: per-player heatmaps, 6-zone court coverage, "
        "net-versus-baseline time split, team spacing, and movement intensity timeline.",
        "Produce motion-based highlight clips and an auto-assembled highlight reel, shareable via "
        "a public link.",
        "Serve all results through a responsive, bilingual (English/Arabic) web dashboard "
        "accessible on any device without installation.",
        "Deploy the system on cloud infrastructure (Render + Cloudflare R2) so results are "
        "available remotely within minutes of processing completion.",
        "Establish a stable, versioned architecture that supports future phases: ball tracking, "
        "rally segmentation, shot classification, and longitudinal player analytics.",
    ]
    for obj in objectives:
        pdf.bullet(obj)
        pdf.ln(1)

    # ── Section 3 ──────────────────────────────────────────────────────────
    pdf.h1("3. Target Users")

    pdf.h2("3.1 Primary Users")
    primary = [
        ("Recreational & Club Padel Players",
         "Adults who play padel regularly at a club or court. They want to understand their "
         "movement patterns, compare performance across matches, and identify habits to improve - "
         "without needing a coach present."),
        ("Semi-Professional Players",
         "Players who train systematically and require objective performance data to guide "
         "training priorities, track load over time, and review match footage with a coach."),
        ("Padel Coaches",
         "Coaches who want structured, objective data to complement verbal feedback, compare "
         "players across a squad, and monitor physical load across sessions."),
    ]
    for title, desc in primary:
        pdf.h3(title)
        pdf.body(desc)

    pdf.h2("3.2 Secondary Users")
    secondary = [
        ("Padel Court Operators & Clubs",
         "Courts that install CourtFlow to differentiate their offering. They benefit from live "
         "streaming, automated session recording, and shareable highlight content that drives "
         "player engagement and court bookings."),
        ("Sports Science & Performance Staff",
         "Professionals who use aggregate movement data for player load monitoring, fatigue "
         "management, and injury prevention planning."),
    ]
    for title, desc in secondary:
        pdf.h3(title)
        pdf.body(desc)

    # ── Section 4 ──────────────────────────────────────────────────────────
    pdf.add_page()
    pdf.h1("4. System Scope")

    pdf.h2("4.1 In-Scope (MVP - Phase 1)")
    in_scope = [
        "Match video acquisition from a single fixed overhead court camera",
        "One-time per-court calibration (homography: image space to normalised court space)",
        "Per-match court validation against stored calibration",
        "Player detection using YOLOv8/v26 (custom-trained model: models/best.pt)",
        "Multi-object tracking with ByteTrack / BoT-SORT (canonical 4-player IDs: P1-P4)",
        "Image-to-court coordinate transformation (10 m x 20 m padel court)",
        "3-tier analytics engine: distance & active time (T1), speed & sprints (T2), zones & "
        "spatial metrics (T3)",
        "Per-player heatmap generation (PNG)",
        "Motion-based highlight detection and video clip rendering (FFmpeg)",
        "Structured JSON match report with metadata, per-player stats, and heatmap references",
        "PDF match report export",
        "Cloud upload of processed artifacts to Cloudflare R2 (presigned URLs)",
        "React/Vite web dashboard: Summary, Analysis, and Replay tabs (English & Arabic)",
        "User authentication and social features (Supabase)",
        "Deployment on Render (FastAPI backend + React frontend)",
    ]
    for item in in_scope:
        pdf.bullet(item)

    pdf.h2("4.2 Out of Scope (Future Phases)")
    out_scope = [
        "Ball tracking and ball speed estimation (Phase 2)",
        "Rally segmentation, serve detection, shot classification (Phase 2-3)",
        "Winner / unforced error detection (Phase 3)",
        "Tactical pattern recognition and coaching-level AI insights (Phase 4)",
        "Cross-match player identity linking and longitudinal performance trends (Phase 5)",
        "Real-time processing or live coaching interventions",
        "Multi-camera fusion",
        "Automated court booking or scheduling integration",
    ]
    for item in out_scope:
        pdf.bullet(item)

    # ── Section 5 ──────────────────────────────────────────────────────────
    pdf.add_page()
    pdf.h1("5. Functional Requirements")

    pdf.h2("5.1 Match Capture")
    headers = ["ID", "Requirement", "Priority", "Verification"]
    rows = [
        ["FR-01", "The system shall automatically start and stop recording based on court session timing.", "High", "Functional test"],
        ["FR-02", "Recording shall not require player interaction.", "High", "Observational test"],
        ["FR-03", "The system shall record the full match continuously under normal operating conditions.", "High", "Output inspection"],
        ["FR-04", "Court staff shall be able to manually override recording if required.", "Medium", "Functional test"],
    ]
    pdf.table(headers, rows, [18, 100, 22, 30])

    pdf.h2("5.2 Post-Match Processing (Movement Intelligence)")
    rows2 = [
        ["FR-05", "The system shall begin processing automatically after recording completion.", "High", "Functional test"],
        ["FR-06", "The system shall compute court calibration to convert pixel coordinates into normalised court-space coordinates.", "High", "Output inspection"],
        ["FR-07", "The system shall detect and track all players throughout the match session and assign stable canonical IDs (P1-P4).", "High", "Output inspection"],
        ["FR-08", "The system shall convert tracked pixel trajectories into court-normalised trajectories.", "High", "Output inspection"],
        ["FR-09", "The system shall compute movement intelligence metrics including heatmaps, distance covered, speed metrics, zone coverage, and movement intensity over time.", "High", "Output inspection"],
        ["FR-10", "The system shall generate motion-based highlight timestamps derived from movement intensity signals.", "Medium", "Output inspection"],
        ["FR-11", "The system shall render highlight video clips using computed timestamps and assemble a shareable highlight reel.", "Medium", "Output inspection"],
        ["FR-12", "The system shall generate a structured match report (JSON and PDF) combining all analytics outputs.", "High", "Output inspection"],
        ["FR-13", "The system shall upload processed artifacts to cloud storage and generate presigned access URLs.", "High", "Functional test"],
        ["FR-14", "The system shall notify players when post-match processing is complete.", "Medium", "Functional test"],
    ]
    pdf.table(headers, rows2, [18, 100, 22, 30])

    pdf.h2("5.3 Replay & Access")
    rows3 = [
        ["FR-15", "Players shall be able to access processed match results via an online dashboard without installation.", "High", "Usability test"],
        ["FR-16", "Players shall be able to view highlight clips generated from movement intensity.", "High", "Usability test"],
        ["FR-17", "Players shall be able to download and share highlight clips via a link.", "Medium", "Functional test"],
        ["FR-18", "The dashboard shall support English and Arabic language switching.", "High", "Functional test"],
        ["FR-19", "Users shall be able to create accounts, save matches, and connect with other players.", "Medium", "Functional test"],
    ]
    pdf.table(headers, rows3, [18, 100, 22, 30])

    # ── Section 6 ──────────────────────────────────────────────────────────
    pdf.add_page()
    pdf.h1("6. Non-Functional Requirements")
    nfr_rows = [
        ["NFR-01", "Match recording reliability shall be prioritised over all other features. Loss of recorded footage is a critical failure.", "High", "Observational test"],
        ["NFR-02", "Post-match processing shall operate as a batch job after match completion, not in real-time.", "High", "Design review"],
        ["NFR-03", "The system shall not require player training or workflow changes - recording is invisible to players.", "High", "Observational test"],
        ["NFR-04", "Only processed artifacts (metrics, heatmaps, highlight clips, manifests) shall be uploaded to cloud storage in Phase 1; raw video is not uploaded by default.", "High", "Design review"],
        ["NFR-05", "The system shall support secure user access to cloud-hosted artifacts via authentication (Supabase) and presigned URLs.", "High", "Security review"],
        ["NFR-06", "The web dashboard shall load match results within 3 seconds on a standard broadband connection.", "Medium", "Performance test"],
        ["NFR-07", "The pipeline shall handle a standard 90-minute padel match without manual intervention or memory errors.", "High", "Stress test"],
        ["NFR-08", "The architecture shall support future phase expansion (ball tracking, rally logic) without redesigning the Phase 1 pipeline.", "Medium", "Design review"],
        ["NFR-09", "The system shall be independently deployable; no external database server is required (SQLite is file-based).", "Medium", "Deployment test"],
        ["NFR-10", "The dashboard shall be usable on mobile and desktop browsers without native app installation.", "Medium", "Usability test"],
    ]
    pdf.table(["ID", "Requirement", "Priority", "Verification"], nfr_rows, [18, 108, 22, 22])

    # ── Section 7 ──────────────────────────────────────────────────────────
    pdf.add_page()
    pdf.h1("7. Assumptions")
    assumptions = [
        "A single fixed overhead camera is installed on the court and provides a stable, "
        "unobstructed view of the entire playing surface for the duration of the match.",
        "The court has been calibrated at least once prior to match processing. The homography "
        "mapping is assumed valid until the court is physically reconfigured.",
        "Adequate and reasonably uniform lighting exists throughout the match session. The system "
        "is not designed for very low-light or high-glare conditions.",
        "All four players remain within the court boundaries for the majority of the match, "
        "allowing the play-area ROI filter to function correctly.",
        "The processing machine (laptop or cloud instance) has sufficient CPU/GPU resources to "
        "run YOLO inference and ByteTrack on the full match video within a reasonable post-match "
        "window (not exceeding 2x match duration).",
        "Internet connectivity is available after processing to upload artifacts to Cloudflare R2.",
        "Players have access to a modern web browser and an internet connection to view results "
        "on the dashboard.",
        "Each match involves exactly four players (padel doubles format). The canonical ID system "
        "(P1-P4) is designed for this configuration.",
        "The YOLO model (models/best.pt) has been fine-tuned on padel footage and achieves "
        "adequate detection performance under the assumed lighting and camera conditions.",
        "The system operates in a post-match, batch-processing mode in Phase 1. Real-time "
        "constraints do not apply.",
    ]
    for a in assumptions:
        pdf.bullet(a)
        pdf.ln(1)

    # ── Section 8 ──────────────────────────────────────────────────────────
    pdf.h1("8. Constraints")

    pdf.h2("8.1 Technical Constraints")
    tech = [
        "Single-camera architecture: Phase 1 operates with one fixed camera. Multi-camera fusion "
        "is out of scope.",
        "Batch processing only: The pipeline is not designed for real-time or live-stream "
        "analytics in Phase 1.",
        "Edge-local detection: YOLO inference and tracking run on the local processing machine; "
        "no cloud GPU compute is used for the vision layer.",
        "No ball tracking in Phase 1: The ball detection module (ball_yolo.py) exists in the "
        "codebase but is explicitly disabled for the MVP.",
        "Court coordinate system: Analytics assume a standard padel doubles court "
        "(10 m wide x 20 m long). Non-standard court dimensions would require recalibration.",
        "Python 3.9+ runtime required. Key dependencies include Ultralytics, OpenCV (headless), "
        "FFmpeg (system PATH), pandas, NumPy, FastAPI, and fpdf2.",
    ]
    for c in tech:
        pdf.bullet(c)
        pdf.ln(1)

    pdf.h2("8.2 Operational Constraints")
    ops = [
        "Court must be configured before the first match can be processed. Configuration "
        "requires a reference image and either click-based or automatic keypoint detection.",
        "The raw match video file must reside on the processing machine before the pipeline "
        "is invoked. Remote streaming ingestion is not supported in Phase 1.",
        "Cloud storage credentials (Cloudflare R2 keys) must be configured via environment "
        "variables for upload and dashboard access to function.",
        "The Render deployment is subject to free-tier cold-start latency. The first request "
        "after an idle period may experience a startup delay.",
    ]
    for c in ops:
        pdf.bullet(c)
        pdf.ln(1)

    pdf.h2("8.3 Scope Constraints")
    scope_c = [
        "Phase 1 does not link player identities across matches. Each match is processed "
        "independently; cross-match analytics require Phase 5 infrastructure.",
        "Shot classification, rally segmentation, and tactical AI are explicitly excluded from "
        "Phase 1 and deferred to Phases 2-4 per the Technical Roadmap.",
    ]
    for c in scope_c:
        pdf.bullet(c)
        pdf.ln(1)

    # ── Section 9 ──────────────────────────────────────────────────────────
    pdf.add_page()
    pdf.h1("9. Expected Outcomes")

    pdf.h2("9.1 System Outputs (Per Match)")
    outputs = [
        ("Structured JSON Report",
         "Per-player and aggregate analytics across 3 tiers: T1 (distance, active time, rank), "
         "T2 (avg/max speed, sprint count, heatmap references), T3 (zone coverage, net/baseline "
         "split, lateral %, acceleration counts, team spacing, intensity windows)."),
        ("Heatmap Images (PNG)",
         "Per-player spatial density maps showing court positions throughout the match, rendered "
         "on a scaled court background."),
        ("Highlight Video Clips",
         "MP4 clips of high-intensity movement windows, trimmed and individually accessible."),
        ("Highlight Reel",
         "Auto-assembled MP4 reel combining the top intensity clips into a single shareable video."),
        ("PDF Match Report",
         "Formatted summary report suitable for printing or sharing, combining key stats and "
         "heatmap thumbnails."),
        ("Web Dashboard",
         "Interactive React dashboard accessible via a unique match URL, with Summary, Analysis, "
         "and Replay tabs in English and Arabic."),
    ]
    for title, desc in outputs:
        pdf.h3(title)
        pdf.body(desc)

    pdf.h2("9.2 Player-Facing Value")
    value = [
        "Objective post-match review: players see exactly where they moved, how far they ran, "
        "and how their physical output compared to teammates - without relying on memory.",
        "Shareable highlights: automatically generated clips can be shared on social media or "
        "with coaches within minutes of the match ending.",
        "Coaching support: coaches receive structured data to complement verbal feedback and "
        "track player development over time.",
        "Court differentiation: clubs offering CourtFlow provide a premium, data-enriched "
        "experience that drives player retention and court bookings.",
    ]
    for v in value:
        pdf.bullet(v)
        pdf.ln(1)

    pdf.h2("9.3 Technical Milestones (Phase 1 Exit Criteria)")
    milestones = [
        "End-to-end pipeline processes a full padel match video without manual intervention",
        "All report fields (T1, T2, T3) populate consistently across test matches",
        "Heatmaps and highlight reels generate reliably",
        "Dashboard renders correctly on desktop and mobile browsers",
        "All defined interface failure modes (IF-1 through IF-12) are handled",
        "Architecture supports Phase 2 extension (ball tracking, event timeline) without redesign",
    ]
    for m in milestones:
        pdf.bullet(m)
        pdf.ln(1)

    out_path = "/Users/zahraalsadeg/Desktop/CourtFlow_SRD.pdf"
    pdf.output(out_path)
    print(f"PDF written to: {out_path}")


if __name__ == "__main__":
    build()
