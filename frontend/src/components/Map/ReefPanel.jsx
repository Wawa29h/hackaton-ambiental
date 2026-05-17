/**
 * ReefPanel — Panel lateral del arrecife
 * Diseño limpio: fondo oscuro profundo, azul/teal como acento, tipografía clara
 * Se muestra encima del visor 3D como overlay inferior
 */

const ALERT_CONFIG = {
  sano:     { bg: '#f0fdf4', border: '#86efac', text: '#15803d', dot: '#22c55e', label: 'Sano'                },
  moderado: { bg: '#fffbeb', border: '#fcd34d', text: '#b45309', dot: '#f59e0b', label: 'Estrés Térmico'      },
  riesgo:   { bg: '#fff7ed', border: '#fdba74', text: '#c2410c', dot: '#f97316', label: 'En Riesgo'           },
  critico:  { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c', dot: '#ef4444', label: 'Blanqueamiento'      },
}

const SPECIES_COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b']

function TrendArrow({ value }) {
  if (!value && value !== 0) return null
  const up   = value > 0
  const zero = value === 0
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, marginLeft: 4,
      color: zero ? '#94a3b8' : up ? '#ef4444' : '#22c55e',
    }}>
      {zero ? '—' : up ? '▲' : '▼'} {Math.abs(value).toFixed(2)}
    </span>
  )
}

export default function ReefPanel({ zona, onClose, dhwReal }) {
  if (!zona) return null

  const cfg   = ALERT_CONFIG[zona.estado] ?? ALERT_CONFIG.sano
  const dhw   = typeof dhwReal === 'number' ? dhwReal : 0
  const salud = Math.max(0, Math.min(100, Math.round(zona.cobertura * 2.1)))

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
      background: 'rgba(8, 12, 24, 0.96)',
      backdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      fontFamily: '"Inter", "Geist", system-ui, sans-serif',
      color: '#e2e8f0',
    }}>

      {/* ── HEADER ── */}
      <div style={{
        padding: '14px 18px 10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>
            {zona.pais}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
            {zona.nombre}
          </div>
        </div>

        {/* Badge estado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20, padding: '4px 10px',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: cfg.dot,
              boxShadow: `0 0 6px ${cfg.dot}`,
              display: 'inline-block', flexShrink: 0,
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: cfg.dot }}>{cfg.label}</span>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8', borderRadius: 6, padding: '4px 10px',
            cursor: 'pointer', fontSize: 12, lineHeight: 1,
          }}>✕</button>
        </div>
      </div>

      {/* ── ALERTA BANNER ── */}
      <div style={{
        margin: '10px 18px 0',
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${cfg.dot}33`,
        borderLeft: `3px solid ${cfg.dot}`,
        borderRadius: 8, padding: '8px 12px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, flexShrink: 0, display: 'inline-block' }} />
        <span style={{ fontSize: 11, color: cfg.dot, fontWeight: 600 }}>
          {cfg.label} · {zona.cobertura}% cobertura coral vivo
        </span>
      </div>

      {/* ── MÉTRICAS ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: 8, padding: '12px 18px',
      }}>
        {[
          { label: 'COBERTURA', value: `${zona.cobertura}%`, sub: 'coral vivo',    color: cfg.dot        },
          { label: 'DHW',       value: dhw.toFixed(1),        sub: 'sem·°C',        color: dhw > 4 ? '#f97316' : dhw > 1 ? '#f59e0b' : '#22c55e' },
          { label: 'ESP. CLAVE', value: zona.especies?.[0]?.split(' ').pop() ?? '—', sub: 'indicadora', color: '#38bdf8' },
          { label: 'SALUD',     value: `${salud}%`,           sub: 'estimada',      color: salud > 60 ? '#22c55e' : salud > 30 ? '#f59e0b' : '#ef4444' },
        ].map(m => (
          <div key={m.label} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8, padding: '8px 10px',
          }}>
            <div style={{ fontSize: 9, color: '#cbd5e1', letterSpacing: '0.12em', marginBottom: 5 }}>{m.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.value}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 3 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── ESPECIES ── */}
      <div style={{ padding: '0 18px 14px' }}>
        <div style={{
          fontSize: 9, color: '#cbd5e1', letterSpacing: '0.15em',
          textTransform: 'uppercase', marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ESPECIES DOMINANTES
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {(zona.especies ?? []).slice(0, 4).map((esp, idx) => {
            const pct   = [100, 94, 61, 80][idx] ?? 70
            const color = SPECIES_COLORS[idx] ?? '#38bdf8'
            return (
              <div key={esp}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#e2e8f0', fontStyle: 'italic' }}>{esp}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color, fontStyle: 'normal', fontFamily: 'monospace' }}>{pct}%</span>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 99 }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    background: `linear-gradient(90deg, ${color}cc, ${color})`,
                    borderRadius: 99,
                    transition: 'width 0.9s cubic-bezier(0.16,1,0.3,1)',
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── DESCRIPCIÓN ── */}
      <div style={{
        margin: '0 18px 14px',
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 8,
        fontSize: 11, color: '#e2e8f0', lineHeight: 1.6,
      }}>
        {zona.descripcion}
      </div>

    </div>
  )
}
