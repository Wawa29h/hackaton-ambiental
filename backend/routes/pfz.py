"""
pfz.py — Endpoints de Zonas de Pesca Potencial (PFZ)
======================================================
Expone el algoritmo oceanográfico de frentes térmicos como API REST.

Rutas
─────
GET /api/pfz/salvador
    → JSON completo: frentes detectados hoy + forecast 7 días con advección
    → Incluye puntos Alta/Media, centroide, consejo al pescador
    → Se cachea 4 horas en disco para no saturar ERDDAP

GET /api/pfz/salvador/dia/{dia}
    → Solo el día indicado (0=hoy, 1-7=forecast)
    → Respuesta rápida — útil para el slider del frontend

GET /api/pfz/salvador/refresh
    → Fuerza recálculo ignorando caché (solo para admin/testing)
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from backend.services.pfz_predictor import generar_pfz_salvador, BBOX

router  = APIRouter(prefix="/api/pfz", tags=["pfz"])
logger  = logging.getLogger(__name__)

# ─── Caché en disco ────────────────────────────────────────────────────────────
# El JSON se regenera como máximo una vez cada 4 horas para no saturar ERDDAP.
ROOT_DIR    = Path(__file__).resolve().parents[2]
PFZ_CACHE   = ROOT_DIR / "data" / "pfz_salvador.json"
CACHE_TTL_H = 4   # horas


def _cache_valida() -> bool:
    """Devuelve True si el caché existe y tiene menos de CACHE_TTL_H horas."""
    if not PFZ_CACHE.exists():
        return False
    mtime    = datetime.fromtimestamp(PFZ_CACHE.stat().st_mtime, tz=timezone.utc)
    antiguedad = datetime.now(tz=timezone.utc) - mtime
    return antiguedad < timedelta(hours=CACHE_TTL_H)


def _leer_cache() -> dict:
    return json.loads(PFZ_CACHE.read_text(encoding="utf-8"))


def _generar_y_guardar() -> dict:
    return generar_pfz_salvador(n_dias=7, output_path=PFZ_CACHE)


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/salvador",
    summary="PFZ completa — 7 días de forecast para el Pacífico salvadoreño",
    response_description=(
        "JSON con frentes térmicos detectados (hoy) y proyectados (días 1-7). "
        "Cada día contiene arrays puntos_alta y puntos_media con lat/lng/sst/intensidad."
    ),
)
async def get_pfz_salvador(
    refresh: bool = Query(
        default=False,
        description="Si true, ignora el caché y recalcula desde ERDDAP"
    ),
):
    """
    Devuelve las Zonas de Pesca Potencial para el Pacífico de El Salvador.

    **Cómo usar en el frontend**:
    ```js
    // dia=0 → puntos reales de hoy
    // dia=1..7 → puntos proyectados por advección de vientos alisios
    const { dias } = await fetch('/api/pfz/salvador').then(r => r.json())
    const heatmapData = dias[sliderDia].puntos_alta
      .map(p => [p.lat, p.lng, p.intensidad])
    L.heatLayer(heatmapData, { radius: 30, blur: 25 }).addTo(map)
    ```

    **Lógica oceanográfica**: Los frentes térmicos (gradiente SST > 0.5°C/100km)
    se detectan con diferencias finitas centradas y se proyectan aplicando
    la deriva media de los vientos alisios NE del Pacífico centroamericano.
    """
    try:
        if refresh or not _cache_valida():
            logger.info("[PFZ API] Generando PFZ (refresh=%s, caché=%s)",
                        refresh, "inválido" if not _cache_valida() else "válido")
            data = _generar_y_guardar()
        else:
            logger.info("[PFZ API] Sirviendo desde caché")
            data = _leer_cache()
        return data

    except Exception as exc:
        logger.exception("[PFZ API] Error en pipeline PFZ: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Error al calcular PFZ: {exc}"
        ) from exc


@router.get(
    "/salvador/dia/{dia}",
    summary="PFZ de un día específico (0=hoy, 1-7=forecast)",
)
async def get_pfz_dia(
    dia: int,
    refresh: bool = Query(default=False),
):
    """
    Devuelve solo los datos del día solicitado.
    Más rápido que /salvador cuando el frontend solo necesita un día.
    """
    if not 0 <= dia <= 7:
        raise HTTPException(status_code=400, detail="dia debe estar entre 0 y 7")

    try:
        if refresh or not _cache_valida():
            data = _generar_y_guardar()
        else:
            data = _leer_cache()

        dias = data.get("dias", [])
        if dia >= len(dias):
            raise HTTPException(status_code=404, detail=f"Día {dia} no disponible")

        return {
            "zona":       data.get("zona"),
            "fecha_sst":  data.get("fecha_sst"),
            "generado_en": data.get("generado_en"),
            **dias[dia],
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[PFZ API] Error día %d: %s", dia, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get(
    "/salvador/refresh",
    summary="Fuerza recálculo completo ignorando caché",
)
async def refresh_pfz():
    """
    Regenera el JSON desde ERDDAP. Útil después de actualizar reefs.json
    o cuando se quiere forzar datos frescos antes de una presentación.
    """
    try:
        data = _generar_y_guardar()
        return {
            "ok":         True,
            "generado_en": data["generado_en"],
            "fecha_sst":  data["fecha_sst"],
            "dias":       len(data["dias"]),
            "puntos_alta_hoy": data["dias"][0]["resumen"]["n_alta"],
            "sst_media":  data["sst_stats"]["mean_c"],
        }
    except Exception as exc:
        logger.exception("[PFZ API] Error refresh: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
