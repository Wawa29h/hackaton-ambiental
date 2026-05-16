import json
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
REEFS_PATH = ROOT_DIR / "data" / "reefs.json"
NOAA_SCRIPT_PATH = ROOT_DIR / "noaa.js"

AlertColor = Literal["green", "yellow", "orange", "red"]

app = FastAPI(title="Mesoamerican Reef Monitoring API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MakeWebhookRequest(BaseModel):
    webhook_url: str


class CitizenReport(BaseModel):
    reef_id: str
    reporter_name: str | None = None
    description: str
    photo_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None


reports: list[dict[str, Any]] = []


def read_reefs_file() -> list[dict[str, Any]]:
    if not REEFS_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="No existe data/reefs.json. Ejecuta primero la actualizacion de datos.",
        )

    with REEFS_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def build_alert(reef: dict[str, Any]) -> tuple[int, AlertColor, str]:
    data = reef.get("datos", {})
    predictions = reef.get("predictions", {})
    sst = float(data.get("sst_max") or 0)
    dhw = float(data.get("dhw") or 0)
    stress_level = int(data.get("stress_level") or 0)
    baa_7day_max = int(data.get("baa_7day_max") or 0)

    if dhw >= 4 or stress_level >= 4 or baa_7day_max >= 4:
        level: int = 5
        color: AlertColor = "red"
    elif dhw >= 2 or stress_level >= 2 or baa_7day_max >= 2:
        level = 3
        color = "orange"
    elif dhw >= 1 or sst >= float(data.get("bleaching_threshold") or 99):
        level = 2
        color = "yellow"
    else:
        level = 1
        color = "green"

    message = predictions.get("alerta") or (
        f"{reef.get('nombre', 'Arrecife')}: SST={sst}C, DHW={dhw}."
    )
    return level, color, message


def to_frontend_reef(reef: dict[str, Any]) -> dict[str, Any]:
    data = reef.get("datos", {})
    coords = reef.get("coordenadas", {})
    level, color, message = build_alert(reef)

    return {
        **reef,
        "id": reef.get("slug"),
        "name": reef.get("nombre"),
        "latitude": coords.get("lat"),
        "longitude": coords.get("lon"),
        "sst": data.get("sst_max"),
        "dhw": data.get("dhw"),
        "alerta_nivel": level,
        "alerta_color": color,
        "alerta_pescador": message,
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }


def get_critical_alerts() -> list[dict[str, Any]]:
    reefs = [to_frontend_reef(reef) for reef in read_reefs_file()]
    critical_reefs = [reef for reef in reefs if reef["alerta_nivel"] >= 3]

    return [
        {
            "reef_id": reef["id"],
            "reef_name": reef["name"],
            "alerta_nivel": reef["alerta_nivel"],
            "message": reef["alerta_pescador"],
        }
        for reef in critical_reefs
    ]


@app.get("/")
def read_root():
    return {"status": "ok", "message": "API de Monitoreo Arrecifal Activa"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/reefs")
def get_reefs():
    return [to_frontend_reef(reef) for reef in read_reefs_file()]


@app.get("/reefs/raw")
def get_raw_reefs():
    return read_reefs_file()


@app.get("/reefs/{reef_id}")
def get_reef(reef_id: str):
    for reef in read_reefs_file():
        if reef.get("slug") == reef_id:
            return to_frontend_reef(reef)

    raise HTTPException(status_code=404, detail="Reef not found")


@app.post("/reefs/refresh")
def refresh_reefs():
    if not NOAA_SCRIPT_PATH.exists():
        raise HTTPException(status_code=404, detail="No existe noaa.js")

    result = subprocess.run(
        ["node", str(NOAA_SCRIPT_PATH)],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
        timeout=180,
    )

    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr or result.stdout)

    data = read_reefs_file()
    return {
        "ok": True,
        "actualizado": datetime.utcnow().isoformat() + "Z",
        "arrecifes": len(data),
    }


@app.get("/alerts/whatsapp")
def get_whatsapp_alerts():
    return get_critical_alerts()


@app.post("/alerts/send-to-make")
def send_alerts_to_make(payload: MakeWebhookRequest = Body(...)):
    alerts = get_critical_alerts()
    if not alerts:
        return {"sent": 0, "message": "No hay alertas nivel 3 o mayor."}

    sent_alerts = []
    for alert in alerts:
        try:
            response = httpx.post(payload.webhook_url, json=alert, timeout=10)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Make respondio {exc.response.status_code}. Revisa que el webhook exista y este activo.",
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"No se pudo enviar la alerta a Make: {exc}",
            ) from exc

        sent_alerts.append(alert["reef_id"])

    return {"sent": len(sent_alerts), "reef_ids": sent_alerts}


@app.post("/reports", status_code=201)
def create_report(report: CitizenReport):
    reef_ids = {reef.get("slug") for reef in read_reefs_file()}
    if report.reef_id not in reef_ids:
        raise HTTPException(status_code=404, detail="Reef not found")

    saved_report = {
        **report.model_dump(),
        "id": len(reports) + 1,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    reports.append(saved_report)
    return saved_report


@app.get("/reports")
def get_reports():
    return reports
