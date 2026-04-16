"""
FastAPI entry: matches, artifacts, reports.
Uses: storage/match_db, pipeline/paths, utils/io.
"""
from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from pydantic import BaseModel

from src.config.settings import PROJECT_ROOT
from src.storage import match_db as db
from src.utils.io import read_json


app = FastAPI(title="CourtFlow API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class MatchOut(BaseModel):
    match_id: str
    court_id: str
    source_type: str
    source_uri: str
    output_dir: str
    state: str
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    last_error: Optional[str] = None
    created_at: str
    updated_at: str


class ArtifactOut(BaseModel):
    id: int
    match_id: str
    type: str
    path: str
    status: str
    size_bytes: Optional[int] = None
    created_at: str
    updated_at: str


def _react_dashboard_dist() -> Path:
    return PROJECT_ROOT / "dashboard" / "web" / "dist"


def _react_dashboard_built() -> bool:
    d = _react_dashboard_dist()
    return d.is_dir() and (d / "index.html").is_file()


def _html_react_build_missing() -> str:
    """Shown at / when dashboard/web/dist is missing (e.g. fresh clone before build)."""
    return """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>CourtFlow — build the dashboard</title>
<style>
body{font-family:system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem;line-height:1.5;color:#1e293b}
code{background:#f1f5f9;padding:0.15rem 0.35rem;border-radius:4px;font-size:0.9rem}
pre{background:#0f172a;color:#e2e8f0;padding:1rem;border-radius:8px;overflow:auto;font-size:0.85rem}
a{color:#2563eb}</style></head><body>
<h1>CourtFlow React UI is not built here</h1>
<p>The screen with <strong>language options</strong>, <strong>Try demo</strong>, and the <strong>three tabs</strong> lives at <a href="/app/"><code>/app/</code></a>.
That needs a production build of <code>dashboard/web</code>.</p>
<p>From the repo root run:</p>
<pre>npm install
npm run build
python3 -m uvicorn src.app.api:app --reload</pre>
<p>Then open <a href="/app/">http://127.0.0.1:8000/app/</a> (or refresh <a href="/">/</a> — it redirects when <code>dist/</code> exists).</p>
<p><strong>Development</strong> (hot reload): in another terminal run <code>npm run dev</code> and use <a href="http://127.0.0.1:5173/">http://127.0.0.1:5173/</a> with the API still on port 8000.</p>
<p><a href="/docs">API docs</a></p>
</body></html>"""


@app.get("/", tags=["meta"])
def root():
    """
    Redirect to the React app at /app/ when `dashboard/web/dist` exists (languages, tabs, Try demo).
    If dist is missing, show build instructions — not the legacy static landing card.
    """
    if _react_dashboard_built():
        return RedirectResponse(url="/app/", status_code=302)
    return HTMLResponse(content=_html_react_build_missing(), status_code=200)


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}


@app.get("/view", tags=["ui"])
def view_dashboard(request: Request):
    """
    Legacy URL: redirect to the React dashboard at /app when built (`npm run build`).
    Preserves ?match_id=…&court_id=…. Otherwise serve legacy view.html.
    """
    if _react_dashboard_built():
        q = request.url.query
        target = f"/app/?{q}" if q else "/app/"
        return RedirectResponse(url=target, status_code=302)
    path = PROJECT_ROOT / "dashboard" / "view.html"
    if not path.exists():
        raise HTTPException(status_code=404, detail="view.html not found")
    return FileResponse(path, media_type="text/html")


@app.get("/matches", response_model=List[MatchOut], tags=["matches"])
def list_matches(limit: int = 100) -> List[MatchOut]:
    rows = db.list_matches(limit=limit)
    if rows:
        return [MatchOut(**r) for r in rows]
    # Deployed without DB: list match IDs from R2 (matches uploaded to cloud)
    if _r2_configured():
        import os
        from src.cloud.storage_r2 import list_match_ids_from_r2
        from src.utils.time import utcnow_iso
        bucket = os.getenv("R2_BUCKET")
        if bucket:
            ids = list_match_ids_from_r2(bucket, max_keys=limit * 5)[:limit]
            now = utcnow_iso()
            return [
                MatchOut(
                    match_id=mid,
                    court_id="—",
                    source_type="FILE",
                    source_uri="",
                    output_dir="",
                    state="DONE",
                    started_at=None,
                    ended_at=None,
                    last_error=None,
                    created_at=now,
                    updated_at=now,
                )
                for mid in ids
            ]
    return []


