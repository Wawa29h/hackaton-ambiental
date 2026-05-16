import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { refreshReefs } from '../noaa.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REEFS_PATH = join(__dirname, '../data/reefs.json');
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas

const app = express();
app.use(cors());

app.get('/reefs', (req, res) => {
  const data = JSON.parse(readFileSync(REEFS_PATH, 'utf8'));
  res.json(data);
});

app.get('/reefs/refresh', async (req, res) => {
  try {
    const data = await refreshReefs(REEFS_PATH);
    res.json({ ok: true, actualizado: new Date().toISOString(), arrecifes: data.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(3001, async () => {
  console.log('Coral Watch API → http://localhost:3001');

  // Actualización inmediata al arrancar
  await refreshReefs(REEFS_PATH);

  // Ciclo cada 24 horas
  setInterval(() => refreshReefs(REEFS_PATH), INTERVAL_MS);
  console.log(`Próxima actualización automática en 24 horas.`);
});
