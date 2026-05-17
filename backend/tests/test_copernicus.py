"""
Test básico de las 3 funciones de Copernicus + forecast 14 días.
Usa las coordenadas de Los Cóbanos: lat=13.524, lon=-89.807

Cómo correr:
  cd coral-watch/backend
  python -m pytest tests/test_copernicus.py -v
  # o sin pytest:
  python tests/test_copernicus.py
"""

import sys
import os
# Fix Windows terminal encoding
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.copernicus import (
    get_temperatura,
    get_corrientes,
    get_salinidad,
    get_forecast_14d,
)
from services.veda_dinamica import calcular_veda, analizar_forecast_veda

LAT = 13.524
LON = -89.807
ZONA = "los_cobanos"

# ─── Tests ───────────────────────────────────────────────────────────────────

def test_temperatura():
    temp = get_temperatura(LAT, LON)
    print(f"\n  🌡️  Temperatura Los Cóbanos: {temp}°C")
    assert isinstance(temp, float), "Debe ser float"
    assert 20 < temp < 40, f"Temperatura fuera de rango: {temp}"
    print("  ✅ test_temperatura OK")


def test_corrientes():
    c = get_corrientes(LAT, LON)
    print(f"\n  💧 Corrientes Los Cóbanos:")
    print(f"     Velocidad: {c['velocidad_ms']} m/s")
    print(f"     Dirección: {c['direccion_grados']}° ({c['descripcion']})")
    assert "velocidad_ms"      in c
    assert "direccion_grados"  in c
    assert "descripcion"       in c
    assert 0 <= c["direccion_grados"] <= 360
    print("  ✅ test_corrientes OK")


def test_salinidad():
    s = get_salinidad(LAT, LON)
    print(f"\n  🧂 Salinidad Los Cóbanos: {s['salinidad_psu']} PSU")
    print(f"     Interpretación: {s['interpretacion']}")
    print(f"     Alerta contaminación: {s['alerta_contaminacion']}")
    assert "salinidad_psu"       in s
    assert "alerta_contaminacion" in s
    assert 20 < s["salinidad_psu"] < 42, f"Salinidad fuera de rango: {s['salinidad_psu']}"
    print("  ✅ test_salinidad OK")


def test_forecast_14d():
    dias = get_forecast_14d(LAT, LON)
    print(f"\n  📅 Forecast 14 días Los Cóbanos:")
    for d in dias[:3]:
        extrap = " (extrapolado)" if d.get("es_extrapolado") else ""
        print(f"     Día {d['dia']} {d['fecha']}: {d['temperatura_c']}°C  DHW={d['dhw_acumulado']}{extrap}")
    print(f"     ... ({len(dias)} días total)")
    assert len(dias) == 14, f"Debe tener 14 días, tiene {len(dias)}"
    assert all("temperatura_c" in d for d in dias)
    assert all("dhw_acumulado" in d for d in dias)
    print("  ✅ test_forecast_14d OK")


def test_veda_con_forecast():
    dias = get_forecast_14d(LAT, LON)
    corrientes = get_corrientes(LAT, LON)
    dhw_hoy = dias[0]["dhw_acumulado"]

    veda = calcular_veda(ZONA, dhw_hoy, corrientes)
    print(f"\n  🚦 Veda dinámica Los Cóbanos hoy:")
    print(f"     Estado: {veda['label']} ({veda['nivel']})")
    print(f"     Mensaje: {veda['mensaje']}")
    print(f"     Zona segura: lat={veda['zona_segura']['lat']}, lon={veda['zona_segura']['lon']}")
    print(f"     Máx lanchas: {veda['max_lanchas']}")
    assert "nivel"       in veda
    assert "zona_segura" in veda
    assert "lat" in veda["zona_segura"]

    forecast_veda = analizar_forecast_veda(ZONA, dias)
    print(f"\n  📊 Forecast de veda 14 días:")
    for d in forecast_veda[:5]:
        print(f"     {d['fecha']}: {d['veda']['label']}  DHW={d['dhw']:.3f}  T={d['temperatura_c']}°C")
    assert len(forecast_veda) == 14
    print("  ✅ test_veda_con_forecast OK")


# ─── Ejecución directa ───────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "="*55)
    print("  TEST COPERNICUS — Los Cóbanos (13.524, -89.807)")
    print("="*55)

    errores = []
    for fn in [test_temperatura, test_corrientes, test_salinidad,
               test_forecast_14d, test_veda_con_forecast]:
        try:
            fn()
        except Exception as e:
            print(f"  ❌ {fn.__name__} FALLÓ: {e}")
            errores.append(fn.__name__)

    print("\n" + "="*55)
    if errores:
        print(f"  ❌ {len(errores)} test(s) fallaron: {errores}")
        sys.exit(1)
    else:
        print("  ✅ Todos los tests pasaron")
    print("="*55 + "\n")
