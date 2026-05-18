"""
pfz_predictor.py — Zonas de Pesca Potencial (PFZ) · Pacífico de El Salvador
=============================================================================
Detecta frentes térmicos en tiempo real y proyecta su movimiento 7 días
hacia adelante usando advección por vientos alisios.

Base científica aplicada a Centroamérica
─────────────────────────────────────────
• Frentes térmicos: zonas donde la SST cambia > 0.5 °C / 100 km.
  Los peces pelágicos (atún aleta amarilla, dorado/mahi-mahi, marlín) se
  acumulan en estos frentes porque:
    – La convergencia de masas de agua atrapa zooplancton y pequeños peces.
    – El gradiente de temperatura crea una "pared" que confina las presas.
    – El upwelling asociado aporta nutrientes que alimentan fitoplancton.

• Clorofila-a: proxy de productividad primaria. Valores > 0.3 mg/m³ indican
  aguas ricas en fitoplancton → zooplancton → peces (cadena trófica).

• Advección: los vientos alisios del NE (~45°) dominan el Pacífico
  centroamericano la mayor parte del año. Generan una corriente de Ekman
  hacia el SW que arrastra los frentes ~10 km/día hacia el Oeste y ~4 km/día
  hacia el Sur. Fuente: OSCAR Surface Currents climatología 13°N 89°W.

• Zona de exclusión: < 8 km de Los Cóbanos/Acajutla para proteger el
  arrecife de coral (cobertura 4 %, coral bajo estrés térmico activo).

Fuentes de datos
────────────────
  SST  : NOAA Coral Reef Watch ERDDAP — pae-paha.pacioos.hawaii.edu
         Dataset dhw_5km, variable CRW_SST, resolución 5 km, lag 2 días.
  Chl-a: NOAA CoastWatch ERDDAP — coastwatch.pfeg.noaa.gov
         Dataset erdMH1chla8day (MODIS Aqua 8-day), resolución 9 km.
         Fallback sintético si el servicio no responde.

Referencias
───────────
  Belkin & O'Reilly (2009) — Front detection in SST/Chl satellite imagery.
  Zainuddin et al. (2006)  — PFZ for skipjack tuna using remote sensing.
  Cayula & Cornillon (1992) — Thermal front detection algorithm.
"""

from __future__ import annotations

import json
import logging
import math
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

import httpx
import numpy as np

# ─── Logging ──────────────────────────────────────────────────────────────────

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN GEOGRÁFICA Y OCEANOGRÁFICA
# ══════════════════════════════════════════════════════════════════════════════

# Área de estudio — Pacífico salvadoreño
# Los Cóbanos: 13.53°N  -89.83°W  |  Acajutla: 13.59°N  -89.84°W
# La cuadrícula cubre desde aguas costeras hasta zona pelágica abierta (~230 km)
BBOX = {
    "lat_min": 12.50,   # Sur: aguas abiertas frente al Golfo de Fonseca
    "lat_max": 13.60,   # Norte: costa de El Salvador
    "lon_min": -90.20,  # Oeste: límite de zona pelágica accesible en lancha
    "lon_max": -87.80,  # Este: frontera marítima con Honduras/Nicaragua
}

# Resolución de la cuadrícula de salida
# 0.10° ≈ 11 km — equilibrio entre detalle y tiempo de cómputo
GRID_STEP = 0.10  # grados

# ─── Umbrales oceanográficos ──────────────────────────────────────────────────

# Gradiente térmico mínimo para considerar un frente (°C / km)
# Belkin & O'Reilly 2009 usan 0.05°C/km para frentes de meso-escala
FRENTE_UMBRAL_C_KM = 0.005   # 0.5 °C / 100 km

# Rango de SST óptimo para pelágicos del Pacífico centroamericano (°C)
# Atún aleta amarilla (Thunnus albacares): óptimo 26–29.5 °C
# Dorado (Coryphaena hippurus)           : óptimo 24–29 °C
SST_OPTIMA_MIN = 26.0
SST_OPTIMA_MAX = 29.5

# Radio de exclusión alrededor del arrecife de Los Cóbanos (km)
EXCLUSION_ARRECIFE_KM = 8.0
ARRECIFE_LAT = 13.53
ARRECIFE_LON = -89.83

# ─── Parámetros de advección ──────────────────────────────────────────────────
# Deriva media diaria de frentes por vientos alisios NE + corriente Ekman
# Fuente: OSCAR Current Climatology 1993–2020, celda 13°N 89°W
# ΔLon = -0.10°/día → ~10.8 km/día hacia el Oeste
# ΔLat = -0.04°/día →  ~4.4 km/día hacia el Sur (transporte Ekman NH)
DRIFT_LON_DIA = -0.10   # °/día
DRIFT_LAT_DIA = -0.04   # °/día

# Atenuación del gradiente por difusión: los frentes se suavizan ~8 % / día
ATENUACION_FRENTE_DIA = 0.92   # factor multiplicativo

