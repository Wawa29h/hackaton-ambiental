import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';

// ─── Fuente de datos ──────────────────────────────────────────────────────────
// NOAA Coral Reef Watch — ERDDAP directo (sin intermediario, sin clave)
// Dataset: dhw_5km  |  Variables: CRW_DHW, CRW_SST, CRW_BAA
const ERDDAP = 'https://pae-paha.pacioos.hawaii.edu/erddap/griddap/dhw_5km.json'

// Zonas del Arrecife Mesoamericano con coordenadas reales
const ZONAS = [
  { slug: 'belize',          nombre: 'Belice — Hol Chan',           lat: 17.025, lon: -88.075 },
  { slug: 'honduras',        nombre: 'Roatán — Cordelia Banks',      lat: 16.326, lon: -86.538 },
  { slug: 'nicaragua',       nombre: 'Cayos Miskitos',               lat: 14.380, lon: -82.780 },
  { slug: 'quintana_roo',    nombre: 'Banco Chinchorro — Q. Roo',    lat: 18.750, lon: -87.340 },
  { slug: 'los_cobanos',     nombre: 'Los Cóbanos',                  lat: 13.529, lon: -89.814 },
  { slug: 'barra_santiago',  nombre: 'Barra de Santiago',            lat: 13.682, lon: -90.041 },
]

// DHW de referencia mayo 2023 — antes del gran evento de blanqueamiento
const DHW_MAYO_2023 = {
  belize:         0.65,
  honduras:       0.83,
  nicaragua:      0.41,
  quintana_roo:   0.92,
  los_cobanos:    1.05,  // Pacífico El Salvador — ya estaba en estrés en 2023
  barra_santiago: 0.28,
}

// Especie emblema por zona
const REEF_META = {
  belize:         { arrecife: 'Hol Chan',         especie: 'Tortuga Carey'      },
  honduras:       { arrecife: 'Cordelia Banks',   especie: 'Mero Nassau'        },
  nicaragua:      { arrecife: 'Miskito Cays',     especie: 'Langosta Espinosa'  },
  quintana_roo:   { arrecife: 'Banco Chinchorro', especie: 'Pez Loro Gigante'   },
  los_cobanos:    { arrecife: 'Los Cóbanos',       especie: 'Tortuga Carey'      },
  barra_santiago: { arrecife: 'Barra de Santiago', especie: 'Pez Guitarrón'     },
}

const BAA_LABELS = {
  0: 'Sin alerta',
  1: 'Bleaching Watch',
  2: 'Bleaching Warning',
  3: 'Bleaching Alert Level 1',
  4: 'Bleaching Alert Level 2',
}

function gradosACardinal(deg) {
  const dirs = ['N','NE','E','SE','S','SO','O','NO']
  return dirs[Math.round(deg / 45) % 8]
}

function hoy() {
  return new Date().toISOString().slice(0, 10)
}

