import React from 'react'
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, Circle, useMap } from 'react-leaflet'
import { useState, useEffect, useRef, useCallback } from 'react'
import ReefViewer from '../ReefViewer/ReefViewer'
import { ESPECIES_POR_ZONA, especiesDesdeMetadata } from '../ReefViewer/species/index'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Design tokens ────────────────────────────────────────────────────────────
const MONO  = "'JetBrains Mono','Fira Code','Courier New',monospace"
const BG0   = '#020617'
const BG1   = '#030712'
const BG2   = '#070f1f'
const B     = '1px solid rgba(30,41,59,0.9)'  // border slim

// ── Datos de arrecifes ───────────────────────────────────────────────────────
const ZONAS_REALES = [
  { id: 'los_cobanos',    nombre: 'Los Cóbanos',             pais: 'El Salvador', coords: [13.524,-89.807], cobertura: 4,  ocean:'pacific',   depth:'shallow', especies:['Porites lobata','Pocillopora damicornis','Pavona clavus'],                                                                          estado:'critico',  descripcion:'Único arrecife de El Salvador. Solo 4% de coral vivo.' },
  { id: 'roatan',         nombre: 'Roatán — Cordelia Banks', pais: 'Honduras',    coords: [16.320,-86.535], cobertura: 18, ocean:'caribbean', depth:'shallow', especies:['Acropora cervicornis','Acropora palmata','Diploria labyrinthiformis','Montastraea cavernosa','Orbicella annularis'],              estado:'riesgo',   descripcion:'Perdió cobertura del 46% al 18% en 2024.' },
  { id: 'cozumel',        nombre: 'Cozumel',                 pais: 'México',      coords: [20.420,-86.922], cobertura: 22, ocean:'caribbean', depth:'deep',    especies:['Diploria labyrinthiformis','Orbicella annularis','Acropora palmata','Colpophyllia natans','Agaricia tenuifolia'],                estado:'moderado', descripcion:'Arrecife del Caribe mexicano con alta biodiversidad.' },
  { id: 'cayos_miskitos', nombre: 'Cayos Miskitos',          pais: 'Nicaragua',   coords: [14.380,-82.780], cobertura: 43, ocean:'caribbean', depth:'shallow', especies:['Pseudodiploria strigosa','Montastraea cavernosa','Orbicella faveolata','Agaricia agaricites','Porites astreoides'],              estado:'sano',     descripcion:'El arrecife más saludable de Centroamérica. 43% de cobertura.' },
]

const CFG = {
  sano:     { accent: '#34d399', label: 'SANO'      },
  moderado: { accent: '#fbbf24', label: 'ESTRÉS'    },
  riesgo:   { accent: '#f97316', label: 'EN RIESGO' },
  critico:  { accent: '#ef4444', label: 'CRÍTICO'   },
}

// ── Lógica de pesca responsable ──────────────────────────────────────────────
function getEstadoZona(dhw) {
  if (dhw > 8) return { color:'#ef4444', label:'VEDA',      permitida:false, maxLanchas:0,  descripcion:'Coral en blanqueamiento severo — zona cerrada para recuperación.' }
  if (dhw > 4) return { color:'#f97316', label:'LIMITADA',  permitida:true,  maxLanchas:3,  descripcion:'Coral bajo estrés. Solo pesca de altura, sin buceo ni ancla en coral.' }
  if (dhw > 1) return { color:'#fbbf24', label:'MODERADA',  permitida:true,  maxLanchas:6,  descripcion:'Estrés térmico leve. Pesca moderada permitida, evitar zonas someras.' }
  return         { color:'#34d399', label:'PERMITIDA', permitida:true,  maxLanchas:10, descripcion:'Coral sano. Pesca responsable permitida — ancla solo en arena.' }
}
function calcularSotavento(lat, lon, windDirGrados, distKm=9) {
  const rad = ((windDirGrados+180)%360)*(Math.PI/180)
  const g   = 1/111
  return [lat+Math.cos(rad)*distKm*g, lon+Math.sin(rad)*distKm*g]
}
function calcularRadio(vel, dhw) {
  const base = vel<15?10000:vel<30?7000:5000
  return dhw>4?base*0.6:base
}
function debeRotar(slug) {
  const dia = Math.floor(Date.now()/86400000)
  const arr = ['honduras','nicaragua','quintana_roo','belize']
  return arr[(dia-1+arr.length)%arr.length]===slug
}
const PESCA_META = {
  honduras:     {id:'pesca_roatan',   nombre:'Cordelia Banks'},
  nicaragua:    {id:'pesca_nicaragua',nombre:'Miskito Cays'},
  quintana_roo: {id:'pesca_cozumel', nombre:'Banco Chinchorro'},
  belize:       {id:'pesca_belize',  nombre:'Hol Chan'},
}
const ZONAS_PESCA_FALLBACK = [
  {id:'pesca_roatan',   nombre:'Cordelia Banks',  coords:[16.318,-86.620],radio:6000,sst:'30.3°C',dhw:0.83,viento:'E 37 km/h', enDescanso:false, sotaventoDe:'O', estado:getEstadoZona(0.83), prediccion:'Salida 5:00–6:00 AM. Lado oeste de Cordelia Banks, 15–25 m.',alerta:'Superó umbral de blanqueamiento.'},
  {id:'pesca_nicaragua',nombre:'Miskito Cays',    coords:[14.375,-82.830],radio:7000,sst:'29.9°C',dhw:2.15,viento:'E 35 km/h', enDescanso:false, sotaventoDe:'O', estado:getEstadoZona(2.15), prediccion:'Salida 4:30–5:00 AM. Zonas protegidas al OESTE, 8–15 m.',  alerta:'DHW 2.15 — estrés nivel 2.'},
  {id:'pesca_cozumel',  nombre:'Banco Chinchorro',coords:[18.760,-87.380],radio:8000,sst:'30.2°C',dhw:0.92,viento:'E 23 km/h', enDescanso:false, sotaventoDe:'O', estado:getEstadoZona(0.92), prediccion:'Salida 5:30 AM. Cara oeste del atolón, 8–15 m.',            alerta:'Agua rebasa 30°C y sigue subiendo.'},
  {id:'pesca_belize',   nombre:'Hol Chan',         coords:[17.728,-87.570],radio:5000,sst:'30.9°C',dhw:0.33,viento:'E 27 km/h', enDescanso:false, sotaventoDe:'O', estado:getEstadoZona(0.33), prediccion:'Salida 5:30 AM. Oeste de Hol Chan (sotavento), 8–12 m.',    alerta:'Estrés térmico con DHW subiendo.'},
]
function reefApiAZonaPesca(reef) {
  const meta=PESCA_META[reef.slug]; if(!meta)return null
  const v=reef.viento??{}, d=reef.datos??{}, dhw=d.dhw??0
  const lat=reef.coordenadas?.lat??0, lon=reef.coordenadas?.lon??0
  const coords=v.direccion_grados!=null?calcularSotavento(lat,lon,v.direccion_grados):[lat,lon-0.08]
  const radio=calcularRadio(v.velocidad_kmh??20,dhw)
  const enDescanso=debeRotar(reef.slug)
  const estado=enDescanso?{color:'#6366f1',label:'DESCANSO',permitida:false,maxLanchas:0,descripcion:'Esta zona descansa hoy.'}:getEstadoZona(dhw)
  return {id:meta.id,nombre:meta.nombre,coords,radio,enDescanso,estado,
    sst:d.sst_max!=null?`${d.sst_max}°C`:'—',dhw,cobertura:reef.cobertura??null,
    viento:v.velocidad_kmh!=null?`${v.direccion_cardinal??''} ${v.velocidad_kmh} km/h`:'—',
    sotaventoDe:v.direccion_cardinal??'?',
    prediccion:reef.predictions?.pesca??'Sin predicción disponible.',
    blanqueamiento:reef.predictions?.blanqueamiento??'Sin prediccion disponible para los proximos dias.',
    salud:reef.predictions?.salud??'Sin resumen de salud disponible.',
    tendencia:reef.tendencia??null,
    alerta:reef.predictions?.alerta??'',fecha:reef.fecha??''}
}

