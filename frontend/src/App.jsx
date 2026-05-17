import { useState } from 'react'
import ReefViewer from './components/ReefViewer/ReefViewer'

const ZONAS = [
  { id: 'los_cobanos',    nombre: 'Los Cóbanos, El Salvador',   dhw: 6.4 },
  { id: 'roatan',         nombre: 'Roatán, Honduras',           dhw: 9.2 },
  { id: 'cozumel',        nombre: 'Cozumel, México',            dhw: 3.1 },
  { id: 'cayos_miskitos', nombre: 'Cayos Miskitos, Nicaragua',  dhw: 1.8 },
]

export default function App() {
  const [zonaActiva, setZonaActiva] = useState(ZONAS[0])

  return (
    <div style={{
      background: '#0a1628',
      minHeight: '100vh',
      color: 'white',
      fontFamily: 'sans-serif',
    }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>
          Coral Watch — Gemelo Digital
        </h2>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {ZONAS.map(zona => (
            <button
              key={zona.id}
              onClick={() => setZonaActiva(zona)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.2)',
                background: zonaActiva.id === zona.id
                  ? 'rgba(46,204,113,0.2)'
                  : 'transparent',
                color: zonaActiva.id === zona.id ? '#2ecc71' : '#9fb8d8',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {zona.nombre}
            </button>
          ))}
        </div>
      </div>

      <ReefViewer zone={zonaActiva.id} dhw={zonaActiva.dhw} />

      <div style={{ padding: '12px 24px', fontSize: 13, color: '#9fb8d8' }}>
        DHW actual: <strong style={{ color: getDHWColor(zonaActiva.dhw) }}>
          {zonaActiva.dhw}
        </strong> — {getDHWLabel(zonaActiva.dhw)}
      </div>
    </div>
  )
}

function getDHWColor(dhw) {
  if (dhw < 4)  return '#2ecc71'
  if (dhw < 8)  return '#f39c12'
  if (dhw < 12) return '#e8e8e8'
  return '#e74c3c'
}

function getDHWLabel(dhw) {
  if (dhw < 4)  return 'Condiciones normales'
  if (dhw < 8)  return 'Alerta 1 — estrés térmico'
  if (dhw < 12) return 'Alerta 2 — blanqueamiento activo'
  return 'Crítico — mortalidad masiva'
}
