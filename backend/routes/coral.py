"""
Endpoints de monitoreo coralino con datos Copernicus + NOAA + Claude.

GET /api/zona/{zona_id}/estado-completo
    → Temperatura, corrientes, salinidad, DHW, veda dinámica + alerta Claude

GET /api/zona/{zona_id}/forecast
    → Serie de 14 días: temp, DHW, corrientes, estado de veda por día (para slider)

GET /api/zonas
    → Lista de todas las zonas disponibles con sus coordenadas
"""

import os
import json
import asyncio
from fastapi import APIRouter, HTTPException
from pathlib import Path

from services.copernicus import (
    get_temperatura,
    get_corrientes,
    get_salinidad,
    get_forecast_14d,
)
from services.veda_dinamica import (
    calcular_veda,
    analizar_forecast_veda,
    ZONAS,
)

router = APIRouter(prefix="/api", tags=["coral"])

ROOT_DIR    = Path(__file__).resolve().parent.parent
REEFS_PATH  = ROOT_DIR / "data" / "reefs.json"

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _dhw_desde_reefs(zona_id: str) -> float:
    """Lee el DHW del reefs.json generado por noaa.js."""
    # Mapeo de zona_id (frontend) a slug (reefs.json)
    SLUG_MAP = {
        "los_cobanos":    None,          # no está en reefs.json aún
        "roatan":         "honduras",
        "cozumel":        "quintana_roo",
        "cayos_miskitos": "nicaragua",
    }
    slug = SLUG_MAP.get(zona_id)
    if not slug or not REEFS_PATH.exists():
        return 0.0
    try:
        reefs = json.loads(REEFS_PATH.read_text(encoding="utf-8"))
        for r in reefs:
            if r.get("slug") == slug:
                return float(r.get("datos", {}).get("dhw", 0.0))
    except Exception:
        pass
    return 0.0


async def _alerta_claude(payload: dict) -> str:
    """
    Llama a Claude via OpenRouter para traducir los datos a español simple
    para el pescador. Usa la misma clave que noaa.js.
    """
    key = os.getenv("OPENROUTER_KEY", "")
    if not key:
        return _alerta_fallback(payload)

    try:
        import httpx
        zona       = payload["zona"]
        temp       = payload["temperatura"]
        dhw        = payload["dhw"]
        veda       = payload["veda"]
        salinidad  = payload["salinidad"]

        prompt = f"""Eres un experto en arrecifes del Arrecife Mesoamericano.
Genera UNA alerta corta (máximo 3 oraciones) para un pescador artesanal de {zona}.
Usa lenguaje simple y directo. Menciona si puede pescar hoy o no.

Datos actuales:
- Temperatura del mar: {temp}°C
- DHW (estrés térmico): {dhw}
- Estado de veda: {veda['label']} — {veda['mensaje']}
- Salinidad: {salinidad['salinidad_psu']} PSU ({salinidad['interpretacion']})

Responde SOLO la alerta, sin JSON ni formato."""

        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": "anthropic/claude-sonnet-4-5",
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            data = r.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"[Claude] Error: {e}")
        return _alerta_fallback(payload)


def _alerta_fallback(payload: dict) -> str:
    veda = payload.get("veda", {})
    return f"Zona {payload.get('zona', '')}: {veda.get('mensaje', 'Sin datos disponibles.')}"


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/zonas")
def get_zonas():
    """Lista todas las zonas con coordenadas y nombre."""
    return [
        {"id": k, **{f: v for f, v in z.items()}}
        for k, z in ZONAS.items()
    ]


@router.get("/zona/{zona_id}/estado-completo")
async def get_estado_completo(zona_id: str):
    """
    Estado completo de una zona: temperatura, corrientes, salinidad,
    DHW (de reefs.json), veda dinámica y alerta Claude.
    """
    if zona_id not in ZONAS:
        raise HTTPException(
            status_code=404,
            detail=f"Zona '{zona_id}' no existe. Zonas disponibles: {list(ZONAS.keys())}",
        )

    coords = ZONAS[zona_id]
    lat, lon = coords["lat"], coords["lon"]

    # Obtener datos en paralelo (IO-bound)
    temperatura, corrientes, salinidad = await asyncio.gather(
        asyncio.to_thread(get_temperatura, lat, lon),
        asyncio.to_thread(get_corrientes,  lat, lon),
        asyncio.to_thread(get_salinidad,   lat, lon),
    )

    dhw  = _dhw_desde_reefs(zona_id)
    veda = calcular_veda(zona_id, dhw, corrientes)

    alerta = await _alerta_claude({
        "zona":        coords["nombre"],
        "temperatura": temperatura,
        "dhw":         dhw,
        "veda":        veda,
        "salinidad":   salinidad,
    })

    return {
        "zona":           zona_id,
        "nombre":         coords["nombre"],
        "pais":           coords["pais"],
        "coordenadas":    {"lat": lat, "lon": lon},
        "temperatura_c":  temperatura,
        "dhw":            dhw,
        "corrientes":     corrientes,
        "salinidad":      salinidad,
        "veda":           veda,
        "alerta_pescador": alerta,
    }


@router.get("/zona/{zona_id}/forecast")
async def get_forecast(zona_id: str):
    """
    Forecast de 14 días con estado de veda por día.
    Pensado para el slider del frontend.

    Retorna lista de 14 objetos:
      { dia, fecha, temperatura_c, dhw, corrientes, veda, es_forecast, es_extrapolado }
    """
    if zona_id not in ZONAS:
        raise HTTPException(status_code=404, detail=f"Zona '{zona_id}' no existe.")

    coords = ZONAS[zona_id]
    lat, lon = coords["lat"], coords["lon"]

    forecast_raw = await asyncio.to_thread(get_forecast_14d, lat, lon)
    forecast_con_veda = analizar_forecast_veda(zona_id, forecast_raw)

    return {
        "zona":     zona_id,
        "nombre":   coords["nombre"],
        "dias":     forecast_con_veda,
        "leyenda": {
            "es_forecast":    "Dato de modelo Copernicus anfc",
            "es_extrapolado": "Extrapolación lineal días 11-14",
        },
    }