// ── Iconos Leaflet ────────────────────────────────────────────────────────────
function createFishIcon(activo=false) {
  const s=activo?38:32
  return L.divIcon({className:'',iconSize:[s,s],iconAnchor:[s/2,s/2],html:`
    <div style="width:${s}px;height:${s}px;background:${activo?'rgba(6,182,212,0.25)':'rgba(6,182,212,0.1)'};
      border:1px solid ${activo?'rgba(6,182,212,0.9)':'rgba(6,182,212,0.4)'};
      display:flex;align-items:center;justify-content:center;font-size:${activo?20:16}px;
      box-shadow:0 0 ${activo?16:8}px rgba(6,182,212,${activo?0.5:0.2})">🎣</div>`})
}
const STATUS_COLORS = {sano:'#34d399',moderado:'#fbbf24',riesgo:'#f97316',critico:'#ef4444'}
const STATUS_LABELS = {sano:'Sano',moderado:'Estrés Térmico',riesgo:'En Riesgo',critico:'Blanqueamiento Severo'}
function getDHWPorEstado(e){return e==='sano'?2:e==='moderado'?5:e==='riesgo'?9:13}
function createGlowIcon(estado,activo=false){
  const color=STATUS_COLORS[estado]??'#34d399',s=activo?34:26,inner=activo?14:10
  return L.divIcon({className:'',iconSize:[s,s],iconAnchor:[s/2,s/2],popupAnchor:[0,-s/2-4],html:`
    <div style="position:relative;width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;border:2px solid ${color};opacity:0.4;animation:pulse 2s infinite;border-radius:2px"></div>
      <div style="width:${inner}px;height:${inner}px;background:${color};box-shadow:0 0 10px ${color},0 0 20px ${color}44"></div>
    </div>`})
}
function MapReady(){const map=useMap();useEffect(()=>{setTimeout(()=>map.invalidateSize(),100)},[map]);return null}

const API_URL = import.meta.env.VITE_API_URL ?? 'https://hackaton-ambiental-production.up.railway.app'
const SP_COLORS = ['#a78bfa','#34d399','#38bdf8','#fb923c']
const SP_PCT    = [100,94,61,80]

