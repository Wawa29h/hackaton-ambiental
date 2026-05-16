import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';

const SLUGS = ['belize', 'honduras', 'nicaragua', 'quintana_roo'];

// DHW documentados en mayo 2023 (NOAA CRW) — antes del gran evento de blanqueamiento
const DHW_MAYO_2023 = {
  belize:       0.65,
  honduras:     0.83,
  nicaragua:    0.41,
  quintana_roo: 0.92,
};

// Arrecife icónico y especie emblema por slug
const REEF_META = {
  belize:       { arrecife: 'Hol Chan',        especie: 'Tortuga Carey' },
  honduras:     { arrecife: 'Cordelia Banks',  especie: 'Mero Nassau' },
  nicaragua:    { arrecife: 'Miskito Cays',    especie: 'Langosta Espinosa' },
  quintana_roo: { arrecife: 'Banco Chinchorro', especie: 'Pez Loro Gigante' },
};

// Dirección del viento en grados → cardinal
function gradosACardinal(deg) {
  const dirs = ['N','NE','E','SE','S','SO','O','NO'];
  return dirs[Math.round(deg / 45) % 8];
}

async function fetchReef(slug) {
  const res = await fetch(`https://api.coral.tsr.lol/stations/${slug}/current`);
  return res.json();
}

async function fetchHistory(slug) {
  const res = await fetch(`https://api.coral.tsr.lol/stations/${slug}?limit=7`);
  return res.json();
}

