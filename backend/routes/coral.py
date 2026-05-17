"""
Endpoints de monitoreo coralino con datos Copernicus + NOAA + Claude.

GET /api/zona/{zona_id}/estado-completo
    -> Temperatura, corrientes, salinidad, DHW, veda dinamica + alerta Claude

GET /api/zona/{zona_id}/prediccion-semanal
    -> 7 dias: DHW proyectado, zona de pesca por dia, mejor/peor dia + consejo Claude

GET /api/zona/{zona_id}/forecast
    -> Serie de 14 dias: temp, DHW, corrientes, estado de veda por dia

GET /api/zonas
    -> Lista de todas las zonas disponibles con sus coordenadas
"""

import os
import json
import math
import asyncio
import datetime
from fastapi import APIRouter, HTTPException
from pathlib import Path

from backend.services.copernicus import (
    get_temperatura,
    get_corrientes,
    get_salinidad,
    get_forecast_14d,
)
from backend.services.veda_dinamica import (
    calcular_veda,
    analizar_forecast_veda,
    ZONAS,
)
from backend.services.noaa_crw import (
    get_dato_actual,
    get_historial_30d,
    calcular_tendencia,
)

router = APIRouter(prefix="/api", tags=["coral"])

ROOT_DIR    = Path(__file__).resolve().parents[2]
REEFS_PATH  = ROOT_DIR / "data" / "reefs.json"

# â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _dhw_desde_reefs(zona_id: str) -> float:
    """Lee el DHW del reefs.json generado por noaa.js."""
    # Mapeo de zona_id (frontend) a slug (reefs.json)
    SLUG_MAP = {
        "los_cobanos":    None,          # no estÃ¡ en reefs.json aÃºn
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
    Llama a Claude via OpenRouter para traducir los datos a espaÃ±ol simple
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
Genera UNA alerta corta (mÃ¡ximo 3 oraciones) para un pescador artesanal de {zona}.
Usa lenguaje simple y directo. Menciona si puede pescar hoy o no.

Datos actuales:
- Temperatura del mar: {temp}Â°C
- DHW (estrÃ©s tÃ©rmico): {dhw}
- Estado de veda: {veda['label']} â€” {veda['mensaje']}
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


# â”€â”€â”€ Endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    DHW (de reefs.json), veda dinÃ¡mica y alerta Claude.
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
    Forecast de 14 dÃ­as con estado de veda por dÃ­a.
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
            "es_extrapolado": "ExtrapolaciÃ³n lineal dÃ­as 11-14",
        },
    }


# ─── Helpers prediccion semanal ───────────────────────────────────────────────

DIAS_ES = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]

def _estado_pesca_dhw(dhw: float) -> dict:
    if dhw > 8:
        return {"label":"VEDA",      "color":"#ef4444","permitida":False,"max_lanchas":0}
    if dhw > 4:
        return {"label":"LIMITADA",  "color":"#f97316","permitida":True, "max_lanchas":3}
    if dhw > 1:
        return {"label":"MODERADA",  "color":"#fbbf24","permitida":True, "max_lanchas":6}
    return     {"label":"PERMITIDA", "color":"#34d399","permitida":True, "max_lanchas":10}

def _zona_pesca_coords(lat: float, lon: float, corrientes: dict, dhw: float) -> dict:
    """Calcula coords y radio de la zona segura de pesca según corrientes del día."""
    dir_grados  = corrientes.get("direccion_grados", 95.0)
    vel_ms      = corrientes.get("velocidad_ms", 0.3)
    dist_km     = 9.0
    # Zona segura = sotavento (dirección opuesta a la corriente)
    rad  = math.radians((dir_grados + 180) % 360)
    g    = 1 / 111
    clat = lat + math.cos(rad) * dist_km * g
    clon = lon + math.sin(rad) * dist_km * g
    # Radio se reduce si DHW alto
    base_radio = 10000 if vel_ms < 0.2 else 7000 if vel_ms < 0.5 else 5000
    radio      = int(base_radio * 0.6) if dhw > 4 else base_radio
    return {"lat": round(clat, 4), "lon": round(clon, 4), "radio": radio}


def _baa_desde_dhw(dhw: float, baa_base: int = 0) -> int:
    """Estima BAA para la simulacion visual usando umbrales CRW/DHW."""
    if dhw >= 8:
        return 4
    if dhw >= 4:
        return max(3, baa_base)
    if dhw >= 2:
        return max(2, baa_base)
    if dhw >= 1:
        return max(1, baa_base)
    return max(0, min(baa_base, 1))


def _proyectar_dhw_7d(dhw_hoy: float, baa_hoy: int, tendencia_noaa: dict, forecast: list[dict]) -> list[dict]:
    """
    Proyeccion diaria 0-7 usando dos senales:
    - tendencia NOAA CRW 30 dias (pendiente DHW diaria)
    - acumulacion termica del forecast Copernicus (dhw_acumulado)
    """
    slope = float(tendencia_noaa.get("dhw_pendiente_diaria", 0) or 0)
    proyeccion = []
    for dia in range(8):
        idx = min(dia, max(0, len(forecast) - 1))
        f = forecast[idx] if forecast else {}
        dhw_noaa = dhw_hoy + slope * dia
        dhw_copernicus = dhw_hoy + float(f.get("dhw_acumulado", 0) or 0)
        dhw = max(0.0, (dhw_noaa * 0.55) + (dhw_copernicus * 0.45))
        baa = baa_hoy if dia == 0 else _baa_desde_dhw(dhw, baa_hoy)
        proyeccion.append({
            "dia": dia,
            "fecha": f.get("fecha") or (datetime.date.today() + datetime.timedelta(days=dia)).isoformat(),
            "dhw": round(dhw, 3),
            "baa": int(baa),
            "temperatura_c": f.get("temperatura_c"),
            "fuente": "NOAA CRW 30d + Copernicus forecast",
        })
    return proyeccion


