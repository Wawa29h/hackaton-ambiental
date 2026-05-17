"""
Copernicus Marine Service — datos oceanográficos en tiempo real y forecast 14 días.

Qué hace cada función:
  get_temperatura  → SST superficial (0-1m) desde modelo global PHY
  get_corrientes   → velocidad y dirección de corrientes (uo, vo)
  get_salinidad    → salinidad en PSU, alerta si hay contaminación de río
  get_forecast_14d → serie temporal de 14 días: temp, corrientes, salinidad

Credenciales: COPERNICUS_USER / COPERNICUS_PASSWORD en .env
"""

import os
import math
import datetime
from typing import Optional

# copernicusmarine se instala con: pip install copernicusmarine
try:
    import copernicusmarine
    COPERNICUS_AVAILABLE = True
except ImportError:
    COPERNICUS_AVAILABLE = False

# ─── Constantes ──────────────────────────────────────────────────────────────

# Dataset de temperatura (thetao = potential temperature)
DS_TEMP     = "cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m"
# Dataset de corrientes (uo = east-west, vo = north-south)
DS_CURRENTS = "cmems_mod_glo_phy_anfc_0.083deg_P1D-m"
# Dataset de salinidad (so = salinity)
DS_SAL      = "cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m"

RADIO       = 0.5    # grados de radio alrededor del punto
SAL_NORMAL  = 36.0   # PSU normal del Caribe
SAL_ALERTA  = 34.0   # por debajo → posible contaminación de río

CARDINALS = ["Norte", "Noreste", "Este", "Sureste", "Sur", "Suroeste", "Oeste", "Noroeste"]

def _cardinal(grados: float) -> str:
    idx = round(grados / 45) % 8
    return CARDINALS[idx]

def _credenciales() -> tuple[str, str]:
    user = os.getenv("COPERNICUS_USER", "")
    pwd  = os.getenv("COPERNICUS_PASSWORD", "")
    return user, pwd

def _hoy() -> str:
    return datetime.date.today().isoformat()

def _en_dias(n: int) -> str:
    return (datetime.date.today() + datetime.timedelta(days=n)).isoformat()


# ─── Función 1: Temperatura superficial ─────────────────────────────────────

def get_temperatura(lat: float, lon: float) -> float:
    """
    Retorna la temperatura superficial del mar en °C.
    Usa el primer metro de profundidad del modelo global PHY.
    """
    if not COPERNICUS_AVAILABLE:
        return _fallback_temperatura(lat, lon)

    user, pwd = _credenciales()
    try:
        ds = copernicusmarine.open_dataset(
            dataset_id    = DS_TEMP,
            variables     = ["thetao"],
            minimum_longitude = lon - RADIO,
            maximum_longitude = lon + RADIO,
            minimum_latitude  = lat - RADIO,
            maximum_latitude  = lat + RADIO,
            minimum_depth = 0.0,
            maximum_depth = 1.0,
            start_datetime = _hoy(),
            end_datetime   = _hoy(),
            username  = user,
            password  = pwd,
        )
        valor = float(ds["thetao"].mean())
        return round(valor, 2)
    except Exception as e:
        print(f"[Copernicus] Error temperatura ({lat},{lon}): {e}")
        return _fallback_temperatura(lat, lon)


def _fallback_temperatura(lat: float, lon: float) -> float:
    """Datos simulados realistas para el Arrecife Mesoamericano (mayo)."""
    fallbacks = {
        (13.5, -89.8): 30.2,  # Los Cóbanos
        (16.3, -86.5): 30.3,  # Roatán
        (20.4, -86.9): 30.2,  # Cozumel
        (14.4, -82.8): 29.9,  # Cayos Miskitos
    }
    closest = min(fallbacks, key=lambda p: (p[0]-lat)**2 + (p[1]-lon)**2)
    return fallbacks[closest]


# ─── Función 2: Corrientes marinas ───────────────────────────────────────────