function haceNDias(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// ─── NOAA ERDDAP — dato actual ────────────────────────────────────────────────

async function fetchNoaaActual(lat, lon) {
  const fecha = hoy()
  const t = `(${fecha}T12:00:00Z)`
  const la = `(${lat})`
  const lo = `(${lon})`
  const vars = [
    `CRW_DHW[${t}][${la}][${lo}]`,
    `CRW_SST[${t}][${la}][${lo}]`,
    `CRW_BAA[${t}][${la}][${lo}]`,
  ].join(',')
  const url = `${ERDDAP}?${encodeURI(vars)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`NOAA ERDDAP ${res.status}`)
  const data = await res.json()
  const row   = data.table.rows[0]
  const names = data.table.columnNames
  const d = Object.fromEntries(names.map((n, i) => [n, row[i]]))
  return {
    fecha:        d.time?.slice(0, 10) ?? fecha,
    dhw:          +d.CRW_DHW   || 0,
    sst_max:      +d.CRW_SST   || 0,
    sst_min:      +d.CRW_SST   || 0,   // ERDDAP da media diaria; usamos misma para min
    stress_level: +d.CRW_BAA   || 0,
    baa_7day_max: +d.CRW_BAA   || 0,
    baa_label:    BAA_LABELS[+d.CRW_BAA] ?? 'Desconocido',
    lat:          +d.latitude  || lat,
    lon:          +d.longitude || lon,
  }
}

// ─── NOAA ERDDAP — historial 7 días ──────────────────────────────────────────

async function fetchNoaaHistorial(lat, lon) {
  const fechaIni = haceNDias(6)
  const fechaFin = hoy()
  const r1 = `(${fechaIni}T12:00:00Z)`
  const r2 = `(${fechaFin}T12:00:00Z)`
  const rango = `[${r1}:${r2}]`
  const la = `[(${lat})]`
  const lo = `[(${lon})]`
  const vars = [
    `CRW_DHW${rango}${la}${lo}`,
    `CRW_SST${rango}${la}${lo}`,
    `CRW_BAA${rango}${la}${lo}`,
  ].join(',')
  const url = `${ERDDAP}?${encodeURI(vars)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`NOAA ERDDAP historial ${res.status}`)
  const data  = await res.json()
  const names = data.table.columnNames
  return data.table.rows.map(row => {
    const d = Object.fromEntries(names.map((n, i) => [n, row[i]]))
    return {
      date: d.time?.slice(0, 10),
      dhw:  +d.CRW_DHW || 0,
      sst_max: +d.CRW_SST || 0,
    }
  })
}

// ─── Open-Meteo — viento ──────────────────────────────────────────────────────

async function fetchViento(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh`
  const res  = await fetch(url)
  const data = await res.json()
  const { wind_speed_10m, wind_direction_10m, wind_gusts_10m } = data.current
  return {
    velocidad_kmh:       wind_speed_10m,
    direccion_grados:    wind_direction_10m,
    direccion_cardinal:  gradosACardinal(wind_direction_10m),
    rafagas_kmh:         wind_gusts_10m,
    condicion:           wind_speed_10m < 15 ? 'calmo' : wind_speed_10m < 30 ? 'moderado' : 'fuerte',
  }
}

// ─── Tendencia 7 días ─────────────────────────────────────────────────────────

function calcularTendencia(historial) {
  const n        = historial.length
  const ssts     = historial.map(d => d.sst_max)
  const dhws     = historial.map(d => d.dhw)
  const sstTotal = ssts[n-1] - ssts[0]
  const dhwTotal = dhws[n-1] - dhws[0]
  return {
    sst_pendiente_diaria: +((sstTotal / (n-1)).toFixed(4)),
    dhw_pendiente_diaria: +((dhwTotal / (n-1)).toFixed(4)),
    sst_delta_7d:         +(sstTotal.toFixed(2)),
    dhw_delta_7d:         +(dhwTotal.toFixed(4)),
    sst_serie:            ssts.map(v => v.toFixed(2)),
    dhw_serie:            dhws.map(v => v.toFixed(4)),
    fechas:               historial.map(d => d.date),
  }
}

// ─── Claude — predicciones ────────────────────────────────────────────────────

async function generarPredicciones(reef, tendencia, viento) {
  const { sst_max, sst_min, dhw, stress_level, baa_label, baa_7day_max } = reef.datos
  const sstDir = tendencia.sst_pendiente_diaria > 0 ? 'subiendo' : tendencia.sst_pendiente_diaria < 0 ? 'bajando' : 'estable'
  const dhwDir = tendencia.dhw_pendiente_diaria > 0 ? 'acumulando' : 'estable o bajando'

  const dhw2023   = DHW_MAYO_2023[reef.slug]
  const dhwDelta  = +(dhw - dhw2023).toFixed(4)
  const tendenciaInteranual =
    dhwDelta > 0.5  ? 'significativamente peor que 2023' :
    dhwDelta > 0    ? 'ligeramente peor que 2023' :
    dhwDelta < -0.5 ? 'significativamente mejor que 2023' :
    'similar a 2023'

  const { arrecife, especie } = REEF_META[reef.slug]

  const prompt = `Eres un experto en salud de arrecifes coralinos del Arrecife Mesoamericano.
Genera predicciones MUY ESPECÍFICAS para el arrecife de ${reef.nombre} (zona: ${arrecife}):

Datos actuales (${reef.fecha}) — fuente: NOAA Coral Reef Watch ERDDAP directo:
- SST: ${sst_max}°C
- DHW: ${dhw} (${dhwDir})
- Nivel de alerta NOAA: ${baa_label} (BAA=${baa_7day_max})
- Estrés térmico nivel: ${stress_level}/4

Viento actual:
- ${viento.velocidad_kmh} km/h ${viento.direccion_cardinal} (${viento.condicion}) | Ráfagas: ${viento.rafagas_kmh} km/h

Contexto interanual:
- DHW mayo 2023: ${dhw2023} → hoy: ${dhw} (${tendenciaInteranual})

Tendencia 7 días (${tendencia.fechas[0]} → ${tendencia.fechas[tendencia.fechas.length-1]}):
- SST: ${tendencia.sst_serie.join(' → ')}°C (${sstDir}, ${tendencia.sst_pendiente_diaria > 0 ? '+' : ''}${tendencia.sst_pendiente_diaria}°C/día)
- DHW: ${tendencia.dhw_serie.join(' → ')}

Responde ÚNICAMENTE con JSON válido:
{
  "blanqueamiento": "días o semanas concretas hasta cruzar umbral, según tendencia",
  "pesca": "hora exacta de salida, profundidad específica, dirección según viento ${viento.direccion_cardinal} a ${viento.velocidad_kmh} km/h, especie más probable (${especie})",
  "salud": "comparación con oct 2023 (DHW 12.8, pérdida 40-90%). ¿Qué tan lejos estamos?",
  "alerta": "Hermano pescador de ${reef.nombre}: menciona ${arrecife} y ${especie}. Máx 2 oraciones directas."
}`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      stream: false,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data    = await res.json()
  const content = data.choices?.[0]?.message?.content ?? '{}'
  const match   = content.match(/\{[\s\S]*\}/)
  return match ? JSON.parse(match[0]) : { error: content }
}

// ─── Pipeline principal ───────────────────────────────────────────────────────

export async function refreshReefs(dataPath = './data/reefs.json') {
  console.log(`[${new Date().toISOString()}] Actualizando reefs.json desde NOAA ERDDAP...`)
  const resultados = []

  for (const zona of ZONAS) {
    const { slug, nombre, lat, lon } = zona
    console.log(`  → ${nombre} (${lat}, ${lon})`)

    try {
      const [actual, historial, viento] = await Promise.all([
        fetchNoaaActual(lat, lon),
        fetchNoaaHistorial(lat, lon),
        fetchViento(lat, lon),
      ])

      const tendencia = calcularTendencia(historial)

      console.log(`    SST=${actual.sst_max}°C  DHW=${actual.dhw}  BAA=${actual.stress_level} (${actual.baa_label})`)
      console.log(`    Viento: ${viento.velocidad_kmh}km/h ${viento.direccion_cardinal} (${viento.condicion})`)
      console.log(`    Tendencia SST: ${tendencia.sst_pendiente_diaria > 0 ? '+' : ''}${tendencia.sst_pendiente_diaria}°C/día`)

      const reef = {
        slug,
        nombre,
        region:       'Arrecife Mesoamericano',
        fecha:        actual.fecha,
        coordenadas:  { lat, lon },
        datos: {
          sst_max:            actual.sst_max,
          sst_min:            actual.sst_min,
          dhw:                actual.dhw,
          stress_level:       actual.stress_level,
          baa_7day_max:       actual.baa_7day_max,
          baa_label:          actual.baa_label,
          bleaching_threshold: +(actual.sst_max - actual.dhw * 0.1).toFixed(2), // estimado
        },
        viento,
        tendencia,
        interanual: {
          dhw_mayo_2023: DHW_MAYO_2023[slug],
          dhw_actual:    actual.dhw,
          delta:         +(actual.dhw - DHW_MAYO_2023[slug]).toFixed(4),
        },
        fuente: 'NOAA Coral Reef Watch ERDDAP — pae-paha.pacioos.hawaii.edu',
      }

      reef.predictions = await generarPredicciones(reef, tendencia, viento)
      console.log(`    ✓ ${nombre}`)
      resultados.push(reef)

    } catch (err) {
      console.error(`    ✗ Error en ${nombre}: ${err.message}`)
    }
  }

  mkdirSync('./data', { recursive: true })
  writeFileSync(dataPath, JSON.stringify(resultados, null, 2))
  console.log(`\n[${new Date().toISOString()}] ✓ reefs.json actualizado (${resultados.length} zonas)\n`)
  return resultados
}

// Ejecución directa: node noaa.js
if (process.argv[1].endsWith('noaa.js')) {
  refreshReefs()
}