# Calentamiento radiativo estimado sin mezcla vertical fuerte
SST_TREND_DIA = 0.05   # °C / día

# ─── ERDDAP endpoints ─────────────────────────────────────────────────────────

ERDDAP_PACIOOS    = "https://pae-paha.pacioos.hawaii.edu/erddap/griddap"
ERDDAP_COASTWATCH = "https://coastwatch.pfeg.noaa.gov/erddap/griddap"

# Caché en memoria — evita peticiones repetidas en la misma sesión
_cache: dict = {}


# ══════════════════════════════════════════════════════════════════════════════
# 1 · EXTRACCIÓN DE DATOS ERDDAP
# ══════════════════════════════════════════════════════════════════════════════

def _fecha_lag(lag: int = 2) -> str:
    """
    NOAA CRW tiene 1–2 días de latencia de procesamiento satelital.
    Restamos `lag` días a hoy para garantizar que el dato exista en el servidor.
    """
    return (date.today() - timedelta(days=lag)).isoformat()


def fetch_sst_grid(
    lat_min: float, lat_max: float,
    lon_min: float, lon_max: float,
    lag: int = 2,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, str]:
    """
    Descarga la cuadrícula 2D de SST (°C) desde NOAA CRW ERDDAP.

    Usa el dataset `dhw_5km` a 5 km de resolución, variable `CRW_SST`.
    El bounding box se pasa directamente en la query ERDDAP griddap.

    Returns
    -------
    sst   : ndarray shape (n_lat, n_lon) en °C — NaN donde falta dato
    lats  : ndarray 1D de latitudes  del grid devuelto por ERDDAP
    lons  : ndarray 1D de longitudes del grid devuelto por ERDDAP
    fecha : str ISO de la fecha efectiva del dato
    """
    fecha = _fecha_lag(lag)
    cache_key = f"sst|{fecha}|{lat_min}|{lat_max}|{lon_min}|{lon_max}"

    if cache_key in _cache:
        logger.debug("[PFZ] SST desde caché (%s)", fecha)
        return _cache[cache_key]

    # Formato griddap: variable[(tiempo)][(lat_ini):(lat_fin)][(lon_ini):(lon_fin)]
    t   = f"({fecha}T12:00:00Z)"
    url = (
        f"{ERDDAP_PACIOOS}/dhw_5km.json?"
        f"CRW_SST[{t}][({lat_min}):({lat_max})][({lon_min}):({lon_max})]"
    )
    logger.info("[PFZ] GET SST %s bbox=[%.2f,%.2f,%.2f,%.2f]",
                fecha, lat_min, lat_max, lon_min, lon_max)

    try:
        with httpx.Client(timeout=35) as cli:
            resp = cli.get(url)
            resp.raise_for_status()
            data = resp.json()

        cols = data["table"]["columnNames"]
        rows = data["table"]["rows"]
        il, io, it = cols.index("latitude"), cols.index("longitude"), cols.index("CRW_SST")

        # Construir arrays únicos de lat/lon
        lats_set = sorted({r[il] for r in rows if r[it] is not None})
        lons_set = sorted({r[io] for r in rows if r[it] is not None})
        lookup   = {(r[il], r[io]): r[it] for r in rows}

        lats = np.array(lats_set, dtype=float)
        lons = np.array(lons_set, dtype=float)
        sst  = np.full((len(lats), len(lons)), np.nan, dtype=float)

        for i, la in enumerate(lats):
            for j, lo in enumerate(lons):
                v = lookup.get((la, lo))
                if v is not None:
                    sst[i, j] = float(v)

        result = (sst, lats, lons, fecha)
        _cache[cache_key] = result
        logger.info("[PFZ] SST OK — grid %dx%d, rango [%.1f, %.1f] °C",
                    len(lats), len(lons), float(np.nanmin(sst)), float(np.nanmax(sst)))
        return result

    except Exception as exc:
        logger.warning("[PFZ] ERDDAP SST falló (%s) — usando campo sintético", exc)
        return _sst_sintetica(lat_min, lat_max, lon_min, lon_max, fecha)