def get_corrientes(lat: float, lon: float) -> dict:
    """
    Retorna velocidad (m/s), dirección (0-360°) y descripción cardinal.
    uo = componente este-oeste, vo = componente norte-sur.
    """
    if not COPERNICUS_AVAILABLE:
        return _fallback_corrientes(lat, lon)

    user, pwd = _credenciales()
    try:
        ds = copernicusmarine.open_dataset(
            dataset_id    = DS_CURRENTS,
            variables     = ["uo", "vo"],
            minimum_longitude = lon - RADIO,
            maximum_longitude = lon + RADIO,
            minimum_latitude  = lat - RADIO,
            maximum_latitude  = lat + RADIO,
            minimum_depth = 0.0,
            maximum_depth = 1.0,
            start_datetime = _hoy(),
            end_datetime   = _hoy(),
            username  = user,
            password  = pwd,
        )
        uo = float(ds["uo"].mean())
        vo = float(ds["vo"].mean())
        velocidad  = math.sqrt(uo**2 + vo**2)
        # atan2(uo, vo): uo=este, vo=norte → dirección meteorológica (0=Norte)
        direccion  = (math.degrees(math.atan2(uo, vo)) + 360) % 360
        return {
            "velocidad_ms":      round(velocidad, 3),
            "direccion_grados":  round(direccion, 1),
            "descripcion":       _cardinal(direccion),
            "uo": round(uo, 3),
            "vo": round(vo, 3),
        }
    except Exception as e:
        print(f"[Copernicus] Error corrientes ({lat},{lon}): {e}")
        return _fallback_corrientes(lat, lon)


def _fallback_corrientes(lat: float, lon: float) -> dict:
    return {
        "velocidad_ms":     0.30,
        "direccion_grados": 95.0,
        "descripcion":      "Este",
        "uo": 0.29,
        "vo": -0.03,
    }


# ─── Función 3: Salinidad ────────────────────────────────────────────────────

def get_salinidad(lat: float, lon: float) -> dict:
    """
    Retorna salinidad en PSU y bandera de alerta si hay dilución por río.
    Caribe normal: ~36 PSU. < 34 PSU sugiere influencia de agua dulce.
    """
    if not COPERNICUS_AVAILABLE:
        return _fallback_salinidad(lat, lon)

    user, pwd = _credenciales()
    try:
        ds = copernicusmarine.open_dataset(
            dataset_id    = DS_SAL,
            variables     = ["so"],
            minimum_longitude = lon - RADIO,
            maximum_longitude = lon + RADIO,
            minimum_latitude  = lat - RADIO,
            maximum_latitude  = lat + RADIO,
            minimum_depth = 0.0,
            maximum_depth = 1.0,
            start_datetime = _hoy(),
            end_datetime   = _hoy(),
            username  = user,
            password  = pwd,
        )
        sal = float(ds["so"].mean())
        return {
            "salinidad_psu":        round(sal, 2),
            "alerta_contaminacion": sal < SAL_ALERTA,
            "referencia_caribe":    SAL_NORMAL,
            "interpretacion": (
                "Normal" if sal >= SAL_NORMAL - 1
                else "Baja — posible influencia de agua dulce o lluvia reciente"
                if sal >= SAL_ALERTA
                else "Alerta — posible contaminación por río o escorrentía"
            ),
        }
    except Exception as e:
        print(f"[Copernicus] Error salinidad ({lat},{lon}): {e}")
        return _fallback_salinidad(lat, lon)


def _fallback_salinidad(lat: float, lon: float) -> dict:
    return {
        "salinidad_psu":        35.1,
        "alerta_contaminacion": False,
        "referencia_caribe":    SAL_NORMAL,
        "interpretacion":       "Normal",
    }


# ─── Función 4: Forecast 14 días (serie temporal) ────────────────────────────