def _match_from_r2(match_id: str) -> Optional[MatchOut]:
    """If R2 is configured and report exists for match_id, return minimal MatchOut for deployed (stateless) mode."""
    if not _r2_configured():
        return None
    from src.cloud.upload import get_report_from_r2
    report = get_report_from_r2(match_id)
    if not report:
        return None
    from src.utils.time import utcnow_iso
    now = utcnow_iso()
    return MatchOut(
        match_id=match_id,
        court_id=report.get("court_id") or "—",
        source_type="FILE",
        source_uri="",
        output_dir="",
        state="DONE",
        started_at=None,
        ended_at=None,
        last_error=None,
        created_at=report.get("generated_at") or now,
        updated_at=now,
    )


@app.get("/matches/{match_id}", response_model=MatchOut, tags=["matches"])
def get_match(match_id: str) -> MatchOut:
    row = db.get_match(match_id)
    if row:
        return MatchOut(**row)
    # Deployed without DB: try R2 (report exists => match is "known")
    match_out = _match_from_r2(match_id)
    if match_out:
        return match_out
    raise HTTPException(status_code=404, detail="Match not found")


@app.get("/matches/{match_id}/artifacts", response_model=List[ArtifactOut], tags=["artifacts"])
def list_match_artifacts(match_id: str) -> List[ArtifactOut]:
    if not db.get_match(match_id):
        raise HTTPException(status_code=404, detail="Match not found")
    return [ArtifactOut(**r) for r in db.list_artifacts(match_id)]


@app.get("/matches/{match_id}/report", tags=["reports"])
def get_match_report(match_id: str) -> dict:
    row = db.get_match(match_id)
    if row:
        report_path = Path(row["output_dir"]) / "reports" / "report.json"
        if report_path.exists():
            return read_json(report_path)
    # Deployed without local data: try R2
    if _r2_configured():
        from src.cloud.upload import get_report_from_r2
        report = get_report_from_r2(match_id)
        if report:
            return report
    raise HTTPException(status_code=404, detail="Report not found")


@app.get("/matches/{match_id}/report.pdf", tags=["reports"])
def get_match_report_pdf(match_id: str):
    """Serve printable report.pdf (generated with report.json)."""
    row = db.get_match(match_id)
    if not row:
        raise HTTPException(status_code=404, detail="Match not found")
    pdf_path = Path(row["output_dir"]) / "reports" / "report.pdf"
    if not pdf_path.exists():
        raise HTTPException(
            status_code=404,
            detail="report.pdf not found — run pipeline (stage 04) after installing fpdf2",
        )
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"{match_id}-report.pdf",
    )


@app.get("/matches/{match_id}/report/heatmap", tags=["reports"])
def get_match_report_heatmap(match_id: str, player_id: Optional[str] = None):
    """Serve court heatmap image (all players or per-player). Use ?player_id=1 for P1, etc."""
    row = db.get_match(match_id)
    if not row:
        raise HTTPException(status_code=404, detail="Match not found")
    reports_dir = Path(row["output_dir"]) / "reports"
    if player_id and player_id in ("1", "2", "3", "4"):
        heatmap_path = reports_dir / f"heatmap_player_{player_id}.png"
    else:
        heatmap_path = reports_dir / "heatmap.png"
    if not heatmap_path.exists():
        raise HTTPException(status_code=404, detail="Heatmap not found")
    return FileResponse(heatmap_path, media_type="image/png")


@app.get("/matches/{match_id}/highlights/video", tags=["reports"])
def get_match_highlights_video(match_id: str):
    """Serve highlights.mp4 for the user dashboard (local only; use cloud/urls when deployed)."""
    row = db.get_match(match_id)
    if not row:
        raise HTTPException(status_code=404, detail="Match not found")
    video_path = Path(row["output_dir"]) / "highlights" / "highlights.mp4"
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Highlights video not found")
    return FileResponse(video_path, media_type="video/mp4")


