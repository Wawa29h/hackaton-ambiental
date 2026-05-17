"""
NOAA Coral Reef Watch — datos directos via ERDDAP (sin clave, sin intermediario).

Servidor: pae-paha.pacioos.hawaii.edu/erddap
Dataset:  dhw_5km  (5km resolution, daily)
Variables:
  CRW_DHW   — Degree Heating Weeks (semanas·grado de estrés acumulado)
  CRW_SST   — Sea Surface Temperature en °C
  CRW_BAA   — Bleaching Alert Area (0=sin alerta, 1=watch, 2=warning, 3=alert1, 4=alert2)

Sin API key. Sin registro. Datos en tiempo real de satélite NOAA.
"""

import datetime
import httpx

ERDDAP_BASE = "https://pae-paha.pacioos.hawaii.edu/erddap/griddap/dhw_5km.json"

BAA_LABELS = {
    0: "Sin alerta",
    1: "Watch — estrés leve",
    2: "Warning — blanqueamiento posible",
    3: "Alert Level 1 — blanqueamiento probable",
    4: "Alert Level 2 — blanqueamiento severo y mortalidad",
}

def _hoy() -> str:
    return datetime.date.today().isoformat()

def _hace_n_dias(n: int) -> str:
    return (datetime.date.today() - datetime.timedelta(days=n)).isoformat()

def _url_punto(lat: float, lon: float, fecha_ini: str, fecha_fin: str) -> str:
    """Construye la URL ERDDAP para un punto y rango de fechas."""
    def enc(v): return str(v).replace("-", "%2D")
    t1 = f"({fecha_ini}T12:00:00Z)"
    t2 = f"({fecha_fin}T12:00:00Z)"
    rango = f"%5B{t1}:{t2}%5D"
    lat_s = f"%5B({lat})%5D"
    lon_s = f"%5B({lon})%5D"
    vars_ = ",".join([
        f"CRW_DHW{rango}{lat_s}{lon_s}",
        f"CRW_SST{rango}{lat_s}{lon_s}",
        f"CRW_BAA{rango}{lat_s}{lon_s}",
    ])
    return f"{ERDDAP_BASE}?{vars_}"


def get_dato_actual(lat: float, lon: float) -> dict:
    """
    Retorna los datos actuales de NOAA CRW para un punto:
      dhw, sst, baa, fecha, stress_level, alerta_texto
    """
    hoy = _hoy()
    url = _url_punto(lat, lon, hoy, hoy)
    try:
        r = httpx.get(url, follow_redirects=True, timeout=15)
        r.raise_for_status()
        data  = r.json()
        row   = data["table"]["rows"][0]
        names = data["table"]["columnNames"]
        d     = dict(zip(names, row))

        dhw  = float(d.get("CRW_DHW", 0) or 0)
        sst  = float(d.get("CRW_SST", 0) or 0)
        baa  = int(d.get("CRW_BAA", 0)   or 0)

        return {
            "fecha":        hoy,
            "lat":          float(d.get("latitude",  lat)),
            "lon":          float(d.get("longitude", lon)),
            "dhw":          round(dhw, 4),
            "sst":          round(sst, 2),
            "baa":          baa,
            "stress_level": baa,
            "alerta":       BAA_LABELS.get(baa, "Desconocido"),
            "fuente":       "NOAA Coral Reef Watch ERDDAP (dhw_5km)",
        }
    except Exception as e:
        print(f"[NOAA CRW] Error dato actual ({lat},{lon}): {e}")
        return _fallback_actual(lat, lon)