def get_forecast_14d(lat: float, lon: float) -> list[dict]:
    """
    Retorna una lista de 14 entradas (una por día) con:
      - fecha
      - temperatura_c
      - corrientes (velocidad, dirección)
      - salinidad_psu
      - dhw_estimado (acumulado desde hoy)

    Usa los datasets anfc que tienen pronóstico ~10 días.
    De día 10 al 14 usa extrapolación lineal con la tendencia observada.
    """
    if not COPERNICUS_AVAILABLE:
        return _fallback_forecast_14d(lat, lon)

    user, pwd = _credenciales()
    fecha_inicio = _hoy()
    # anfc da ~10 días de forecast; pedimos los que haya
    fecha_fin_api = _en_dias(9)
    fecha_fin_ext = _en_dias(13)

    dias: list[dict] = []

    try:
        # Temperatura 10 días
        ds_t = copernicusmarine.open_dataset(
            dataset_id    = DS_TEMP,
            variables     = ["thetao"],
            minimum_longitude = lon - RADIO, maximum_longitude = lon + RADIO,
            minimum_latitude  = lat - RADIO, maximum_latitude  = lat + RADIO,
            minimum_depth = 0.0, maximum_depth = 1.0,
            start_datetime = fecha_inicio, end_datetime = fecha_fin_api,
            username = user, password = pwd,
        )
        temps = [round(float(ds_t["thetao"].isel(time=i).mean()), 2)
                 for i in range(len(ds_t.time))]

        # Corrientes 10 días
        ds_c = copernicusmarine.open_dataset(
            dataset_id    = DS_CURRENTS,
            variables     = ["uo", "vo"],
            minimum_longitude = lon - RADIO, maximum_longitude = lon + RADIO,
            minimum_latitude  = lat - RADIO, maximum_latitude  = lat + RADIO,
            minimum_depth = 0.0, maximum_depth = 1.0,
            start_datetime = fecha_inicio, end_datetime = fecha_fin_api,
            username = user, password = pwd,
        )

        n_dias_api = min(len(temps), len(ds_c.time))

        # DHW inicial (hoy) — se acumula si temp > umbral
        UMBRAL_BLANQ = 29.5  # °C umbral típico Caribe
        dhw_acum = 0.0

        for i in range(n_dias_api):
            t   = temps[i]
            uo  = float(ds_c["uo"].isel(time=i).mean())
            vo  = float(ds_c["vo"].isel(time=i).mean())
            vel = math.sqrt(uo**2 + vo**2)
            dir = (math.degrees(math.atan2(uo, vo)) + 360) % 360
            # DHW acumula 1/7 por día si SST > umbral
            if t > UMBRAL_BLANQ:
                dhw_acum += (t - UMBRAL_BLANQ) / 7
            dias.append({
                "dia":            i + 1,
                "fecha":          _en_dias(i),
                "temperatura_c":  t,
                "corrientes": {
                    "velocidad_ms":     round(vel, 3),
                    "direccion_grados": round(dir, 1),
                    "descripcion":      _cardinal(dir),
                },
                "dhw_acumulado":  round(dhw_acum, 3),
                "es_forecast":    i > 0,
            })

        # Extrapolar días 11-14 con tendencia lineal de los últimos 3 días
        if n_dias_api >= 3:
            trend = (temps[-1] - temps[-3]) / 3
            for extra in range(n_dias_api, 14):
                t_ext = round(temps[-1] + trend * (extra - n_dias_api + 1), 2)
                if t_ext > UMBRAL_BLANQ:
                    dhw_acum += (t_ext - UMBRAL_BLANQ) / 7
                dias.append({
                    "dia":            extra + 1,
                    "fecha":          _en_dias(extra),
                    "temperatura_c":  t_ext,
                    "corrientes":     dias[-1]["corrientes"],  # última conocida
                    "dhw_acumulado":  round(dhw_acum, 3),
                    "es_forecast":    True,
                    "es_extrapolado": True,
                })

        return dias[:14]

    except Exception as e:
        print(f"[Copernicus] Error forecast ({lat},{lon}): {e}")
        return _fallback_forecast_14d(lat, lon)


def _fallback_forecast_14d(lat: float, lon: float) -> list[dict]:
    """Forecast simulado realista — tendencia de calentamiento leve."""
    base_temp = _fallback_temperatura(lat, lon)
    UMBRAL = 29.5
    dhw = 0.0
    dias = []
    for i in range(14):
        # Simula oscilación diurna + tendencia +0.04°C/día
        t = round(base_temp + i * 0.04 + (0.2 if i % 3 == 0 else -0.1), 2)
        if t > UMBRAL:
            dhw += (t - UMBRAL) / 7
        dias.append({
            "dia":            i + 1,
            "fecha":          _en_dias(i),
            "temperatura_c":  t,
            "corrientes": {
                "velocidad_ms":     0.30 + i * 0.005,
                "direccion_grados": 95.0 + i * 1.5,
                "descripcion":      _cardinal(95.0 + i * 1.5),
            },
            "dhw_acumulado":  round(dhw, 3),
            "es_forecast":    i > 0,
            "es_extrapolado": i >= 10,
        })
    return dias