// ── Componentes UI ────────────────────────────────────────────────────────────
function Label({children}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
      <span style={{fontFamily:MONO,fontSize:8,color:'#334155',letterSpacing:'0.22em',textTransform:'uppercase',whiteSpace:'nowrap'}}>{children}</span>
      <div style={{flex:1,height:1,background:'rgba(30,41,59,0.9)'}}/>
    </div>
  )
}
function MetricBox({label,value,color}){
  return(
    <div style={{background:BG0,padding:'10px 12px',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:color+'55'}}/>
      <div style={{fontFamily:MONO,fontSize:8,color:'#334155',letterSpacing:'0.18em',marginBottom:6}}>{label}</div>
      <div style={{fontFamily:MONO,fontSize:18,fontWeight:700,lineHeight:1,color}}>{value}</div>
    </div>
  )
}
function extraerHorario(texto) {
  const match = String(texto ?? '').match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?(?:\s*[–-]\s*\d{1,2}:\d{2}\s*(?:AM|PM)?)?)/i)
  return match?.[1] ?? 'Temprano, antes del viento fuerte'
}
function nivelHumano(dhw) {
  if (dhw >= 8) return 'Muy alto'
  if (dhw >= 4) return 'Alto'
  if (dhw >= 1) return 'Medio'
  return 'Bajo'
}
function saludCoral(dhw) {
  return Math.max(6, Math.min(98, Math.round(96 - (dhw ?? 0) * 10)))
}
function textoSalud(score) {
  if (score >= 80) return 'Salud estable'
  if (score >= 55) return 'Vigilar de cerca'
  if (score >= 30) return 'Estres alto'
  return 'Riesgo critico'
}
function consejoPescaArrecife(zona) {
  if (zona.estado === 'critico') return 'Evitar pesca cerca del coral. Buscar zonas arenosas o aguas mas profundas.'
  if (zona.estado === 'riesgo') return 'Pescar con cupo bajo y sin anclar sobre coral. Mejor salir temprano.'
  if (zona.estado === 'moderado') return 'Pesca responsable permitida. Mantener distancia del coral somero.'
  return 'Zona favorable para pesca responsable. Cuidar tallas minimas y evitar dañar el fondo.'
}
function consejoCuidadoArrecife(zona) {
  if (zona.estado === 'critico') return 'Prioridad alta: reportar blanqueamiento, reducir turismo intenso y evitar contacto.'
  if (zona.estado === 'riesgo') return 'Vigilar cambios de color y temperatura. Evitar anclas y actividad intensa.'
  if (zona.estado === 'moderado') return 'Monitorear esta semana y mantener buenas practicas de navegación.'
  return 'Arrecife estable. Mantener monitoreo y pesca responsable para conservarlo.'
}
function weeklySeries(zona) {
  const dhw = zona?.tendencia?.dhw_serie?.map(Number).filter(n=>Number.isFinite(n))
  if (dhw?.length) return dhw.slice(-7)
  const now = Number(zona?.dhw ?? 0)
  return [0.82,0.88,0.94,1,1.06,1.12,1.18].map(x=>Math.max(0,Number((now*x).toFixed(2))))
}
function WeeklyChart({zona}) {
  const data = weeklySeries(zona)
  const max = Math.max(1,...data)
  const points = data.map((v,i)=>`${18+i*(244/(data.length-1))},${112-(v/max)*76}`).join(' ')
  const area = `18,116 ${points} 262,116`
  return (
    <div style={{background:'rgba(248,250,252,0.84)',border:'1px solid rgba(15,23,42,0.12)',boxShadow:'0 14px 36px rgba(2,6,23,0.16)',padding:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
        <div>
          <div style={{fontSize:14,fontWeight:800,color:'#0f172a'}}>Prediccion semanal</div>
          <div style={{fontSize:11,color:'#64748b'}}>Acumulacion de calor DHW, 7 dias</div>
        </div>
        <div style={{fontFamily:MONO,fontSize:10,color:'#10b981',background:'rgba(52,211,153,0.12)',padding:'4px 7px'}}>DHW</div>
      </div>
      <svg viewBox="0 0 280 128" style={{width:'100%',height:128,display:'block'}}>
        {[34,58,82,106].map(y=><line key={y} x1="18" x2="262" y1={y} y2={y} stroke="rgba(15,23,42,0.08)" strokeWidth="1"/>)}
        <polygon points={area} fill="rgba(52,211,153,0.18)"/>
        <polyline points={points} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        {data.map((v,i)=><circle key={i} cx={18+i*(244/(data.length-1))} cy={112-(v/max)*76} r="3.5" fill="#10b981"/>)}
        {['Hoy','D2','D3','D4','D5','D6','D7'].map((d,i)=><text key={d} x={18+i*(244/6)} y="126" textAnchor="middle" fontSize="9" fill="#64748b">{d}</text>)}
      </svg>
    </div>
  )
}
function DecisionCard({label, value, detail, color}) {
  return (
    <div style={{background:'rgba(248,250,252,0.88)',border:'1px solid rgba(15,23,42,0.12)',borderTop:`3px solid ${color}`,boxShadow:'0 14px 36px rgba(2,6,23,0.14)',padding:'14px 15px'}}>
      <div style={{fontSize:11,color:'#64748b',fontWeight:700,marginBottom:8}}>{label}</div>
      <div style={{fontSize:24,fontWeight:900,color:'#0f172a',lineHeight:1.05,marginBottom:8}}>{value}</div>
      <div style={{fontSize:12,color:'#475569',lineHeight:1.45,fontWeight:600}}>{detail}</div>
    </div>
  )
}

export default function CoralMap() {
  const [zonaActiva,  setZonaActiva]  = useState(null)
  const [pescaActiva, setPescaActiva] = useState(null)
  const [reefGeoJson, setReefGeoJson] = useState(null)
  const [zonasPesca,  setZonasPesca]  = useState(ZONAS_PESCA_FALLBACK)
  const [apiOnline,   setApiOnline]   = useState(false)
  const [tab,         setTab]         = useState('arrecife') // 'arrecife' | 'pesca'
  const [slide,       setSlide]       = useState(0)
  const [panelWidth,  setPanelWidth]  = useState(380)
  const isDragging  = useRef(false)
  const startX      = useRef(0)
  const startWidth  = useRef(0)

  const onDragStart = useCallback((e)=>{
    isDragging.current=true; startX.current=e.clientX; startWidth.current=panelWidth
    document.body.style.cursor='col-resize'; document.body.style.userSelect='none'
  },[panelWidth])

  useEffect(()=>{
    const onMove=(e)=>{
      if(!isDragging.current)return
      const dx=startX.current-e.clientX
      setPanelWidth(Math.min(Math.max(startWidth.current+dx,280),window.innerWidth*0.85))
    }
    const onUp=()=>{
      if(!isDragging.current)return
      isDragging.current=false; document.body.style.cursor=''; document.body.style.userSelect=''
    }
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp)
    return()=>{window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp)}
  },[])

  useEffect(()=>{
    let c=false
    fetch('/data/Mesoamerica.geojson').then(r=>{if(!r.ok)throw r;return r.json()}).then(d=>{if(!c)setReefGeoJson(d)}).catch(()=>{})
    return()=>{c=true}
  },[])

  useEffect(()=>{
    let c=false
    fetch(`${API_URL}/reefs`).then(r=>{if(!r.ok)throw r;return r.json()}).then(data=>{
      if(c)return
      const z=data.map(reefApiAZonaPesca).filter(Boolean)
      if(z.length>0){setZonasPesca(z);setApiOnline(true)}
    }).catch(()=>{})
    return()=>{c=true}
  },[])

  function abrirArrecife(z){setZonaActiva(z);setPescaActiva(null);setPanelWidth(window.innerWidth*0.45)}
  function abrirPesca(z)   {setPescaActiva(z);setZonaActiva(null);setPanelWidth(380)}

  const panelAbierto = zonaActiva||pescaActiva
  const cfgActiva    = zonaActiva ? CFG[zonaActiva.estado] : null
  const zonasOrdenadas = [...zonasPesca].sort((a,b)=>(a.dhw??0)-(b.dhw??0))
  const mejorZona = zonasOrdenadas.find(z=>z.estado?.permitida) ?? zonasOrdenadas[0]
  const zonaRiesgo = [...zonasPesca].sort((a,b)=>(b.dhw??0)-(a.dhw??0))[0]
  const zonaGuia = pescaActiva ?? mejorZona
  const zonasEnAlerta = zonasPesca.filter(z=>(z.dhw??0)>=1).length
  const colorGuia = zonaGuia?.estado?.color ?? '#34d399'
  const decisionPesca = zonaGuia?.estado?.permitida ? 'Si se puede salir' : 'Mejor descansar la zona'
  const detallePesca = zonaGuia?.estado?.permitida
    ? `${zonaGuia.nombre}: salir ${extraerHorario(zonaGuia.prediccion)} y pescar del lado protegido.`
    : `${zonaGuia?.nombre ?? 'Zona seleccionada'} necesita recuperacion hoy.`
  const resumenProximosDias = zonaRiesgo?.blanqueamiento ?? zonaRiesgo?.alerta ?? 'Sin prediccion disponible.'
  const saludHoy = saludCoral(zonaGuia?.dhw)
  const zonasSeguras = zonasPesca.filter(z=>z.estado?.permitida).sort((a,b)=>(a.dhw??0)-(b.dhw??0)).slice(0,3)
  const slides = [
    { key:'salud', title:'Salud del coral', eyebrow:'Hoy', color:colorGuia },
    { key:'semana', title:'Prediccion semanal', eyebrow:'Proximos 7 dias', color:colorGuia },
    { key:'pesca', title:'Zonas seguras', eyebrow:'Pesca responsable', color:colorGuia },
  ]
  const activeSlide = slides[slide % slides.length]

  return (
    <div style={{display:'flex',height:'100vh',background:BG0,overflow:'hidden',fontFamily:'system-ui,sans-serif'}}>

      {/* ══ SIDEBAR IZQUIERDO ══ */}
      <div style={{width:320,flexShrink:0,background:'rgba(241,245,249,0.9)',borderRight:'1px solid rgba(255,255,255,0.55)',display:'flex',flexDirection:'column',boxShadow:'18px 0 48px rgba(2,6,23,0.28)',backdropFilter:'blur(18px)'}}>

        {/* Logo */}
        <div style={{padding:'16px 16px 12px',borderBottom:'1px solid rgba(15,23,42,0.12)',background:'rgba(248,250,252,0.72)'}}>
          <div style={{fontFamily:MONO,fontSize:8,color:'#10b981',letterSpacing:'0.25em',marginBottom:4,fontWeight:900}}>SYS // MONITOR</div>
          <div style={{fontSize:18,fontWeight:950,color:'#0f172a',letterSpacing:'-0.01em'}}>CoralWatch</div>
          <div style={{fontFamily:MONO,fontSize:8,color:'#0f766e',letterSpacing:'0.2em',marginTop:3,fontWeight:800}}>CARIBE · NOAA · LIVE</div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'1px solid rgba(15,23,42,0.12)',background:'rgba(226,232,240,0.65)',padding:6,gap:6}}>
          {[['arrecife','🪸 Arrecife'],['pesca','🎣 Pesca']].map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              flex:1,padding:'9px 4px',fontFamily:MONO,fontSize:8,letterSpacing:'0.15em',textTransform:'uppercase',cursor:'pointer',
              background:tab===t?'rgba(255,255,255,0.88)':'rgba(255,255,255,0.42)',
              color:tab===t?'#059669':'#64748b',border:tab===t?'1px solid rgba(16,185,129,0.25)':'1px solid rgba(15,23,42,0.08)',fontWeight:900,
            }}>{label}</button>
          ))}
        </div>

        {/* Carrusel sencillo para pescadores */}
        {false&&zonaGuia&&(
          <div style={{
            margin:12,background:'rgba(241,245,249,0.92)',border:'1px solid rgba(255,255,255,0.55)',
            boxShadow:'0 18px 42px rgba(2,6,23,0.28)',padding:12,backdropFilter:'blur(18px)'
          }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:10,color:activeSlide.color,fontWeight:900,letterSpacing:'0.1em',textTransform:'uppercase'}}>{activeSlide.eyebrow}</div>
                <div style={{fontSize:20,fontWeight:950,color:'#0f172a',letterSpacing:0,lineHeight:1.05}}>{activeSlide.title}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <button onClick={()=>setSlide((slide+slides.length-1)%slides.length)} style={{width:28,height:28,border:'1px solid rgba(15,23,42,0.12)',background:'rgba(255,255,255,0.72)',fontWeight:900,cursor:'pointer',color:'#0f172a'}}>‹</button>
                <button onClick={()=>setSlide((slide+1)%slides.length)} style={{width:28,height:28,border:'1px solid rgba(15,23,42,0.12)',background:'rgba(255,255,255,0.72)',fontWeight:900,cursor:'pointer',color:'#0f172a'}}>›</button>
              </div>
            </div>

            {activeSlide.key==='salud'&&(
              <div style={{display:'grid',gap:8}}>
                <DecisionCard label="Salud del coral hoy" value={`${saludHoy}%`} detail={`${textoSalud(saludHoy)} en ${zonaGuia.nombre}. DHW ${zonaGuia.dhw}.`} color={colorGuia}/>
                <DecisionCard label="Pesca de hoy" value={decisionPesca} detail={detallePesca} color={colorGuia}/>
              </div>
            )}

            {activeSlide.key==='semana'&&(
              <div style={{display:'grid',gap:8}}>
                <WeeklyChart zona={zonaGuia}/>
                <div style={{fontSize:12,color:'#334155',fontWeight:700,lineHeight:1.55,background:'rgba(255,255,255,0.62)',border:'1px solid rgba(15,23,42,0.1)',padding:'9px 10px'}}>
                  {resumenProximosDias.slice(0,170)+(resumenProximosDias.length>170?'...':'')}
                </div>
              </div>
            )}

            {activeSlide.key==='pesca'&&(
              <div style={{background:'rgba(248,250,252,0.84)',border:'1px solid rgba(15,23,42,0.12)',boxShadow:'0 12px 28px rgba(2,6,23,0.14)',padding:12}}>
                <div style={{fontSize:14,fontWeight:800,color:'#0f172a',marginBottom:2}}>Zonas de pesca seguras</div>
                <div style={{fontSize:11,color:'#64748b',marginBottom:8}}>Ordenadas por menor estres termico</div>
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {zonasSeguras.map(z=>(
                    <button key={z.id} onClick={()=>abrirPesca(z)} style={{
                      display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'center',textAlign:'left',
                      background:'rgba(255,255,255,0.72)',border:'1px solid rgba(15,23,42,0.1)',padding:'8px 9px',cursor:'pointer'
                    }}>
                      <span>
                        <span style={{display:'block',fontSize:12,fontWeight:800,color:'#0f172a'}}>{z.nombre}</span>
                        <span style={{display:'block',fontSize:10,color:'#64748b'}}>Salir {extraerHorario(z.prediccion)}</span>
                      </span>
                      <span style={{fontFamily:MONO,fontSize:9,fontWeight:800,color:z.estado?.color,background:`${z.estado?.color}18`,padding:'5px 6px'}}>
                        DHW {z.dhw}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:10}}>
              <div style={{display:'flex',gap:6}}>
                {slides.map((s,i)=>(
                  <button key={s.key} onClick={()=>setSlide(i)} aria-label={s.title} style={{
                    width:i===slide?22:7,height:7,borderRadius:999,border:'none',
                    background:i===slide?activeSlide.color:'rgba(15,23,42,0.22)',cursor:'pointer'
                  }}/>
                ))}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6,fontSize:10,fontWeight:800,color:apiOnline?'#047857':'#92400e'}}>
                <span style={{width:7,height:7,borderRadius:999,background:apiOnline?'#10b981':'#f59e0b'}}/>
                {apiOnline?'Datos en vivo':'Datos guardados'}
              </div>
            </div>
          </div>
        )}

        {/* Lista de zonas */}
        <div style={{flex:1,overflowY:'auto',padding:'10px 12px'}}>
          {tab==='arrecife' && ZONAS_REALES.map(z=>{
            const c=CFG[z.estado]
            const activo=zonaActiva?.id===z.id
            return(
              <button key={z.id} onClick={()=>abrirArrecife(z)} style={{
                width:'100%',textAlign:'left',padding:'11px 12px',marginBottom:8,
                border:`1px solid ${activo?c.accent+'55':'rgba(15,23,42,0.1)'}`,borderTop:`3px solid ${c.accent}`,
                cursor:'pointer',boxShadow:activo?'0 12px 28px rgba(2,6,23,0.16)':'0 8px 18px rgba(2,6,23,0.08)',
                background:activo?'rgba(255,255,255,0.96)':'rgba(248,250,252,0.82)',
              }}>
                <div style={{fontFamily:MONO,fontSize:8,color:c.accent,letterSpacing:'0.2em',marginBottom:4,fontWeight:900}}>{c.label}</div>
                <div style={{fontSize:13,fontWeight:900,color:'#0f172a',lineHeight:1.25,marginBottom:4}}>{z.nombre}</div>
                <div style={{fontFamily:MONO,fontSize:9,color:'#334155'}}>{z.pais} · {z.cobertura}%</div>
              </button>
            )
          })}

          {tab==='pesca' && zonasPesca.map(z=>{
            const activo=pescaActiva?.id===z.id
            return(
              <button key={z.id} onClick={()=>abrirPesca(z)} style={{
                width:'100%',textAlign:'left',padding:'11px 12px',marginBottom:8,
                border:`1px solid ${activo?(z.estado?.color??'#10b981')+'55':'rgba(15,23,42,0.1)'}`,borderTop:`3px solid ${z.estado?.color??'#10b981'}`,
                cursor:'pointer',boxShadow:activo?'0 12px 28px rgba(2,6,23,0.16)':'0 8px 18px rgba(2,6,23,0.08)',
                background:activo?'rgba(255,255,255,0.96)':'rgba(248,250,252,0.82)',
              }}>
                <div style={{fontFamily:MONO,fontSize:8,color:z.estado?.color??'#10b981',letterSpacing:'0.2em',marginBottom:4,fontWeight:900}}>{z.estado?.label}</div>
                <div style={{fontSize:13,fontWeight:900,color:'#0f172a',marginBottom:4}}>🎣 {z.nombre}</div>
                <div style={{fontFamily:MONO,fontSize:9,color:'#64748b',fontWeight:700}}>DHW {z.dhw} · {z.viento}</div>
              </button>
            )
          })}

          {/* Carrusel debajo de la lista */}
          {zonaGuia&&(
            <div style={{
              margin:12,background:'rgba(241,245,249,0.92)',border:'1px solid rgba(255,255,255,0.55)',
              boxShadow:'0 18px 42px rgba(2,6,23,0.28)',padding:12,backdropFilter:'blur(18px)'
            }}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,marginBottom:10}}>
                <div>
                  <div style={{fontSize:10,color:activeSlide.color,fontWeight:900,letterSpacing:'0.1em',textTransform:'uppercase'}}>{activeSlide.eyebrow}</div>
                  <div style={{fontSize:20,fontWeight:950,color:'#0f172a',letterSpacing:0,lineHeight:1.05}}>{activeSlide.title}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <button onClick={()=>setSlide((slide+slides.length-1)%slides.length)} style={{width:28,height:28,border:'1px solid rgba(15,23,42,0.12)',background:'rgba(255,255,255,0.72)',fontWeight:900,cursor:'pointer',color:'#0f172a'}}>‹</button>
                  <button onClick={()=>setSlide((slide+1)%slides.length)} style={{width:28,height:28,border:'1px solid rgba(15,23,42,0.12)',background:'rgba(255,255,255,0.72)',fontWeight:900,cursor:'pointer',color:'#0f172a'}}>›</button>
                </div>
              </div>

              {activeSlide.key==='salud'&&(
                <div style={{display:'grid',gap:8}}>
                  <DecisionCard label="Salud del coral hoy" value={`${saludHoy}%`} detail={`${textoSalud(saludHoy)} en ${zonaGuia.nombre}. DHW ${zonaGuia.dhw}.`} color={colorGuia}/>
                  <DecisionCard label="Pesca de hoy" value={decisionPesca} detail={detallePesca} color={colorGuia}/>
                </div>
              )}

              {activeSlide.key==='semana'&&(
                <div style={{display:'grid',gap:8}}>
                  <WeeklyChart zona={zonaGuia}/>
                  <div style={{fontSize:12,color:'#334155',fontWeight:700,lineHeight:1.55,background:'rgba(255,255,255,0.62)',border:'1px solid rgba(15,23,42,0.1)',padding:'9px 10px'}}>
                    {resumenProximosDias.slice(0,170)+(resumenProximosDias.length>170?'...':'')}
                  </div>
                </div>
              )}

              {activeSlide.key==='pesca'&&(
                <div style={{background:'rgba(248,250,252,0.84)',border:'1px solid rgba(15,23,42,0.12)',boxShadow:'0 12px 28px rgba(2,6,23,0.14)',padding:12}}>
                  <div style={{fontSize:14,fontWeight:800,color:'#0f172a',marginBottom:2}}>Zonas de pesca seguras</div>
                  <div style={{fontSize:11,color:'#64748b',marginBottom:8}}>Ordenadas por menor estres termico</div>
                  <div style={{display:'flex',flexDirection:'column',gap:7}}>
                    {zonasSeguras.map(z=>(
                      <button key={z.id} onClick={()=>abrirPesca(z)} style={{
                        display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'center',textAlign:'left',
                        background:'rgba(255,255,255,0.72)',border:'1px solid rgba(15,23,42,0.1)',padding:'8px 9px',cursor:'pointer'
                      }}>
                        <span>
                          <span style={{display:'block',fontSize:12,fontWeight:800,color:'#0f172a'}}>{z.nombre}</span>
                          <span style={{display:'block',fontSize:10,color:'#64748b'}}>Salir {extraerHorario(z.prediccion)}</span>
                        </span>
                        <span style={{fontFamily:MONO,fontSize:9,fontWeight:800,color:z.estado?.color,background:`${z.estado?.color}18`,padding:'5px 6px'}}>
                          DHW {z.dhw}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:10}}>
                <div style={{display:'flex',gap:6}}>
                  {slides.map((s,i)=>(
                    <button key={s.key} onClick={()=>setSlide(i)} aria-label={s.title} style={{
                      width:i===slide?22:7,height:7,borderRadius:999,border:'none',
                      background:i===slide?activeSlide.color:'rgba(15,23,42,0.22)',cursor:'pointer'
                    }}/>
                  ))}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6,fontSize:10,fontWeight:800,color:apiOnline?'#047857':'#92400e'}}>
                  <span style={{width:7,height:7,borderRadius:999,background:apiOnline?'#10b981':'#f59e0b'}}/>
                  {apiOnline?'Datos en vivo':'Datos guardados'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer API status */}
        <div style={{padding:'10px 14px',borderTop:'1px solid rgba(15,23,42,0.12)',display:'flex',alignItems:'center',gap:6,background:'rgba(248,250,252,0.72)'}}>
          <span style={{width:5,height:5,background:apiOnline?'#34d399':'#fbbf24',display:'inline-block',animation:'blink 1.4s step-start infinite'}}/>
          <span style={{fontFamily:MONO,fontSize:8,color:apiOnline?'#047857':'#92400e',letterSpacing:'0.15em',fontWeight:900}}>
            {apiOnline?'API ONLINE':'CACHE LOCAL'}
          </span>
        </div>
      </div>

      {/* ══ MAPA ══ */}
      <div style={{flex:1,minWidth:0,position:'relative'}}>
        <MapContainer center={[15.5,-85.0]} zoom={6} zoomControl={true} attributionControl={false}
          style={{width:'100%',height:'100%',background:BG0}}>
          <MapReady/>
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={18}/>
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" maxZoom={18}/>
          {reefGeoJson&&<GeoJSON data={reefGeoJson} style={{color:'#dc2626',fillColor:'#dc2626',fillOpacity:0.2,weight:1.5}}/>}

          {zonasPesca.map(z=>(
            <React.Fragment key={z.id}>
              <Circle center={z.coords} radius={z.radio} pathOptions={{
                color:z.estado?.color??'#06b6d4',fillColor:z.estado?.color??'#06b6d4',
                fillOpacity:z.estado?.permitida?0.06:0.15,weight:z.estado?.permitida?1:2,
                dashArray:z.estado?.permitida?'6 4':'2 4'}}/>
              <Marker position={z.coords} icon={createFishIcon(pescaActiva?.id===z.id)} eventHandlers={{click:()=>abrirPesca(z)}}/>
            </React.Fragment>
          ))}

          {ZONAS_REALES.map(z=>(
            <Marker key={z.id} position={z.coords} icon={createGlowIcon(z.estado,zonaActiva?.id===z.id)} eventHandlers={{click:()=>abrirArrecife(z)}}>
              <Popup>
                <div style={{background:BG1,color:'#e2e8f0',padding:'12px 14px',border:`1px solid ${STATUS_COLORS[z.estado]}33`,borderLeft:`3px solid ${STATUS_COLORS[z.estado]}`,fontFamily:MONO,minWidth:200,borderRadius:0}}>
                  <div style={{fontSize:9,color:'#334155',letterSpacing:'0.2em',marginBottom:4}}>{z.pais.toUpperCase()}</div>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:'#f1f5f9',fontFamily:'system-ui'}}>{z.nombre}</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 10px',fontSize:10,color:'#475569',marginBottom:10}}>
                    <span>Cobertura</span><span style={{color:STATUS_COLORS[z.estado],fontWeight:700}}>{z.cobertura}%</span>
                    <span>Estado</span>  <span style={{color:STATUS_COLORS[z.estado],fontWeight:700}}>{STATUS_LABELS[z.estado]}</span>
                  </div>
                  <button onClick={()=>abrirArrecife(z)} style={{
                    width:'100%',padding:'7px 0',background:`${STATUS_COLORS[z.estado]}12`,
                    border:`1px solid ${STATUS_COLORS[z.estado]}44`,borderRadius:0,cursor:'pointer',
                    color:STATUS_COLORS[z.estado],fontFamily:MONO,fontWeight:700,fontSize:9,letterSpacing:'0.15em',textTransform:'uppercase',
                  }}>VER ARRECIFE 3D →</button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Carrusel sencillo para pescadores */}
        {false&&zonaGuia&&(
          <div style={{
            position:'absolute',top:16,left:16,zIndex:1000,width:'min(430px,calc(100% - 32px))',
            background:'rgba(241,245,249,0.82)',border:'1px solid rgba(255,255,255,0.55)',
            boxShadow:'0 24px 70px rgba(2,6,23,0.32)',padding:14,backdropFilter:'blur(18px)'
          }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:12}}>
              <div>
                <div style={{fontSize:11,color:activeSlide.color,fontWeight:900,letterSpacing:'0.1em',textTransform:'uppercase'}}>{activeSlide.eyebrow}</div>
                <div style={{fontSize:23,fontWeight:950,color:'#0f172a',letterSpacing:0,lineHeight:1.05}}>{activeSlide.title}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <button onClick={()=>setSlide((slide+slides.length-1)%slides.length)} style={{width:30,height:30,border:'1px solid rgba(15,23,42,0.12)',background:'rgba(255,255,255,0.72)',fontWeight:900,cursor:'pointer',color:'#0f172a'}}>‹</button>
                <button onClick={()=>setSlide((slide+1)%slides.length)} style={{width:30,height:30,border:'1px solid rgba(15,23,42,0.12)',background:'rgba(255,255,255,0.72)',fontWeight:900,cursor:'pointer',color:'#0f172a'}}>›</button>
              </div>
            </div>

            {activeSlide.key==='salud'&&(
              <div style={{display:'grid',gap:10}}>
                <DecisionCard
                  label="Salud del coral hoy"
                  value={`${saludHoy}%`}
                  detail={`${textoSalud(saludHoy)} en ${zonaGuia.nombre}. DHW ${zonaGuia.dhw}.`}
                  color={colorGuia}
                />
                <DecisionCard
                  label="Pesca de hoy"
                  value={decisionPesca}
                  detail={detallePesca}
                  color={colorGuia}
                />
              </div>
            )}

            {activeSlide.key==='semana'&&(
              <div style={{display:'grid',gap:10}}>
                <WeeklyChart zona={zonaGuia}/>
                <div style={{fontSize:12,color:'#334155',fontWeight:700,lineHeight:1.55,background:'rgba(255,255,255,0.62)',border:'1px solid rgba(15,23,42,0.1)',padding:'10px 12px'}}>
                  {resumenProximosDias.slice(0,190)+(resumenProximosDias.length>190?'...':'')}
                </div>
              </div>
            )}

            {activeSlide.key==='pesca'&&(
              <div style={{background:'rgba(248,250,252,0.84)',border:'1px solid rgba(15,23,42,0.12)',boxShadow:'0 14px 36px rgba(2,6,23,0.16)',padding:14}}>
                <div style={{fontSize:14,fontWeight:800,color:'#0f172a',marginBottom:2}}>Zonas de pesca seguras</div>
                <div style={{fontSize:11,color:'#64748b',marginBottom:10}}>Ordenadas por menor estres termico</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {zonasSeguras.map(z=>(
                    <button key={z.id} onClick={()=>abrirPesca(z)} style={{
                      display:'grid',gridTemplateColumns:'1fr auto',gap:10,alignItems:'center',textAlign:'left',
                      background:'rgba(255,255,255,0.72)',border:'1px solid rgba(15,23,42,0.1)',padding:'9px 10px',cursor:'pointer'
                    }}>
                      <span>
                        <span style={{display:'block',fontSize:13,fontWeight:800,color:'#0f172a'}}>{z.nombre}</span>
                        <span style={{display:'block',fontSize:11,color:'#64748b'}}>Salir {extraerHorario(z.prediccion)}</span>
                      </span>
                      <span style={{fontFamily:MONO,fontSize:10,fontWeight:800,color:z.estado?.color,background:`${z.estado?.color}18`,padding:'5px 7px'}}>
                        DHW {z.dhw}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:12}}>
              <div style={{display:'flex',gap:6}}>
                {slides.map((s,i)=>(
                  <button key={s.key} onClick={()=>setSlide(i)} aria-label={s.title} style={{
                    width:i===slide?22:7,height:7,borderRadius:999,border:'none',
                    background:i===slide?activeSlide.color:'rgba(15,23,42,0.22)',cursor:'pointer'
                  }}/>
                ))}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6,fontSize:10,fontWeight:800,color:apiOnline?'#047857':'#92400e'}}>
                <span style={{width:7,height:7,borderRadius:999,background:apiOnline?'#10b981':'#f59e0b'}}/>
                {apiOnline?'Datos en vivo':'Datos guardados'}
              </div>
            </div>
          </div>
        )}

        {/* HUD coords */}
        <div style={{position:'absolute',bottom:12,left:12,zIndex:1000,background:BG1,border:B,padding:'5px 10px',fontFamily:MONO,fontSize:9,color:'#334155'}}>
          15.50°N · 85.00°W · Z6
        </div>

        {/* Leyenda */}
        <div style={{
          position:'absolute',bottom:12,right:12,zIndex:1000,
          background:'rgba(241,245,249,0.9)',border:'1px solid rgba(255,255,255,0.55)',
          boxShadow:'0 18px 42px rgba(2,6,23,0.28)',padding:'12px 14px',backdropFilter:'blur(18px)'
        }}>
          <div style={{fontFamily:MONO,fontSize:8,color:'#059669',letterSpacing:'0.22em',marginBottom:9,fontWeight:900}}>RIESGO DE BLANQUEAMIENTO</div>
          {Object.entries(STATUS_LABELS).map(([k,label])=>(
            <div key={k} style={{display:'flex',alignItems:'center',gap:8,fontFamily:MONO,fontSize:10,color:'#0f172a',marginBottom:6,fontWeight:800}}>
              <span style={{width:9,height:9,background:STATUS_COLORS[k],display:'inline-block',flexShrink:0,boxShadow:`0 0 0 3px ${STATUS_COLORS[k]}18`}}/>
              {label}
            </div>
          ))}
          <div style={{borderTop:'1px solid rgba(15,23,42,0.12)',marginTop:8,paddingTop:8}}>
            <div style={{display:'flex',alignItems:'center',gap:8,fontFamily:MONO,fontSize:10,color:'#0f172a',fontWeight:800}}>
              <span style={{width:9,height:9,border:'1px dashed #10b981',display:'inline-block',flexShrink:0,background:'rgba(52,211,153,0.12)'}}/>
              Zona de Pesca
            </div>
          </div>
        </div>
      </div>

      {/* ══ PANEL DERECHO ══ */}
      {panelAbierto&&(
        <>
          {/* Drag handle */}
          <div onMouseDown={onDragStart} style={{
            width:4,flexShrink:0,cursor:'col-resize',background:'transparent',
            borderLeft:`1px solid ${cfgActiva?cfgActiva.accent+'55':'rgba(6,182,212,0.3)'}`,position:'relative',zIndex:10,
          }}>
            <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',display:'flex',flexDirection:'column',gap:4}}>
              {[0,1,2,3,4].map(i=><div key={i} style={{width:2,height:2,background:cfgActiva?cfgActiva.accent+'88':'rgba(6,182,212,0.6)'}}/>)}
            </div>
          </div>

          <div style={{width:panelWidth,flexShrink:0,background:BG0,borderLeft:B,display:'flex',flexDirection:'column',overflowY:'auto',animation:'slideIn 0.25s ease'}}>

            {/* ── Panel Arrecife 3D ── */}
            {zonaActiva&&(
              <div style={{position:'relative',flex:1,minHeight:0}}>
                <div style={{position:'absolute',inset:0}}>
                  <ReefViewer zone={zonaActiva.id} dhw={getDHWPorEstado(zonaActiva.estado)}
                    especies={zonaActiva.modelos??ESPECIES_POR_ZONA[zonaActiva.id]??especiesDesdeMetadata(zonaActiva)}
                    cobertura={zonaActiva.cobertura} descripcion={zonaActiva.descripcion}/>
                </div>

                {/* Cerrar */}
                <button onClick={()=>setZonaActiva(null)} style={{
                  position:'absolute',top:10,right:10,zIndex:20,background:BG1,border:B,
                  color:'#334155',padding:'4px 12px',cursor:'pointer',fontFamily:MONO,fontSize:9,letterSpacing:'0.1em',
                }}>✕ ESC</button>

                {/* Overlay bottom */}
                <div style={{
                  position:'absolute',bottom:0,left:0,right:0,zIndex:20,
                  background:`linear-gradient(to top,${BG0}fd 0%,${BG0}e0 55%,transparent 100%)`,
                  backdropFilter:'blur(12px)',padding:'40px 14px 14px',
                }}>
                  {/* País + nombre */}
                  <div style={{marginBottom:12}}>
                    <div style={{fontFamily:MONO,fontSize:8,color:'#334155',letterSpacing:'0.2em',marginBottom:4}}>{zonaActiva.pais.toUpperCase()}</div>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,flexWrap:'wrap'}}>
                      <span style={{fontSize:20,fontWeight:700,color:'#f1f5f9',letterSpacing:'-0.02em'}}>{zonaActiva.nombre}</span>
                      <span style={{fontFamily:MONO,fontSize:8,padding:'3px 8px',background:`${cfgActiva.accent}12`,
                        border:`1px solid ${cfgActiva.accent}44`,color:cfgActiva.accent,letterSpacing:'0.15em',fontWeight:700}}>
                        {cfgActiva.label}
                      </span>
                    </div>
                    <div style={{display:'inline-flex',alignItems:'center',gap:6,fontFamily:MONO,fontSize:8,
                      color:cfgActiva.accent,borderLeft:`2px solid ${cfgActiva.accent}`,paddingLeft:8,letterSpacing:'0.12em'}}>
                      <span style={{width:5,height:5,background:cfgActiva.accent,animation:'blink 1.4s step-start infinite'}}/>
                      {cfgActiva.label} · {zonaActiva.cobertura}% COBERTURA
                    </div>
                  </div>

                  {/* Métricas */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                    <div style={{background:'rgba(248,250,252,0.9)',border:`1px solid ${cfgActiva.accent}33`,borderTop:`3px solid ${cfgActiva.accent}`,padding:'10px 11px'}}>
                      <div style={{fontSize:10,color:'#64748b',fontWeight:800,marginBottom:5}}>Para pesca</div>
                      <div style={{fontSize:15,fontWeight:900,color:'#0f172a',lineHeight:1.15,marginBottom:6}}>
                        {zonaActiva.estado==='critico'?'Mejor evitar':zonaActiva.estado==='riesgo'?'Con cuidado':'Apto con cuidado'}
                      </div>
                      <div style={{fontSize:11,color:'#475569',lineHeight:1.45,fontWeight:650}}>{consejoPescaArrecife(zonaActiva)}</div>
                    </div>
                    <div style={{background:'rgba(248,250,252,0.9)',border:'1px solid rgba(16,185,129,0.24)',borderTop:'3px solid #10b981',padding:'10px 11px'}}>
                      <div style={{fontSize:10,color:'#64748b',fontWeight:800,marginBottom:5}}>Cuidado del arrecife</div>
                      <div style={{fontSize:15,fontWeight:900,color:'#0f172a',lineHeight:1.15,marginBottom:6}}>
                        {textoSalud(Math.round(zonaActiva.cobertura*2.2))}
                      </div>
                      <div style={{fontSize:11,color:'#475569',lineHeight:1.45,fontWeight:650}}>{consejoCuidadoArrecife(zonaActiva)}</div>
                    </div>
                  </div>

                  <div style={{display:'none',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:3,marginBottom:14}}>
                    <MetricBox label="COBERTURA" value={`${zonaActiva.cobertura}%`} color={cfgActiva.accent}/>
                    <MetricBox label="ALERT LVL"  value="0/3"                        color="#6366f1"/>
                    <MetricBox label="ESP. CLAVE" value={zonaActiva.especies?.[0]?.split(' ').pop()??'—'} color="#38bdf8"/>
                    <MetricBox label="SALUD"      value={`${Math.round(zonaActiva.cobertura*2.2)}%`}      color="#34d399"/>
                  </div>

                  {/* Especies */}
                  {false&&<Label>ESPECIES DOMINANTES</Label>}
                  <div style={{display:'none',flexDirection:'column',gap:6,marginBottom:12}}>
                    {(zonaActiva.especies??[]).slice(0,4).map((esp,i)=>(
                      <div key={esp}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                          <span style={{fontSize:10,color:'#94a3b8',fontStyle:'italic'}}>{esp}</span>
                          <span style={{fontFamily:MONO,fontSize:10,color:SP_COLORS[i],fontWeight:700}}>{SP_PCT[i]}%</span>
                        </div>
                        <div style={{height:2,background:'rgba(255,255,255,0.05)'}}>
                          <div style={{width:`${SP_PCT[i]}%`,height:'100%',background:SP_COLORS[i],transition:'width 0.8s cubic-bezier(0.16,1,0.3,1)'}}/>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                    <MetricBox label="COBERTURA" value={`${zonaActiva.cobertura}%`} color={cfgActiva.accent}/>
                    <MetricBox label="SALUD" value={`${Math.round(zonaActiva.cobertura*2.2)}%`} color="#10b981"/>
                  </div>
                </div>
              </div>
            )}

            {/* ── Panel Pesca ── */}
            {pescaActiva&&(
              <>
                <div style={{padding:'14px 16px',background:BG1,borderBottom:B,borderLeft:`2px solid ${pescaActiva.estado?.color??'#06b6d4'}`,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div>
                    <div style={{fontFamily:MONO,fontSize:8,color:'#334155',letterSpacing:'0.2em',marginBottom:4}}>ZONA DE PESCA RESPONSABLE</div>
                    <div style={{fontSize:15,fontWeight:700,color:'#f1f5f9',marginBottom:8}}>🎣 {pescaActiva.nombre}</div>
                    <div style={{display:'inline-flex',alignItems:'center',gap:6,fontFamily:MONO,fontSize:8,padding:'3px 8px',
                      background:`${pescaActiva.estado?.color}12`,border:`1px solid ${pescaActiva.estado?.color}44`,
                      color:pescaActiva.estado?.color,letterSpacing:'0.15em',fontWeight:700}}>
                      {pescaActiva.estado?.label} · MÁX {pescaActiva.estado?.maxLanchas} LANCHAS
                    </div>
                  </div>
                  <button onClick={()=>setPescaActiva(null)} style={{background:'transparent',border:B,color:'#334155',padding:'4px 10px',cursor:'pointer',fontFamily:MONO,fontSize:9}}>✕</button>
                </div>

                <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
                  <div style={{background:`${pescaActiva.estado?.color}10`,border:`1px solid ${pescaActiva.estado?.color}33`,padding:'12px 12px'}}>
                    <div style={{fontFamily:MONO,fontSize:8,color:pescaActiva.estado?.color,letterSpacing:'0.16em',textTransform:'uppercase',marginBottom:6}}>
                      Respuesta rapida
                    </div>
                    <div style={{fontSize:18,fontWeight:900,color:'#f8fafc',lineHeight:1.15,marginBottom:6}}>
                      {pescaActiva.estado?.permitida?'Puedes salir, con cuidado':'No conviene pescar aqui hoy'}
                    </div>
                    <div style={{fontSize:12,color:'#cbd5e1',lineHeight:1.5}}>
                      Mejor horario: <strong style={{color:'#f8fafc'}}>{extraerHorario(pescaActiva.prediccion)}</strong>. Zona sugerida: lado protegido del viento ({pescaActiva.sotaventoDe ?? 'O'}).
                    </div>
                  </div>
                  {/* Métricas */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:3}}>
                    {[
                      {label:'TEMP. MAR',  value:pescaActiva.sst,                          color:'#f97316'},
                      {label:'DHW',        value:`${pescaActiva.dhw}`,                     color:pescaActiva.estado?.color},
                      {label:'VIENTO',     value:pescaActiva.viento,                       color:'#94a3b8'},
                      {label:'SOTAVENTO',  value:pescaActiva.sotaventoDe??'O',             color:'#67e8f9'},
                    ].map(m=><MetricBox key={m.label} {...m}/>)}
                  </div>

                  {/* Estado */}
                  <div style={{borderLeft:`2px solid ${pescaActiva.estado?.color}`,paddingLeft:12}}>
                    <div style={{fontFamily:MONO,fontSize:8,color:'#334155',letterSpacing:'0.18em',marginBottom:6}}>ESTADO DEL ARRECIFE</div>
                    <div style={{fontSize:13,fontWeight:700,color:pescaActiva.estado?.color,marginBottom:4}}>
                      {pescaActiva.estado?.label}
                      {pescaActiva.estado?.maxLanchas>0&&<span style={{fontFamily:MONO,fontSize:9,fontWeight:400,color:'#475569',marginLeft:10}}>MÁX {pescaActiva.estado.maxLanchas}</span>}
                    </div>
                    <div style={{fontFamily:MONO,fontSize:9,color:'#475569',lineHeight:1.7}}>{pescaActiva.estado?.descripcion}</div>
                  </div>

                  {/* Predicción */}
                  {pescaActiva.estado?.permitida?(
                    <>
                      <Label>CUANDO Y DONDE PESCAR</Label>
                      <div style={{borderLeft:'2px solid rgba(6,182,212,0.3)',paddingLeft:12,fontSize:12,color:'#cbd5e1',lineHeight:1.65}}>
                        {pescaActiva.prediccion}
                      </div>
                    </>
                  ):(
                    <div style={{borderLeft:`2px solid ${pescaActiva.estado?.color}`,paddingLeft:12,fontFamily:MONO,fontSize:9,color:'#e2e8f0',lineHeight:1.8}}>
                      <strong style={{color:pescaActiva.estado?.color,display:'block',marginBottom:4,letterSpacing:'0.1em',fontSize:8}}>⛔ ZONA NO DISPONIBLE HOY</strong>
                      <span style={{color:'#475569'}}>{pescaActiva.estado?.descripcion}</span>
                    </div>
                  )}

                  {/* Educación */}
                  <div style={{borderLeft:'2px solid rgba(52,211,153,0.2)',paddingLeft:12,fontFamily:MONO,fontSize:9,color:'#6ee7b7',lineHeight:1.7}}>
                    🪸 DHW {pescaActiva.dhw} — {pescaActiva.dhw<1?'coral sano y produciendo larvas.':pescaActiva.dhw<4?'estrés leve. Pesca con cuidado.':pescaActiva.dhw<8?'coral sufre. Menos refugio = menos peces.':'coral blanquea. Pesquería afectada.'}
                  </div>

                  <Label>COMO SE VERA EN LOS PROXIMOS DIAS</Label>
                  <div style={{borderLeft:'2px solid rgba(251,191,36,0.35)',paddingLeft:12,fontSize:12,color:'#fde68a',lineHeight:1.65}}>
                    {pescaActiva.blanqueamiento}
                  </div>

                  {pescaActiva.alerta&&(
                    <div style={{borderLeft:'2px solid rgba(239,68,68,0.4)',paddingLeft:12,fontFamily:MONO,fontSize:9,color:'#fca5a5',lineHeight:1.7}}>
                      ⚠️ {pescaActiva.alerta}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.5)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.15}}
        @keyframes slideIn{from{transform:translateX(30px);opacity:0}to{transform:translateX(0);opacity:1}}
        .leaflet-popup-content-wrapper{background:transparent!important;box-shadow:none!important;padding:0!important;border-radius:0!important}
        .leaflet-popup-content{margin:0!important}
        .leaflet-popup-tip-container{display:none!important}
      `}</style>
    </div>
  )
}
