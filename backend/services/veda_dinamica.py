"""
Veda Dinámica — calcula si una zona puede pescar hoy y dónde.

Lógica:
  DHW < 4  → verde   → pesca moderada, máx 10 lanchas
  DHW 4-8  → amarillo → solo aguas profundas, máx 3 lanchas
  DHW > 8  → rojo    → veda activa, 0 lanchas

La zona segura se calcula moviendo el punto del arrecife
en la dirección de la corriente (sotavento oceánico).
"""

import math
from datetime import date

# ─── Coordenadas base de cada zona ───────────────────────────────────────────

ZONAS: dict[str, dict] = {
    "los_cobanos": {
        "lat": 13.529, "lon": -89.814,
        "nombre": "Los Cóbanos", "pais": "El Salvador",
    },
    "barra_santiago": {
        "lat": 13.682, "lon": -90.041,
        "nombre": "Barra de Santiago", "pais": "El Salvador",
    },
    "roatan": {
        "lat": 16.326, "lon": -86.538,
        "nombre": "Roatán — Cordelia Banks", "pais": "Honduras",
    },
    "cozumel": {
        "lat": 20.420, "lon": -86.922,
        "nombre": "Cozumel — Banco Chinchorro", "pais": "México",
    },
    "cayos_miskitos": {
        "lat": 14.380, "lon": -82.780,
        "nombre": "Cayos Miskitos", "pais": "Nicaragua",
    },
}

# Slugs en orden de rotación — nunca la misma zona dos días seguidos
_SLUGS_ROTACION = list(ZONAS.keys())


# ─── Semáforo DHW ────────────────────────────────────────────────────────────

def _nivel_dhw(dhw: float) -> dict:
    if dhw > 8:
        return {
            "nivel": "rojo",
            "color": "#ef4444",
            "label": "VEDA ACTIVA",
            "max_lanchas": 0,
            "permitida": False,
            "mensaje": (
                "VEDA ACTIVA — Coral en blanqueamiento severo. "
                "No pescar cerca del arrecife. "
                "El sistema de refugio de peces está comprometido."
            ),
        }
    if dhw > 4:
        return {
            "nivel": "amarillo",
            "color": "#f97316",
            "label": "LIMITADA",
            "max_lanchas": 3,
            "permitida": True,
            "mensaje": (
                "Coral bajo estrés térmico. "
                "Limitar pesca a aguas profundas (>20 m). "
                "Prohibido bucear y anclar en coral."
            ),
        }
    if dhw > 1:
        return {
            "nivel": "amarillo_claro",
            "color": "#fbbf24",
            "label": "MODERADA",
            "max_lanchas": 6,
            "permitida": True,
            "mensaje": (
                "Estrés térmico leve. "
                "Pesca moderada permitida. "
                "Evitar zonas someras (<5 m) y no tocar coral."
            ),
        }
    return {
        "nivel": "verde",
        "color": "#34d399",
        "label": "PERMITIDA",
        "max_lanchas": 10,
        "permitida": True,
        "mensaje": (
            "Coral en buenas condiciones. "
            "Pesca responsable permitida. "
            "Anclar solo en arena, no en coral."
        ),
    }


# ─── Zona segura por corriente ────────────────────────────────────────────────

def calcular_offset_pesca(zona_id: str, direccion_corriente_grados: float) -> dict:
    """
    Desplaza el punto de pesca 0.05° en la dirección de la corriente
    (sotavento oceánico = aguas lejos del arrecife en estrés).

    Paso a paso:
      1. Tomamos la posición del arrecife (lat, lon)
      2. La corriente viene de direccion_corriente_grados
      3. Mover en esa misma dirección aleja al pescador del arrecife
         y lo lleva a aguas con menos estrés térmico
      4. Radio de 5 km alrededor del punto calculado
    """
    if zona_id not in ZONAS:
        return {"lat": 0.0, "lon": 0.0, "radio_km": 5}

    zona   = ZONAS[zona_id]
    offset = 0.08   # ~8 km en grados
    rad    = math.radians(direccion_corriente_grados)

    lat_segura = zona["lat"] + offset * math.cos(rad)
    lon_segura = zona["lon"] + offset * math.sin(rad)

    return {
        "lat":      round(lat_segura, 4),
        "lon":      round(lon_segura, 4),
        "radio_km": 5,
        "como_se_calculo": (
            f"Arrecife en ({zona['lat']}, {zona['lon']}) "
            f"+ offset {offset}° en dirección corriente {round(direccion_corriente_grados, 1)}°"
        ),
    }


# ─── Rotación diaria ──────────────────────────────────────────────────────────

def zona_en_descanso(zona_id: str) -> bool:
    """
    True si a esta zona le toca descansar hoy.
    Rota entre las 4 zonas: cada día descansa una distinta.
    """
    dia_año = date.today().timetuple().tm_yday
    idx_descanso = dia_año % len(_SLUGS_ROTACION)
    return _SLUGS_ROTACION[idx_descanso] == zona_id


# ─── Función principal ────────────────────────────────────────────────────────

def calcular_veda(zona_id: str, dhw: float, corrientes: dict) -> dict:
    """
    Combina DHW + corrientes + rotación para devolver el estado completo
    de una zona de pesca responsable.

    Retorna:
      nivel, color, label, max_lanchas, permitida, mensaje,
      zona_segura, dhw, en_descanso
    """
    descanso = zona_en_descanso(zona_id)
    estado   = _nivel_dhw(dhw)

    dir_corriente = corrientes.get("direccion_grados", 90.0)
    zona_segura   = calcular_offset_pesca(zona_id, dir_corriente)

    if descanso:
        estado = {
            **estado,
            "nivel":       "descanso",
            "color":       "#6366f1",
            "label":       "EN DESCANSO",
            "max_lanchas": 0,
            "permitida":   False,
            "mensaje": (
                "Esta zona descansa hoy para permitir recuperación del arrecife. "
                "El sistema rota las zonas a diario. "
                "Coral sano hoy = más pesca mañana."
            ),
        }

    return {
        **estado,
        "zona_segura":  zona_segura,
        "dhw":          dhw,
        "en_descanso":  descanso,
    }


# ─── Analizar forecast 14 días ────────────────────────────────────────────────

def analizar_forecast_veda(zona_id: str, forecast_dias: list[dict]) -> list[dict]:
    """
    Toma el forecast de 14 días de Copernicus y calcula el estado de veda
    para cada día. Permite al frontend mostrar el slider de 14 días.
    """
    resultado = []
    for dia in forecast_dias:
        dhw      = dia.get("dhw_acumulado", 0.0)
        corrient = dia.get("corrientes", {"direccion_grados": 90.0})
        veda     = calcular_veda(zona_id, dhw, corrient)
        resultado.append({
            "dia":           dia["dia"],
            "fecha":         dia["fecha"],
            "temperatura_c": dia["temperatura_c"],
            "dhw":           dhw,
            "corrientes":    corrient,
            "veda":          veda,
            "es_forecast":   dia.get("es_forecast", False),
            "es_extrapolado": dia.get("es_extrapolado", False),
        })
    return resultado