async function fetchWind(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh`;
  const res = await fetch(url);
  const data = await res.json();
  const { wind_speed_10m, wind_direction_10m, wind_gusts_10m } = data.current;
  return {
    velocidad_kmh: wind_speed_10m,
    direccion_grados: wind_direction_10m,
    direccion_cardinal: gradosACardinal(wind_direction_10m),
    rafagas_kmh: wind_gusts_10m,
    condicion: wind_speed_10m < 15 ? 'calmo' : wind_speed_10m < 30 ? 'moderado' : 'fuerte',
  };
}

function calcularTendencia(data) {
  const dias = [...data].reverse();
  const n = dias.length;
  const sstValues = dias.map(d => d.sst_max);
  const dhwValues = dias.map(d => d.dhw);
  const sstTotal = sstValues[n - 1] - sstValues[0];
  const dhwTotal = dhwValues[n - 1] - dhwValues[0];
  return {
    sst_pendiente_diaria: +(sstTotal / (n - 1)).toFixed(4),
    dhw_pendiente_diaria: +(dhwTotal / (n - 1)).toFixed(4),
    sst_delta_7d: +sstTotal.toFixed(2),
    dhw_delta_7d: +dhwTotal.toFixed(4),
    sst_serie: sstValues.map(v => v.toFixed(2)),
    dhw_serie: dhwValues.map(v => v.toFixed(4)),
    fechas: dias.map(d => d.date),
  };
}

async function generarPredicciones(reef, tendencia, viento) {
  const { sst_max, sst_min, dhw, stress_level, bleaching_threshold, baa_7day_max } = reef.datos;
  const sstDir = tendencia.sst_pendiente_diaria > 0 ? 'subiendo' : tendencia.sst_pendiente_diaria < 0 ? 'bajando' : 'estable';
  const dhwDir = tendencia.dhw_pendiente_diaria > 0 ? 'acumulando' : 'estable o bajando';

  // Días estimados para cruzar el umbral si la tendencia continúa
  const margen = bleaching_threshold - sst_max;
  const diasAlUmbral = tendencia.sst_pendiente_diaria > 0
    ? Math.ceil(margen / tendencia.sst_pendiente_diaria)
    : null;
  const umbralMsg = diasAlUmbral !== null && diasAlUmbral > 0
    ? `A este ritmo, la SST cruzará el umbral de blanqueamiento en ~${diasAlUmbral} días.`
    : sst_max >= bleaching_threshold
    ? 'La SST ya supera el umbral de blanqueamiento.'
    : 'La SST está bajando — el umbral no está en riesgo inmediato.';

  const dhw2023 = DHW_MAYO_2023[reef.slug];
  const dhwDelta = +(dhw - dhw2023).toFixed(4);
  const tendenciaInteranual = dhwDelta > 0.5 ? 'significativamente peor que 2023'
    : dhwDelta > 0 ? 'ligeramente peor que 2023'
    : dhwDelta < -0.5 ? 'significativamente mejor que 2023'
    : 'similar a 2023';

  const { arrecife, especie } = REEF_META[reef.slug];

  const prompt = `Eres un experto en salud de arrecifes coralinos del Arrecife Mesoamericano.
Genera predicciones MUY ESPECÍFICAS para el arrecife de ${reef.nombre} (zona: ${arrecife}):

Datos actuales (${reef.fecha}):
- SST máxima: ${sst_max}°C | SST mínima: ${sst_min}°C
- Umbral de blanqueamiento: ${bleaching_threshold}°C (diferencia actual: ${(sst_max - bleaching_threshold).toFixed(2)}°C)
- ${umbralMsg}
- Degree Heating Weeks (DHW): ${dhw}
- Nivel de estrés térmico: ${stress_level}/4
- Alerta BAA 7 días: ${baa_7day_max}

Viento actual:
- Velocidad: ${viento.velocidad_kmh} km/h (${viento.condicion}) | Ráfagas: ${viento.rafagas_kmh} km/h
- Dirección: ${viento.direccion_cardinal} (${viento.direccion_grados}°)
- Impacto en pesca: viento ${viento.direccion_cardinal} a ${viento.velocidad_kmh} km/h ${viento.condicion === 'fuerte' ? 'dificulta la navegación — evitar mar abierto' : viento.condicion === 'moderado' ? 'permite navegación con precaución' : 'condiciones favorables para salir'}

Contexto interanual:
- En mayo 2023 este arrecife tenía DHW de ${dhw2023} — hoy tiene ${dhw}. La tendencia interanual es ${tendenciaInteranual}.
- El peor momento registrado fue octubre 2023 con DHW 12.8 y pérdida del 40–90% de cobertura coralina.

Tendencia últimos 7 días (del ${tendencia.fechas[0]} al ${tendencia.fechas[tendencia.fechas.length - 1]}):
- SST: ${tendencia.sst_serie.join(' → ')}°C (${sstDir}, ${tendencia.sst_pendiente_diaria > 0 ? '+' : ''}${tendencia.sst_pendiente_diaria}°C/día)
- DHW: ${tendencia.dhw_serie.join(' → ')} (${dhwDir})

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "blanqueamiento": "Menciona exactamente cuántos días faltan para cruzar el umbral si la tendencia continúa. Sé específico con el número.",
  "pesca": "Menciona hora exacta de salida, profundidad específica en metros, dirección según el viento ${viento.direccion_cardinal} a ${viento.velocidad_kmh} km/h, y especie más probable de encontrar (${especie} u otras).",
  "salud": "Compara el estado actual con el peor momento histórico (oct 2023, DHW 12.8). ¿Qué tan lejos o cerca estamos de ese escenario?",
  "alerta": "Dirige el mensaje a 'Hermano pescador de ${reef.nombre}'. Menciona el arrecife ${arrecife} por nombre y la ${especie} como especie en riesgo. Máximo 2 oraciones directas."
}`;

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
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '{}';
  const match = content.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : { error: content };
}

export async function refreshReefs(dataPath = './data/reefs.json') {
  console.log(`[${new Date().toISOString()}] Actualizando reefs.json...`);
  const resultados = [];

  for (const slug of SLUGS) {
    console.log(`  Fetching ${slug}...`);
    const [raw, hist] = await Promise.all([fetchReef(slug), fetchHistory(slug)]);
    const tendencia = calcularTendencia(hist.data);
    const viento = await fetchWind(raw.latitude, raw.longitude);

    console.log(`    SST ${tendencia.sst_pendiente_diaria > 0 ? '+' : ''}${tendencia.sst_pendiente_diaria}°C/día | Viento ${viento.velocidad_kmh}km/h ${viento.direccion_cardinal} (${viento.condicion})`);

    const reef = {
      slug,
      nombre: raw.name,
      region: raw.region,
      fecha: raw.current.date,
      coordenadas: { lat: raw.latitude, lon: raw.longitude },
      datos: {
        sst_max: raw.current.sst_max,
        sst_min: raw.current.sst_min,
        dhw: raw.current.dhw,
        stress_level: raw.current.stress_level,
        bleaching_threshold: raw.bleaching_threshold,
        baa_7day_max: raw.current.baa_7day_max,
      },
      viento,
      tendencia,
      interanual: {
        dhw_mayo_2023: DHW_MAYO_2023[slug],
        dhw_actual: raw.current.dhw,
        delta: +(raw.current.dhw - DHW_MAYO_2023[slug]).toFixed(4),
      },
    };

    reef.predictions = await generarPredicciones(reef, tendencia, viento);
    console.log(`  ✓ ${reef.nombre}`);
    console.log(`    blanqueamiento : ${reef.predictions.blanqueamiento}`);
    console.log(`    pesca          : ${reef.predictions.pesca}`);
    console.log(`    alerta         : ${reef.predictions.alerta}`);
    resultados.push(reef);
  }

  mkdirSync('./data', { recursive: true });
  writeFileSync(dataPath, JSON.stringify(resultados, null, 2));
  console.log(`\n[${new Date().toISOString()}] ✓ reefs.json actualizado (${resultados.length} arrecifes)\n`);
  return resultados;
}

// Ejecución directa: node noaa.js
if (process.argv[1].endsWith('noaa.js')) {
  refreshReefs();
}
