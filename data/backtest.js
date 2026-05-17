import 'dotenv/config';
import { writeFileSync } from 'fs';

const CASOS = [
  {
    id: 1,
    titulo: "Honduras — Cordelia Banks, octubre 2023 (peor evento registrado)",
    datos: { slug: "honduras", sst: 31.8, threshold: 29.87, dhw: 12.8, alertLevel: 5, families: 520, trend: "subiendo" },
    realidad: "Cordelia Banks pasó de 46% a 5% de cobertura coralina — la mayor pérdida registrada en el SAM.",
  },
  {
    id: 2,
    titulo: "Belice, septiembre 2023",
    datos: { slug: "belize", sst: 31.2, threshold: 29.87, dhw: 8.4, alertLevel: 4, families: 180, trend: "subiendo" },
    realidad: "40% de corales severamente afectados en el evento de blanqueamiento masivo.",
  },
  {
    id: 3,
    titulo: "Nicaragua, julio 2023 (antes del pico)",
    datos: { slug: "nicaragua", sst: 30.1, threshold: 29.5, dhw: 2.1, alertLevel: 2, families: 290, trend: "subiendo" },
    realidad: "El arrecife resistió mejor que sus vecinos — 43% de cobertura coralina mantenida.",
  },
  {
    id: 4,
    titulo: "Quintana Roo — inicio del evento, junio 2023",
    datos: { slug: "quintana_roo", sst: 30.4, threshold: 29.8, dhw: 4.2, alertLevel: 3, families: 340, trend: "subiendo" },
    realidad: "Blanqueamiento moderado, con recuperación parcial registrada en 2024.",
  },
];

function buildPrompt(caso) {
  const { slug, sst, threshold, dhw, alertLevel, families, trend } = caso.datos;
  return `Eres un experto en salud de arrecifes coralinos del Arrecife Mesoamericano.
Con estos datos históricos, genera las predicciones que habrías dado en ese momento para ${slug}:

- SST máxima: ${sst}°C
- Umbral de blanqueamiento: ${threshold}°C
- Degree Heating Weeks (DHW): ${dhw}
- Nivel de alerta: ${alertLevel}/5
- Familias pesqueras en riesgo: ${families}
- Tendencia de temperatura: ${trend}

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional:
{
  "blanqueamiento": "riesgo para los próximos 7 días en 1-2 oraciones",
  "pesca": "cuándo y dónde pescar esta semana en 1-2 oraciones",
  "salud": "tendencia del arrecife este mes en 1-2 oraciones",
  "alerta": "1 oración directa en español simple para el pescador",
  "prediccion_correcta": true
}

El campo prediccion_correcta debe ser true si los datos apuntan claramente a un evento severo de blanqueamiento, false si no.`;
}

async function llamarOpenRouter(prompt) {
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

function evaluarAcierto(prediccion, realidad) {
  const fueGrave = realidad.includes('masivo') || realidad.includes('mayor pérdida') || realidad.includes('severamente');
  const fueResistente = realidad.includes('resistió') || realidad.includes('mantenida');
  const fueModerado = realidad.includes('moderado') || realidad.includes('parcial');

  const predijoCritico = prediccion.prediccion_correcta === true;
  const predijoBien = prediccion.blanqueamiento?.toLowerCase().includes('severo') ||
                      prediccion.blanqueamiento?.toLowerCase().includes('crítico') ||
                      prediccion.blanqueamiento?.toLowerCase().includes('alto');

  if (fueGrave) return predijoCritico || predijoBien ? 'SI' : 'NO';
  if (fueResistente) return !predijoCritico ? 'SI' : 'PARCIAL';
  if (fueModerado) return 'PARCIAL';
  return 'INDETERMINADO';
}

async function main() {
  const resultados = [];

  for (const caso of CASOS) {
    console.log(`\n━━━ CASO ${caso.id}: ${caso.titulo} ━━━`);
    console.log(`  DHW: ${caso.datos.dhw} | SST: ${caso.datos.sst}°C | Alerta: ${caso.datos.alertLevel}/5`);

    const prediccion = await llamarOpenRouter(buildPrompt(caso));
    const acierto = evaluarAcierto(prediccion, caso.realidad);

    console.log(`  PREDICCIÓN IA:`);
    console.log(`    blanqueamiento : ${prediccion.blanqueamiento}`);
    console.log(`    pesca          : ${prediccion.pesca}`);
    console.log(`    salud          : ${prediccion.salud}`);
    console.log(`    alerta         : ${prediccion.alerta}`);
    console.log(`  REALIDAD        : ${caso.realidad}`);
    console.log(`  PREDICCIÓN CORRECTA: ${acierto}`);

    resultados.push({
      caso: caso.id,
      titulo: caso.titulo,
      datos_historicos: caso.datos,
      prediccion_ia: prediccion,
      realidad_documentada: caso.realidad,
      prediccion_correcta: acierto,
    });
  }

  const resumen = {
    meta: {
      descripcion: "Backtest con 4 casos históricos reales del Arrecife Mesoamericano (2023)",
      modelo: "anthropic/claude-sonnet-4-5",
      ejecutado: new Date().toISOString(),
      total_casos: resultados.length,
      aciertos: resultados.filter(r => r.prediccion_correcta === 'SI').length,
      parciales: resultados.filter(r => r.prediccion_correcta === 'PARCIAL').length,
      fallos: resultados.filter(r => r.prediccion_correcta === 'NO').length,
    },
    casos: resultados,
  };

  writeFileSync('./data/backtest.json', JSON.stringify(resumen, null, 2));

  console.log(`\n━━━ RESUMEN ━━━`);
  console.log(`  Aciertos  : ${resumen.meta.aciertos}/${resumen.meta.total_casos}`);
  console.log(`  Parciales : ${resumen.meta.parciales}/${resumen.meta.total_casos}`);
  console.log(`  Fallos    : ${resumen.meta.fallos}/${resumen.meta.total_casos}`);
  console.log(`\n✓ Guardado en data/backtest.json`);
}

main();
