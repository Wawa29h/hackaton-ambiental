/**
 * ReefPanel — Panel lateral del arrecife
 * Estética industrial / científica: geometría rígida, sin redondeos, JetBrains Mono
 */

const MONO  = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace"
const BG0   = '#020617'
const BG1   = '#070a13'
const BORDER = 'rgba(30,41,59,0.95)'

const ALERT_CONFIG = {
  sano:     { dot: '#34d399', label: 'SANO'              },
  moderado: { dot: '#fbbf24', label: 'ESTRÉS TÉRMICO'    },
  riesgo:   { dot: '#f97316', label: 'EN RIESGO'         },
  critico:  { dot: '#ef4444', label: 'BLANQUEAMIENTO'    },
}

const SPECIES_COLORS = ['#a855f7', '#34d399', '#06b6d4', '#fbbf24', '#f97316']

function TrendArrow({ value }) {
  if (!value && value !== 0) return null
  const up   = value > 0
  const zero = value === 0
  return (
    <span style={{
      fontFamily: MONO, fontSize: 9, fontWeight: 700, marginLeft: 4,
      color: zero ? '#334155' : up ? '#ef4444' : '#34d399',
      letterSpacing: '0.05em',
    }}>
      {zero ? '—' : up ? '▲' : '▼'} {Math.abs(value).toFixed(2)}
    </span>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: '#334155',
      textTransform: 'uppercase', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {children}
      <div style={{ flex: 1, height: 1, background: BORDER }} />
    </div>
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
      background: BG0,
      borderTop: `1px solid ${BORDER}`,
      fontFamily: MONO,
      color: '#cbd5e1',
    }}>

      {/* ── HEADER ── */}
      <div style={{
        padding: '12px 16px 10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        borderBottom: `1px solid ${BORDER}`,
        background: BG1,
      }}>
        <div>
          <div style={{
            fontFamily: MONO, fontSize: 9, color: '#334155',
            letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4,
          }}>
            {zona.pais?.replace(/\s*[\uD800-\uDFFF]{2}/g, '').trim()}
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 17, fontWeight: 700,
            color: '#f1f5f9', letterSpacing: '-0.02em',
          }}>
            {zona.nombre}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Estado badge — sin redondeo */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: `${cfg.dot}0e`,
            border: `1px solid ${cfg.dot}33`,
            borderLeft: `2px solid ${cfg.dot}`,
            padding: '4px 10px',
          }}>
            <span style={{
              width: 6, height: 6,
              background: cfg.dot,
              display: 'inline-block', flexShrink: 0,
              animation: 'blink 1.4s step-start infinite',
            }} />
            <span style={{
              fontFamily: MONO, fontSize: 9, fontWeight: 700,
              color: cfg.dot, letterSpacing: '0.15em',
            }}>
              {cfg.label}
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${BORDER}`,
            color: '#334155', padding: '4px 10px',
            cursor: 'pointer', fontFamily: MONO, fontSize: 10,
            letterSpacing: '0.1em',
          }}>✕</button>
        </div>
      </div>

      {/* ── ALERTA BANNER ── */}
      <div style={{
        margin: '8px 16px 0',
        background: `${cfg.dot}06`,
        borderLeft: `2px solid ${cfg.dot}`,
        padding: '7px 12px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ width: 6, height: 6, background: cfg.dot, flexShrink: 0, display: 'inline-block' }} />
        <span style={{ fontFamily: MONO, fontSize: 9, color: cfg.dot, fontWeight: 700, letterSpacing: '0.15em' }}>
          {cfg.label} · {zona.cobertura}% COBERTURA CORAL VIVO
        </span>
      </div>

      {/* ── MÉTRICAS ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: 4, padding: '10px 16px',
      }}>
        {[
          { label: 'COBERTURA', value: `${zona.cobertura}%`,                                sub: 'coral vivo',  color: cfg.dot   },
          { label: 'DHW',       value: dhw.toFixed(1),                                      sub: 'sem·°C',      color: dhw > 4 ? '#f97316' : dhw > 1 ? '#fbbf24' : '#34d399' },
          { label: 'ESP. CLAVE',value: zona.especies?.[0]?.split(' ').pop() ?? '—',          sub: 'indicadora',  color: '#38bdf8' },
          { label: 'SALUD',     value: `${salud}%`,                                         sub: 'estimada',    color: salud > 60 ? '#34d399' : salud > 30 ? '#fbbf24' : '#ef4444' },
        ].map(m => (
          <div key={m.label} style={{
            background: BG1,
            border: `1px solid ${BORDER}`,
            position: 'relative', overflow: 'hidden',
            padding: '8px 10px',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: m.color + '55' }} />
            <div style={{ fontFamily: MONO, fontSize: 9, color: '#334155', letterSpacing: '0.15em', marginBottom: 5 }}>
              {m.label}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: m.color, lineHeight: 1 }}>
              {m.value}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: '#1e293b', marginTop: 3 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── ESPECIES ── */}
      <div style={{ padding: '0 16px 12px' }}>
        <SectionLabel>ESPECIES DOMINANTES</SectionLabel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {(zona.especies ?? []).slice(0, 4).map((esp, idx) => {
            const pct   = [100, 94, 61, 80][idx] ?? 70
            const color = SPECIES_COLORS[idx] ?? '#38bdf8'
            return (
              <div key={esp}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, alignItems: 'center' }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: '#475569', fontStyle: 'italic' }}>{esp}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color }}>{pct}%</span>
                </div>
                <div style={{ height: 2, background: 'rgba(255,255,255,0.04)' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    background: `linear-gradient(90deg, ${color}88, ${color})`,
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
        margin: '0 16px 12px',
        padding: '8px 12px',
        borderLeft: `1px solid ${BORDER}`,
        borderBottom: `1px solid ${BORDER}`,
        fontFamily: MONO, fontSize: 10, color: '#334155', lineHeight: 1.7,
      }}>
        {zona.descripcion}
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }
      `}</style>
    </div>
  )
}