async def _consejo_semanal_claude(zona: str, dias: list, mejor_idx: int, peor_idx: int, dhw_hoy: float) -> str:
    key = os.getenv("OPENROUTER_KEY", "")
    if not key:
        mejor = dias[mejor_idx]
        return (f"El mejor día para pescar esta semana es el {mejor['dia_semana']} "
                f"({mejor['fecha']}) con temperatura {mejor['temperatura_c']}°C y "
                f"DHW {mejor['dhw_proyectado']}. Evite el {dias[peor_idx]['dia_semana']}.")
    try:
        import httpx
        resumen = "\n".join(
            f"  {d['dia_semana']} {d['fecha']}: {d['temperatura_c']}°C, DHW {d['dhw_proyectado']}, "
            f"corrientes {d['corrientes']['descripcion']} {d['corrientes']['velocidad_ms']} m/s, "
            f"estado pesca: {d['estado_pesca']['label']}"
            for d in dias
        )
        prompt = f"""Eres experto en pesca responsable en el Arrecife Mesoamericano de {zona}.

Forecast próximos 7 días (Copernicus + DHW proyectado):
{resumen}

DHW actual: {dhw_hoy}
Mejor día calculado: {dias[mejor_idx]['dia_semana']}
Peor día calculado: {dias[peor_idx]['dia_semana']}

Genera un consejo concreto para el pescador artesanal (máximo 3 oraciones):
- Menciona el mejor día y hora de salida
- Menciona qué día evitar y por qué
- Un tip práctico según las corrientes o temperatura
Responde solo el consejo, sin formato."""

        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": "anthropic/claude-sonnet-4-5",
                      "messages": [{"role": "user", "content": prompt}]},
            )
            return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"[Claude semanal] {e}")
        return f"Mejor día: {dias[mejor_idx]['dia_semana']}. Evite el {dias[peor_idx]['dia_semana']}."


@router.get("/zona/{zona_id}/prediccion-semanal")
async def get_prediccion_semanal(zona_id: str):
    """
    Predicción de 7 días para pesca responsable y blanqueamiento.
    - Temperatura y corrientes: Copernicus forecast
    - DHW proyectado: acumulado desde hoy
    - Zona de pesca: calculada por corrientes de cada día
    - Consejo: Claude AI
    """
    if zona_id not in ZONAS:
        raise HTTPException(status_code=404, detail=f"Zona '{zona_id}' no existe.")

    coords  = ZONAS[zona_id]
    lat, lon = coords["lat"], coords["lon"]

    # Datos cientificos en paralelo:
    # - NOAA CRW actual + historial 30d para tendencia DHW
    # - Copernicus forecast 14d para temperatura/corrientes
    forecast_raw, noaa_actual, historial_30d = await asyncio.gather(
        asyncio.to_thread(get_forecast_14d, lat, lon),
        asyncio.to_thread(get_dato_actual, lat, lon),
        asyncio.to_thread(get_historial_30d, lat, lon),
    )
    tendencia_30d = calcular_tendencia(historial_30d)
    dhw_hoy       = float(noaa_actual.get("dhw") or _dhw_desde_reefs(zona_id))
    baa_hoy       = int(noaa_actual.get("baa") or noaa_actual.get("stress_level") or 0)
    proyeccion_diaria = _proyectar_dhw_7d(dhw_hoy, baa_hoy, tendencia_30d, forecast_raw)

    dias = []
    for d in forecast_raw[:7]:
        fecha_obj   = datetime.date.fromisoformat(d["fecha"])
        dia_semana  = DIAS_ES[fecha_obj.weekday()]
        proy        = proyeccion_diaria[min(d["dia"], 7)]
        dhw_proy    = proy["dhw"]
        corrientes  = d["corrientes"]
        estado      = _estado_pesca_dhw(dhw_proy)
        zona_coords = _zona_pesca_coords(lat, lon, corrientes, dhw_proy)

        dias.append({
            "dia":             d["dia"],
            "fecha":           d["fecha"],
            "dia_semana":      dia_semana,
            "temperatura_c":   d["temperatura_c"],
            "dhw_proyectado":  dhw_proy,
            "baa":             proy["baa"],
            "corrientes":      corrientes,
            "estado_pesca":    estado,
            "zona_pesca":      zona_coords,
            "es_forecast":     d.get("es_forecast", True),
        })

    # Mejor día = mínimo DHW + permitida; peor = máximo DHW
    permitidos  = [i for i, d in enumerate(dias) if d["estado_pesca"]["permitida"]]
    mejor_idx   = min(permitidos, key=lambda i: dias[i]["dhw_proyectado"]) if permitidos else 0
    peor_idx    = max(range(len(dias)), key=lambda i: dias[i]["dhw_proyectado"])

    # Probabilidad blanqueamiento ≈ % días con DHW > 4
    dias_riesgo = sum(1 for d in dias if d["dhw_proyectado"] > 4)
    prob_blanq  = round(dias_riesgo / len(dias) * 100)

    consejo = await _consejo_semanal_claude(coords["nombre"], dias, mejor_idx, peor_idx, dhw_hoy)

    return {
        "zona":                  zona_id,
        "nombre":                coords["nombre"],
        "dhw_hoy":               dhw_hoy,
        "baa_hoy":               baa_hoy,
        "tendencia_noaa_30d":     tendencia_30d,
        "proyeccion_diaria":      proyeccion_diaria,
        "dias":                  dias,
        "mejor_dia_idx":         mejor_idx,
        "peor_dia_idx":          peor_idx,
        "prob_blanqueamiento_7d": prob_blanq,
        "consejo_claude":        consejo,
    }