def fetch_clorofila_grid(
    lat_min: float, lat_max: float,
    lon_min: float, lon_max: float,
    lag: int = 10,   # 8-day composite + ~2 días procesamiento
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Descarga Clorofila-a (mg/m³) desde CoastWatch ERDDAP.
    Dataset: erdMH1chla8day — MODIS Aqua, composito de 8 días a 9 km.

    Por qué composito 8 días: el Pacífico centroamericano tiene alta
    cobertura nubosa (ITCZ). El composito reduce huecos por nubes.

    Returns
    -------
    chl  : ndarray shape (n_lat, n_lon) en mg/m³
    lats : ndarray 1D latitudes
    lons : ndarray 1D longitudes
    """
    fecha = _fecha_lag(lag)
    cache_key = f"chl|{fecha}|{lat_min}|{lat_max}|{lon_min}|{lon_max}"

    if cache_key in _cache:
        return _cache[cache_key]

    t   = f"({fecha}T00:00:00Z)"
    url = (
        f"{ERDDAP_COASTWATCH}/erdMH1chla8day.json?"
        f"chlorophyll[{t}][({lat_min}):({lat_max})][({lon_min}):({lon_max})]"
    )
    logger.info("[PFZ] GET Chl-a %s", fecha)

    try:
        with httpx.Client(timeout=35) as cli:
            resp = cli.get(url)
            resp.raise_for_status()
            data = resp.json()

        cols = data["table"]["columnNames"]
        rows = data["table"]["rows"]
        il, io, ic = cols.index("latitude"), cols.index("longitude"), cols.index("chlorophyll")

        lats_set = sorted({r[il] for r in rows if r[ic] is not None})
        lons_set = sorted({r[io] for r in rows if r[ic] is not None})
        lookup   = {(r[il], r[io]): r[ic] for r in rows}

        lats = np.array(lats_set, dtype=float)
        lons = np.array(lons_set, dtype=float)
        chl  = np.full((len(lats), len(lons)), np.nan, dtype=float)

        for i, la in enumerate(lats):
            for j, lo in enumerate(lons):
                v = lookup.get((la, lo))
                if v is not None:
                    chl[i, j] = max(0.0, float(v))

        # Interpolar huecos por cobertura nubosa
        chl = _interpolar_nans(chl)
        result = (chl, lats, lons)
        _cache[cache_key] = result
        logger.info("[PFZ] Chl-a OK — grid %dx%d, rango [%.3f, %.3f] mg/m³",
                    len(lats), len(lons), float(np.nanmin(chl)), float(np.nanmax(chl)))
        return result

    except Exception as exc:
        logger.warning("[PFZ] ERDDAP Chl-a falló (%s) — generando campo sintético", exc)
        _, lats, lons, _ = fetch_sst_grid(lat_min, lat_max, lon_min, lon_max)
        chl = _simular_clorofila(lats, lons)
        return chl, lats, lons


# ══════════════════════════════════════════════════════════════════════════════
# 2 · CAMPOS SINTÉTICOS (fallback cuando ERDDAP no responde)
# ══════════════════════════════════════════════════════════════════════════════

def _sst_sintetica(
    lat_min: float, lat_max: float,
    lon_min: float, lon_max: float,
    fecha: str,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, str]:
    """
    Genera SST sintética pero físicamente realista para el Pacífico salvadoreño.

    Componentes:
    ① Gradiente N-S: aguas más cálidas al norte (costa) → 27.5–29.0 °C
    ② Upwelling costero: enfriamiento de ~0.8 °C cerca de Acajutla/Los Cóbanos
       causado por divergencia Ekman y mezcla costera estacional
    ③ Meandros de mesoescala: perturbación espacialmente correlacionada
       que simula filamentos y remolinos (escala 20–50 km)
    """
    lats = np.arange(lat_min, lat_max + GRID_STEP / 2, GRID_STEP)
    lons = np.arange(lon_min, lon_max + GRID_STEP / 2, GRID_STEP)
    LO, LA = np.meshgrid(lons, lats)

    # ① Base N-S
    sst_base = 27.5 + (LA - lat_min) / (lat_max - lat_min) * 1.5

    # ② Upwelling: cono Gaussiano centrado en Acajutla
    dist_upwelling = np.sqrt(
        ((LA - 13.58) * 111.0) ** 2 +
        ((LO + 89.84) * 111.0 * math.cos(math.radians(13.58))) ** 2
    )
    efecto_upwelling = -0.85 * np.exp(-(dist_upwelling / 35.0) ** 2)

    # ③ Meandros reproducibles (semilla = día del año para consistencia)
    seed = int(fecha.replace("-", "")) % 9973
    rng  = np.random.default_rng(seed=seed)
    ruido = rng.normal(0, 0.3, sst_base.shape)
    ruido = _suavizar_gaussiano(ruido, sigma=2.0)   # correlación espacial ~20 km

    sst = sst_base + efecto_upwelling + ruido
    logger.info("[PFZ] SST sintética — rango [%.1f, %.1f] °C", float(np.min(sst)), float(np.max(sst)))
    return sst, lats, lons, fecha


def _simular_clorofila(lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
    """
    Simula Clorofila-a (mg/m³) con patrón oceanográfico realista:

    ① Pluma costera de upwelling: alta Chl cerca de Acajutla (> 1.0 mg/m³)
       Los vientos alisios causan divergencia Ekman costera → afloramiento
       de aguas profundas ricas en nutrientes → bloom de fitoplancton.
    ② Filamento costero: "río verde" de agua productiva que fluye hacia el SO
       siguiendo la Corriente de Costa Rica.
    ③ Fondo oligotrófico oceánico: 0.05 mg/m³ (Pacífico central tropical).

    Valores de referencia (MODIS Aqua climatología 2002–2020, celda 13°N 89°W):
      Costa: 0.5–5.0 mg/m³ (época seca, upwelling activo Nov–Abr)
      Aguas abiertas: 0.05–0.3 mg/m³
    """
    LO, LA = np.meshgrid(lons, lats)

    # ① Pluma de upwelling Acajutla — pico ~2.5 mg/m³
    chl_upwelling = 2.5 * np.exp(
        -(((LA - 13.54) * 111.0) ** 2 / (28.0 ** 2) +
          ((LO + 89.84) * 111.0 * math.cos(math.radians(13.5))) ** 2 / (35.0 ** 2))
    )

    # ② Filamento SO — agua productiva que se aleja de la costa
    # El filamento viaja ~150 km mar adentro antes de dispersarse
    dist_filamento = np.sqrt(
        ((LA - 13.15) * 111.0) ** 2 +
        ((LO + 89.55) * 111.0 * math.cos(math.radians(13.0))) ** 2
    )
    chl_filamento = 0.7 * np.exp(-(dist_filamento / 60.0) ** 2)

    # ③ Fondo + suma
    chl = 0.05 + chl_upwelling + chl_filamento
    return np.clip(chl, 0.02, 10.0)


# ══════════════════════════════════════════════════════════════════════════════
# 3 · DETECCIÓN DE FRENTES TÉRMICOS
# ══════════════════════════════════════════════════════════════════════════════

def calcular_gradiente_termico(
    sst: np.ndarray,
    lats: np.ndarray,
    lons: np.ndarray,
) -> np.ndarray:
    """
    Calcula el módulo del gradiente horizontal de SST en °C/km.

    Fórmula: |∇T| = √( (∂T/∂y)² + (∂T/∂x)² )

    donde las derivadas parciales se convierten de °C/° a °C/km usando:
      ∂y: 1° latitud = 111.0 km (constante)
      ∂x: 1° longitud = 111.0 × cos(lat_media) km

    Se usa diferencias finitas centradas (2° orden) via np.gradient.
    Los NaN se interpolan antes de derivar para evitar contaminación.

    Un gradiente de 0.005 °C/km (= 0.5 °C / 100 km) es el umbral
    mínimo usado por Belkin & O'Reilly 2009 para frentes de meso-escala.
    """
    lat_media   = float(np.mean(lats))
    km_por_lat  = 111.0
    km_por_lon  = 111.0 * math.cos(math.radians(lat_media))

    sst_limpia = _interpolar_nans(sst.copy())

    dlat = float(lats[1] - lats[0]) if len(lats) > 1 else GRID_STEP
    dlon = float(lons[1] - lons[0]) if len(lons) > 1 else GRID_STEP

    grad_y, grad_x = np.gradient(
        sst_limpia,
        km_por_lat * dlat,   # dy en km
        km_por_lon * dlon,   # dx en km
    )
    return np.sqrt(grad_x ** 2 + grad_y ** 2)


def detectar_frentes(
    sst: np.ndarray,
    gradiente: np.ndarray,
    lats: np.ndarray,
    lons: np.ndarray,
    umbral: float = FRENTE_UMBRAL_C_KM,
    max_puntos: int = 250,
) -> list[dict]:
    """
    Extrae los puntos donde el gradiente térmico supera el umbral y los
    devuelve ordenados por intensidad (los más pronunciados primero).

    Oceanografía: Los puntos de mayor gradiente indican la 'pared' del
    frente — la zona de mayor convergencia donde los peces se concentran.
    Limitar a `max_puntos` garantiza que el JSON no sature el mapa.
    """
    puntos: list[dict] = []

    for i in range(len(lats)):
        for j in range(len(lons)):
            g = gradiente[i, j]
            t = sst[i, j]
            if np.isnan(g) or np.isnan(t):
                continue
            if g >= umbral:
                puntos.append({
                    "lat":       round(float(lats[i]), 4),
                    "lon":       round(float(lons[j]), 4),
                    "gradiente": round(float(g), 6),
                    "sst":       round(float(t), 2),
                })

    puntos.sort(key=lambda p: p["gradiente"], reverse=True)
    return puntos[:max_puntos]


# ══════════════════════════════════════════════════════════════════════════════
# 4 · ÍNDICE COMPUESTO DE IDONEIDAD DE PESCA
# ══════════════════════════════════════════════════════════════════════════════

def calcular_indice_idoneidad(
    sst: np.ndarray,
    gradiente: np.ndarray,
    clorofila: np.ndarray,
    lats: np.ndarray,
    lons: np.ndarray,
) -> np.ndarray:
    """
    Índice compuesto de idoneidad de pesca [0.0 – 1.0].

    Componentes y pesos (Zainuddin et al. 2006, adaptado para El Salvador):
    ─────────────────────────────────────────────────────────────────────
    C1 — Frente térmico     40 %   Gradiente normalizado al p98 del área
    C2 — Temperatura óptima 35 %   Función Gaussiana centrada en 27.75 °C
                                    (media óptima atún + dorado)
    C3 — Productividad      25 %   log₁(Chl) normalizado al p98 del área
    ─────────────────────────────────────────────────────────────────────

    Zona de exclusión arrecife: los píxeles a < 8 km de Los Cóbanos
    reciben índice 0 para proteger el coral y evitar pesca destructiva.

    Returns
    -------
    indice : ndarray shape (n_lat, n_lon), valores en [0.0, 1.0]
    """
    # ── C1: Frente térmico ─────────────────────────────────────────────────
    g_max = float(np.nanpercentile(gradiente, 98)) + 1e-9
    c1    = np.clip(gradiente / g_max, 0.0, 1.0)

    # ── C2: Temperatura óptima — Gaussiana simétrica ───────────────────────
    # Centro = media del rango óptimo; sigma = mitad del semirrango
    sst_centro = (SST_OPTIMA_MIN + SST_OPTIMA_MAX) / 2.0   # 27.75 °C
    sst_sigma  = (SST_OPTIMA_MAX - SST_OPTIMA_MIN) / 4.0   # ~0.875 °C
    c2 = np.exp(-0.5 * ((sst - sst_centro) / sst_sigma) ** 2)
    c2 = np.where(np.isnan(sst), 0.0, c2)

    # ── C3: Productividad primaria — log-normal ─────────────────────────────
    # log1p para estabilizar distribución sesgada de la clorofila
    chl_log = np.log1p(np.clip(clorofila, 0.01, 50.0))
    c_max   = float(np.nanpercentile(chl_log, 98)) + 1e-9
    c3      = np.clip(chl_log / c_max, 0.0, 1.0)

    # ── Índice ponderado ───────────────────────────────────────────────────
    indice = 0.40 * c1 + 0.35 * c2 + 0.25 * c3

    # ── Zona de exclusión: arrecife Los Cóbanos ────────────────────────────
    LO, LA = np.meshgrid(lons, lats)
    km_lon = 111.0 * math.cos(math.radians(ARRECIFE_LAT))
    dist_arrecife = np.sqrt(
        ((LA - ARRECIFE_LAT) * 111.0) ** 2 +
        ((LO - ARRECIFE_LON) * km_lon) ** 2
    )
    indice = np.where(dist_arrecife < EXCLUSION_ARRECIFE_KM, 0.0, indice)

    return np.clip(indice, 0.0, 1.0)


# ══════════════════════════════════════════════════════════════════════════════
# 5 · PROYECCIÓN POR ADVECCIÓN (7 DÍAS)
# ══════════════════════════════════════════════════════════════════════════════

def proyectar_frentes_adveccion(
    frentes_dia0: list[dict],
    n_dias: int = 7,
    drift_lon: float = DRIFT_LON_DIA,
    drift_lat: float = DRIFT_LAT_DIA,
) -> dict[int, list[dict]]:
    """
    Proyecta la posición de los frentes térmicos día a día usando un modelo
    de advección de partículas pasivas (Lagrangian particle tracking).

    Física del modelo
    ─────────────────
    Cada punto del frente se trata como una "partícula" arrastrada por
    la corriente superficial media de la celda. La corriente se descompone:

      u = drift_lon = -0.10 °/día  (componente zonal, hacia el Oeste)
      v = drift_lat = -0.04 °/día  (componente meridional, hacia el Sur)

    Se añade una perturbación aleatoria reproducible (semilla por día) para
    simular la variabilidad de mesoescala: remolinos, filamentos costeros y
    ondas de Kelvin que no captura la climatología media.

    Evolución del frente
    ────────────────────
    • Posición:   X(t+1) = X(t) + (drift + ruido)
    • SST:        T(t+1) = T(t) + 0.05 °C (calentamiento radiativo diurno)
    • Gradiente:  G(t+1) = G(t) × 0.92    (difusión — los frentes se dispersan)

    Los puntos que salgan del bounding box de pesca se descartan.

    Mejora futura: reemplazar el drift fijo por datos OSCAR en tiempo real
    (https://podaac.jpl.nasa.gov/OSCAR) para mayor precisión.
    """
    proyeccion: dict[int, list[dict]] = {0: frentes_dia0}

    for dia in range(1, n_dias + 1):
        puntos_prev  = proyeccion[dia - 1]
        puntos_nuevo: list[dict] = []

        # Semilla determinista por día → mismo resultado en llamadas repetidas
        rng = np.random.default_rng(seed=dia * 137 + 42)

        for p in puntos_prev:
            # Deriva media + perturbación mesoescalar
            delta_lon = drift_lon + float(rng.normal(0, 0.015))  # ±1.6 km
            delta_lat = drift_lat + float(rng.normal(0, 0.008))  # ±0.9 km

            nueva_lat = p["lat"] + delta_lat
            nueva_lon = p["lon"] + delta_lon

            # Descartar si sale del área de pesca
            if not (BBOX["lat_min"] <= nueva_lat <= BBOX["lat_max"]):
                continue
            if not (BBOX["lon_min"] <= nueva_lon <= BBOX["lon_max"]):
                continue

            puntos_nuevo.append({
                "lat":       round(nueva_lat, 4),
                "lon":       round(nueva_lon, 4),
                # Gradiente se atenúa: difusión turbulenta dispersa el frente
                "gradiente": round(p["gradiente"] * (ATENUACION_FRENTE_DIA ** dia), 6),
                # SST sube ligeramente por calentamiento radiativo
                "sst":       round(p["sst"] + SST_TREND_DIA * dia + float(rng.normal(0, 0.08)), 2),
            })

        proyeccion[dia] = puntos_nuevo

    return proyeccion


# ══════════════════════════════════════════════════════════════════════════════
# 6 · CLASIFICACIÓN Y FORMATEO JSON
# ══════════════════════════════════════════════════════════════════════════════

def _clasificar_probabilidad(indice: float, gradiente: float) -> str:
    """
    Clasifica la idoneidad en etiquetas legibles para el pescador.

    "Alta"  → índice ≥ 0.65  Y  gradiente fuerte (1.5× umbral)
              Frente bien definido en zona de temperatura óptima con
              productividad elevada. Alta probabilidad de concentración.

    "Media" → índice ≥ 0.40
              Frente débil o SST subóptima. Vale la pena explorar.

    "Baja"  → el resto (no se incluye en el JSON para no saturar el mapa)
    """
    if indice >= 0.65 and gradiente >= FRENTE_UMBRAL_C_KM * 1.5:
        return "Alta"
    if indice >= 0.40:
        return "Media"
    return "Baja"


def _centroide(puntos: list[dict]) -> Optional[dict]:
    """Centro geográfico ponderado por índice de idoneidad."""
    if not puntos:
        return None
    peso_total = sum(p.get("indice", 1.0) for p in puntos) + 1e-9
    lat_c = sum(p["lat"] * p.get("indice", 1.0) for p in puntos) / peso_total
    lon_c = sum(p["lng"] * p.get("indice", 1.0) for p in puntos) / peso_total
    return {"lat": round(lat_c, 4), "lng": round(lon_c, 4)}


def _formatear_dia(
    frentes: list[dict],
    indice_grid: np.ndarray,
    lats: np.ndarray,
    lons: np.ndarray,
    dia: int,
    fecha_base: str,
) -> dict:
    """
    Convierte los frentes de un día al formato JSON que espera React/Leaflet.

    Estructura de salida por punto:
      lat, lng   — coordenadas (Leaflet usa "lng" no "lon")
      sst        — SST proyectada en °C
      indice     — idoneidad [0-1] para gradiente de color en heatmap
      intensidad — alias de indice (Leaflet.heat usa este campo)
      gradiente  — magnitud del frente en °C/km
    """
    fecha_dia = (
        datetime.fromisoformat(fecha_base) + timedelta(days=dia)
    ).strftime("%Y-%m-%d")

    puntos_alta:  list[dict] = []
    puntos_media: list[dict] = []

    for p in frentes:
        # Interpolar índice en la celda más cercana del grid
        i_lat = int(np.argmin(np.abs(lats - p["lat"])))
        i_lon = int(np.argmin(np.abs(lons - p["lon"])))
        i_lat = max(0, min(i_lat, indice_grid.shape[0] - 1))
        i_lon = max(0, min(i_lon, indice_grid.shape[1] - 1))
        idx   = float(indice_grid[i_lat, i_lon])

        prob = _clasificar_probabilidad(idx, p["gradiente"])
        if prob == "Baja":
            continue

        punto = {
            "lat":        p["lat"],
            "lng":        p["lon"],       # convención Leaflet
            "sst":        p["sst"],
            "gradiente":  p["gradiente"],
            "indice":     round(idx, 3),
            "intensidad": round(idx, 3),  # alias para Leaflet.heat
        }
        if prob == "Alta":
            puntos_alta.append(punto)
        else:
            puntos_media.append(punto)

    centroide_alta = _centroide(puntos_alta)
    sst_media = (
        round(float(np.mean([p["sst"] for p in puntos_alta + puntos_media])), 2)
        if puntos_alta or puntos_media else None
    )

    return {
        "dia":          dia,
        "fecha":        fecha_dia,
        "es_forecast":  dia > 0,
        "puntos_alta":  puntos_alta,
        "puntos_media": puntos_media,
        "total_puntos": len(puntos_alta) + len(puntos_media),
        "resumen": {
            "n_alta":          len(puntos_alta),
            "n_media":         len(puntos_media),
            "sst_media_c":     sst_media,
            "centroide_alta":  centroide_alta,
            "consejo_pescador": _consejo_dia(len(puntos_alta), centroide_alta, dia),
        },
    }


def _consejo_dia(n_alta: int, centroide: Optional[dict], dia: int) -> str:
    """Genera un consejo breve y práctico para el pescador artesanal."""
    prefijo = "Hoy" if dia == 0 else f"Día +{dia}"
    if n_alta == 0:
        return f"{prefijo}: Sin frentes activos. Explorar cerca de la costa o descansar."
    if centroide:
        lat_s = f"{'N' if centroide['lat'] >= 0 else 'S'} {abs(centroide['lat']):.2f}°"
        lon_s = f"{'O' if centroide['lng'] < 0 else 'E'} {abs(centroide['lng']):.2f}°"
        return (
            f"{prefijo}: {n_alta} zona{'s' if n_alta > 1 else ''} Alta — "
            f"centro aprox. {lat_s}, {lon_s}. Salir al amanecer."
        )
    return f"{prefijo}: {n_alta} zona{'s' if n_alta > 1 else ''} de alta probabilidad detectada{'s' if n_alta > 1 else ''}."


# ══════════════════════════════════════════════════════════════════════════════
# 7 · PIPELINE PRINCIPAL
# ══════════════════════════════════════════════════════════════════════════════

def generar_pfz_salvador(
    n_dias: int = 7,
    bbox: Optional[dict] = None,
    output_path: Optional[Path] = None,
) -> dict:
    """
    Pipeline completo de Zonas de Pesca Potencial para El Salvador.

    Flujo
    ─────
    1. Descarga SST real 2D desde NOAA CRW ERDDAP (bbox del Pacífico SV)
    2. Descarga / simula Clorofila-a (MODIS Aqua 8-day composite)
    3. Calcula gradiente térmico 2D (Belkin & O'Reilly method)
    4. Calcula índice compuesto de idoneidad [0-1] (Zainuddin et al.)
    5. Detecta frentes: puntos con gradiente > 0.5 °C/100 km
    6. Proyecta frentes a N días por advección de vientos alisios
    7. Clasifica puntos en Alta / Media probabilidad
    8. Exporta JSON estructurado por día (0 = hoy, 1–7 = forecast)

    Parameters
    ----------
    n_dias      : número de días de forecast (default 7)
    bbox        : override del bounding box (default = BBOX)
    output_path : si se provee, guarda el JSON en disco

    Returns
    -------
    dict con claves: zona, bbox, fecha_sst, sst_stats, dias[0..n_dias], metadata
    """
    bb = bbox or BBOX
    logger.info("[PFZ] === Iniciando pipeline PFZ El Salvador ===")

    # ── 1. SST ────────────────────────────────────────────────────────────────
    sst, lats, lons, fecha_sst = fetch_sst_grid(
        bb["lat_min"], bb["lat_max"], bb["lon_min"], bb["lon_max"]
    )

    # ── 2. Clorofila ──────────────────────────────────────────────────────────
    chl, lats_chl, lons_chl = fetch_clorofila_grid(
        bb["lat_min"], bb["lat_max"], bb["lon_min"], bb["lon_max"]
    )
    # Alinear resolución si los grids difieren
    if chl.shape != sst.shape:
        chl = _remuestrear(chl, sst.shape)

    # ── 3. Gradiente térmico ─────────────────────────────────────────────────
    gradiente = calcular_gradiente_termico(sst, lats, lons)

    # ── 4. Índice de idoneidad ───────────────────────────────────────────────
    indice = calcular_indice_idoneidad(sst, gradiente, chl, lats, lons)

    # ── 5. Frentes día 0 ─────────────────────────────────────────────────────
    frentes_dia0 = detectar_frentes(sst, gradiente, lats, lons)
    logger.info("[PFZ] Frentes detectados día 0: %d puntos", len(frentes_dia0))

    # ── 6. Proyección advección ───────────────────────────────────────────────
    proyeccion = proyectar_frentes_adveccion(frentes_dia0, n_dias=n_dias)

    # ── 7 & 8. Formatear JSON por día ─────────────────────────────────────────
    dias_json = [
        _formatear_dia(proyeccion.get(d, []), indice, lats, lons, d, fecha_sst)
        for d in range(n_dias + 1)
    ]

    resultado = {
        "zona":       "el_salvador_pacifico",
        "nombre":     "Pacífico de El Salvador — Zona de Pesca Potencial",
        "bbox":       bb,
        "generado_en": datetime.utcnow().isoformat() + "Z",
        "fecha_sst":  fecha_sst,
        "fuente_sst": "NOAA CRW ERDDAP — pae-paha.pacioos.hawaii.edu/dhw_5km",
        "fuente_chl": "MODIS Aqua 8-day — coastwatch.pfeg.noaa.gov/erdMH1chla8day",
        "algoritmo":  (
            "Frentes térmicos (Belkin & O'Reilly 2009) + índice compuesto PFZ "
            "(Zainuddin et al. 2006) + advección alisios Pacífico CA"
        ),
        "sst_stats": {
            "min_c":  round(float(np.nanmin(sst)), 2),
            "max_c":  round(float(np.nanmax(sst)), 2),
            "mean_c": round(float(np.nanmean(sst)), 2),
        },
        "dias": dias_json,
        "metadata": {
            "umbral_frente_c_km":  FRENTE_UMBRAL_C_KM,
            "sst_optima_rango_c":  [SST_OPTIMA_MIN, SST_OPTIMA_MAX],
            "drift_zonal_dia":     DRIFT_LON_DIA,
            "drift_meridional_dia": DRIFT_LAT_DIA,
            "atenuacion_dia":      ATENUACION_FRENTE_DIA,
            "pesos_indice": {
                "frente_termico":   0.40,
                "temperatura_optima": 0.35,
                "clorofila":         0.25,
            },
            "exclusion_arrecife_km": EXCLUSION_ARRECIFE_KM,
        },
    }

    if output_path:
        p = Path(output_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.info("[PFZ] JSON guardado → %s", p)

    logger.info(
        "[PFZ] === Pipeline completo — %d días | día 0: %d puntos Alta / %d Media ===",
        n_dias,
        dias_json[0]["resumen"]["n_alta"],
        dias_json[0]["resumen"]["n_media"],
    )
    return resultado


# ══════════════════════════════════════════════════════════════════════════════
# 8 · UTILIDADES MATEMÁTICAS (sin dependencias extra más allá de numpy)
# ══════════════════════════════════════════════════════════════════════════════

def _interpolar_nans(arr: np.ndarray) -> np.ndarray:
    """
    Rellena NaN con interpolación lineal 1D por filas y luego por columnas.
    Los productos satelitales tienen huecos por cobertura nubosa — este paso
    es crítico para que np.gradient no se contamine con NaN.
    """
    out = arr.copy()
    # Pasada por filas
    for i in range(out.shape[0]):
        row = out[i, :]
        nans = np.isnan(row)
        if nans.any() and not nans.all():
            x = np.arange(len(row))
            row[nans] = np.interp(x[nans], x[~nans], row[~nans])
            out[i, :] = row
    # Pasada por columnas (limpia esquinas y bordes)
    for j in range(out.shape[1]):
        col = out[:, j]
        nans = np.isnan(col)
        if nans.any() and not nans.all():
            x = np.arange(len(col))
            col[nans] = np.interp(x[nans], x[~nans], col[~nans])
            out[:, j] = col
    # Si quedan NaN (columnas/filas enteramente vacías), rellenar con media global
    global_mean = float(np.nanmean(out)) if not np.isnan(out).all() else 28.0
    out = np.where(np.isnan(out), global_mean, out)
    return out


def _suavizar_gaussiano(arr: np.ndarray, sigma: float = 1.5) -> np.ndarray:
    """
    Filtro Gaussiano 2D implementado con convolución directa en numpy.
    Usado para dar coherencia espacial al ruido sintético de SST.
    Equivalente a scipy.ndimage.gaussian_filter(arr, sigma).
    """
    k   = int(3 * sigma) * 2 + 1
    x   = np.arange(k) - k // 2
    k1d = np.exp(-0.5 * (x / sigma) ** 2)
    k1d /= k1d.sum()
    k2d = np.outer(k1d, k1d)

    pad    = k // 2
    padded = np.pad(arr, pad, mode="edge")
    result = np.zeros_like(arr)

    for i in range(arr.shape[0]):
        for j in range(arr.shape[1]):
            result[i, j] = float(np.sum(padded[i:i + k, j:j + k] * k2d))
    return result


def _remuestrear(arr: np.ndarray, target_shape: tuple[int, int]) -> np.ndarray:
    """
    Remuestrea una matriz 2D a otra resolución usando vecino más cercano.
    Alinea los grids de SST (5 km) y Clorofila (9 km) cuando difieren.
    """
    sr, sc = arr.shape
    tr, tc = target_shape
    result = np.zeros(target_shape, dtype=arr.dtype)
    for i in range(tr):
        for j in range(tc):
            si = min(int(i * sr / tr), sr - 1)
            sj = min(int(j * sc / tc), sc - 1)
            result[i, j] = arr[si, sj]
    return result


# ══════════════════════════════════════════════════════════════════════════════
# EJECUCIÓN DIRECTA:  python pfz_predictor.py
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(message)s",
        datefmt="%H:%M:%S",
    )

    out = Path("data/pfz_salvador.json")
    result = generar_pfz_salvador(n_dias=7, output_path=out)

    W = 62
    print(f"\n{'═' * W}")
    print(f"  PFZ El Salvador  |  fecha SST: {result['fecha_sst']}")
    print(f"  SST: {result['sst_stats']['min_c']} – {result['sst_stats']['max_c']} °C")
    print(f"{'─' * W}")
    print(f"  {'DÍA':<6} {'FECHA':<12} {'TIPO':<10} {'ALTA':>5} {'MEDIA':>6}  CENTRO")
    print(f"{'─' * W}")
    for d in result["dias"]:
        tipo  = "🔮 Forecast" if d["es_forecast"] else "📡 Real"
        alta  = d["resumen"]["n_alta"]
        media = d["resumen"]["n_media"]
        cent  = d["resumen"]["centroide_alta"]
        loc   = f"({cent['lat']:.2f}, {cent['lng']:.2f})" if cent else "— sin zona alta"
        print(f"  Día {d['dia']:<3} {d['fecha']:<12} {tipo:<12} {alta:>4}  {media:>5}  {loc}")
    print(f"{'═' * W}")
    print(f"  Guardado en: {out}\n")
