import asyncio
import httpx
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
import sys

# Asegurar que podemos importar desde backend.schemas si ejecutamos este script directamente
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

from schemas.noaa_schema import CleanReefMetrics

ERDDAP_URL = "https://pae-paha.pacioos.hawaii.edu/erddap/griddap/dhw_5km.json"

async def fetch_cobanos_data():
    lat = 13.51
    lon = -89.81
    
    print(f"[{datetime.utcnow().isoformat()}] Solicitando datos espaciales a NOAA ERDDAP...")
    
    async with httpx.AsyncClient() as client:
        # Intentar hasta 3 días atrás si hoy aún no está publicado
        for dias_atras in range(4):
            fecha = (datetime.utcnow() - timedelta(days=dias_atras)).strftime("%Y-%m-%d")
            t = f"({fecha}T12:00:00Z)"
            la = f"({lat})"
            lo = f"({lon})"
            
            query = f"CRW_DHW[{t}][{la}][{lo}],CRW_SST[{t}][{la}][{lo}],CRW_BAA[{t}][{la}][{lo}]"
            url = f"{ERDDAP_URL}?{query}"
            
            try:
                response = await client.get(url, timeout=20.0)
                if response.status_code == 200:
                    data = response.json()
                    break
                elif response.status_code == 404:
                    print(f"[!] Datos del {fecha} no encontrados. Intentando dia anterior...")
                    continue
                response.raise_for_status()
            except httpx.HTTPError as e:
                print(f"[X] Error HTTP al contactar ERDDAP: {e}")
                if dias_atras == 3: return
            except Exception as e:
                print(f"[X] Error inesperado: {e}")
                return
        else:
            print("[X] No se encontraron datos en los ultimos 3 dias.")
            return
            
    try:
        row = data["table"]["rows"][0]
        names = data["table"]["columnNames"]
        record = dict(zip(names, row))
        
        # Validación y limpieza usando el esquema de Pydantic
        clean_data = CleanReefMetrics(
            reef_name="Los Cóbanos",
            latitude=record["latitude"],
            longitude=record["longitude"],
            fecha=record["time"][:10],
            sst=record["CRW_SST"] or 0.0,
            dhw=record["CRW_DHW"] or 0.0,
            stress_level=int(record["CRW_BAA"] or 0)
        )
        
    except (KeyError, IndexError, ValueError) as e:
        print(f"❌ Error al procesar y validar el JSON de ERDDAP: {e}")
        return
    
    # Inyectar en la base de datos principal (reefs.json)
    output_dir = BASE_DIR.parent / "data"
    reefs_file = output_dir / "reefs.json"
    
    reefs_data = []
    if reefs_file.exists():
        with open(reefs_file, "r", encoding="utf-8") as f:
            try:
                reefs_data = json.load(f)
            except json.JSONDecodeError:
                reefs_data = []
                
    # Formatear al estándar de reefs.json
    cobanos_entry = {
        "slug": "los_cobanos",
        "nombre": clean_data.reef_name,
        "region": "Pacific Ocean",
        "fecha": clean_data.fecha.isoformat() if hasattr(clean_data.fecha, 'isoformat') else clean_data.fecha,
        "coordenadas": {
            "lat": clean_data.latitude,
            "lon": clean_data.longitude
        },
        "datos": {
            "sst_max": clean_data.sst,
            "sst_min": clean_data.sst,
            "dhw": clean_data.dhw,
            "stress_level": clean_data.stress_level,
            "bleaching_threshold": 29.5, # Estimado pacífico
            "baa_7day_max": clean_data.stress_level,
            "baa_label": "Alerta Calculada"
        }
    }
    
    # Reemplazar si existe, o agregar
    updated = False
    for i, reef in enumerate(reefs_data):
        if reef.get("slug") == "los_cobanos":
            reefs_data[i] = cobanos_entry
            updated = True
            break
            
    if not updated:
        reefs_data.append(cobanos_entry)
        
    with open(reefs_file, "w", encoding="utf-8") as f:
        json.dump(reefs_data, f, indent=2, ensure_ascii=False)
        
    print(f"✅ ¡Éxito! Datos inyectados en la base principal: {reefs_file}")
    print(json.dumps(cobanos_entry, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(fetch_cobanos_data())