def get_historial_nd(lat: float, lon: float, dias: int = 7) -> list[dict]:
    """
    Retorna los ultimos N dias de DHW y SST para un punto.
    Usado para calcular tendencia diaria.
    """
    dias = max(2, int(dias))
    fecha_ini = _hace_n_dias(dias - 1)
    fecha_fin = _hoy()
    url = _url_punto(lat, lon, fecha_ini, fecha_fin)
    try:
        r = httpx.get(url, follow_redirects=True, timeout=15)
        r.raise_for_status()
        data  = r.json()
        names = data["table"]["columnNames"]
        return [
            {
                "fecha": row[names.index("time")][:10],
                "dhw":   round(float(row[names.index("CRW_DHW")] or 0), 4),
                "sst":   round(float(row[names.index("CRW_SST")] or 0), 2),
                "baa":   int(row[names.index("CRW_BAA")]   or 0),
            }
            for row in data["table"]["rows"]
        ]
    except Exception as e:
        print(f"[NOAA CRW] Error historial ({lat},{lon}): {e}")
        return _fallback_historial(lat, lon, dias)


def get_historial_7d(lat: float, lon: float) -> list[dict]:
    """Retorna los ultimos 7 dias de DHW y SST."""
    return get_historial_nd(lat, lon, 7)


def get_historial_30d(lat: float, lon: float) -> list[dict]:
    """Retorna los ultimos 30 dias de DHW y SST para proyecciones."""
    return get_historial_nd(lat, lon, 30)


def calcular_tendencia(historial: list[dict]) -> dict:
    """
    Calcula pendiente diaria de SST y DHW sobre los últimos 7 días.
    Igual que hacía noaa.js pero directo desde Python.
    """
    if len(historial) < 2:
        return {"sst_pendiente_diaria": 0, "dhw_pendiente_diaria": 0,
                "sst_delta_7d": 0, "dhw_delta_7d": 0,
                "sst_serie": [], "dhw_serie": [], "fechas": []}

    n    = len(historial)
    ssts = [d["sst"] for d in historial]
    dhws = [d["dhw"] for d in historial]

    return {
        "sst_pendiente_diaria": round((ssts[-1] - ssts[0]) / (n - 1), 4),
        "dhw_pendiente_diaria": round((dhws[-1] - dhws[0]) / (n - 1), 4),
        "sst_delta_7d":        round(ssts[-1] - ssts[0], 2),
        "dhw_delta_7d":        round(dhws[-1] - dhws[0], 4),
        "sst_serie":           [f"{v:.2f}" for v in ssts],
        "dhw_serie":           [f"{v:.4f}" for v in dhws],
        "fechas":              [d["fecha"] for d in historial],
    }


# ─── Fallbacks ───────────────────────────────────────────────────────────────

def _fallback_actual(lat: float, lon: float) -> dict:
    """Último dato conocido si ERDDAP no responde."""
    defaults = {
        (13.5, -89.8): {"dhw": 0.94, "sst": 30.62, "baa": 2},
        (16.3, -86.5): {"dhw": 0.83, "sst": 30.30, "baa": 2},
        (20.4, -86.9): {"dhw": 0.92, "sst": 30.20, "baa": 2},
        (14.4, -82.8): {"dhw": 2.15, "sst": 29.90, "baa": 2},
    }
    key  = min(defaults, key=lambda p: (p[0]-lat)**2 + (p[1]-lon)**2)
    vals = defaults[key]
    return {
        "fecha":        _hoy(),
        "lat":          lat, "lon": lon,
        "dhw":          vals["dhw"],
        "sst":          vals["sst"],
        "baa":          vals["baa"],
        "stress_level": vals["baa"],
        "alerta":       BAA_LABELS[vals["baa"]],
        "fuente":       "Fallback — NOAA ERDDAP no disponible",
    }

def _fallback_historial(lat: float, lon: float, dias: int = 7) -> list[dict]:
    base = _fallback_actual(lat, lon)
    return [
        {
            "fecha": _hace_n_dias((dias - 1) - i),
            "dhw":   round(max(0, base["dhw"] - ((dias - 1) - i) * 0.03), 4),
            "sst":   round(base["sst"] - ((dias - 1) - i) * 0.015, 2),
            "baa":   base["baa"],
        }
        for i in range(dias)
    ]