@app.get("/matches/{match_id}/player-thumb/{player_id}", tags=["reports"])
def get_match_player_thumb(match_id: str, player_id: str):
    """Serve player thumbnail image for the dashboard (crop from match video). 404 if not generated."""
    row = db.get_match(match_id)
    if not row:
        raise HTTPException(status_code=404, detail="Match not found")
    if player_id not in ("1", "2", "3", "4"):
        raise HTTPException(status_code=400, detail="player_id must be 1, 2, 3, or 4")
    thumb_path = Path(row["output_dir"]) / "renders" / f"player_{player_id}_thumb.jpg"
    if not thumb_path.exists():
        raise HTTPException(status_code=404, detail="Player thumbnail not found")
    return FileResponse(thumb_path, media_type="image/jpeg")


@app.get("/matches/{match_id}/meta", tags=["reports"])
def get_match_meta(match_id: str) -> dict:
    row = db.get_match(match_id)
    if not row:
        raise HTTPException(status_code=404, detail="Match not found")
    meta_path = Path(row["output_dir"]) / "meta" / "meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Meta not found")
    return read_json(meta_path)


# ---- Cloud (R2) ----

def _r2_configured() -> bool:
    import os
    return bool(
        os.getenv("R2_ACCESS_KEY_ID")
        and os.getenv("R2_SECRET_ACCESS_KEY")
        and os.getenv("R2_BUCKET")
        and (os.getenv("R2_ACCOUNT_ID") or os.getenv("R2_ENDPOINT_URL"))
    )


@app.get("/matches/{match_id}/cloud/urls", tags=["cloud"])
def get_match_cloud_urls(
    match_id: str,
    expires_seconds: int = 3600,
) -> dict:
    """
    Return presigned URLs for highlights.mp4 and report.json in R2.
    Requires R2 to be configured. Works with or without local DB (for deployed stateless mode).
    """
    if not _r2_configured():
        raise HTTPException(
            status_code=503,
            detail="R2 not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ACCOUNT_ID in .env",
        )
    import os
    from src.cloud.upload import get_signed_url_for_key
    from src.cloud.storage_r2 import head_object
    bucket = os.getenv("R2_BUCKET")
    prefix = f"matches/{match_id}"
    out = {"highlights_url": None, "report_url": None, "heatmap_url": None}
    try:
        out["highlights_url"] = get_signed_url_for_key(
            f"{prefix}/highlights.mp4", expiration_seconds=expires_seconds
        )
    except Exception:
        pass
    try:
        out["report_url"] = get_signed_url_for_key(
            f"{prefix}/report.json", expiration_seconds=expires_seconds
        )
    except Exception:
        pass
    heatmap_key = f"{prefix}/heatmap.png"
    if bucket and head_object(bucket, heatmap_key):
        try:
            out["heatmap_url"] = get_signed_url_for_key(
                heatmap_key, expiration_seconds=expires_seconds
            )
        except Exception:
            pass
    return out


@app.post("/matches/{match_id}/cloud/upload", tags=["cloud"])
def post_match_cloud_upload(match_id: str) -> dict:
    """
    Upload this match's highlights.mp4 and report.json to R2.
    Returns keys and presigned URLs when R2 is configured.
    """
    if not db.get_match(match_id):
        raise HTTPException(status_code=404, detail="Match not found")
    if not _r2_configured():
        raise HTTPException(
            status_code=503,
            detail="R2 not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ACCOUNT_ID in .env",
        )
    from src.cloud.upload import upload_match_artifacts, get_signed_url_for_key
    result = upload_match_artifacts(match_id)
    # Attach short-lived URLs for convenience
    result["urls"] = {}
    for k in result.get("keys", []):
        try:
            result["urls"][k] = get_signed_url_for_key(k, expiration_seconds=3600)
        except Exception:
            result["urls"][k] = None
    return result


_web_dist = _react_dashboard_dist()
if _react_dashboard_built():
    from fastapi.staticfiles import StaticFiles

    app.mount(
        "/app",
        StaticFiles(directory=str(_web_dist), html=True),
        name="courtflow_react_ui",
    )
