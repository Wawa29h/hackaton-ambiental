import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import {
  crearPoritesLobata,
  crearPocillopora,
  crearAcropora,
  crearDiploria,
  ESPECIES_POR_ZONA,
  especiesDesdeMetadata,
} from './species/index'
import {
  getHealthColor,
  getHealthLabel,
  getHealthFactor,
  getHealthCSSColor,
} from './utils/healthColors.js'

// ─── Configuración por zona — referencia: scalable-digital-twin REEF_CONFIG ──
const REEF_CONFIG = {
  los_cobanos: {
    emoji: '🇸🇻', pais: 'El Salvador', ocean: 'pacific',
    indicatorSpecies: 'Tortuga Carey',
    fishColors: [0xfbbf24, 0xf59e0b, 0xd97706, 0x60a5fa, 0xa78bfa],
    showTurtle: true, showManta: false, showParrotfish: false,
    // Pacífico: agua verde-turbia, roca volcánica oscura
    fogColor:   0x0a2a1a,
    clearColor: 0x041510,
    rockColor:  0x1a2a1f,
    seaFanDensity:   0.4,  // pocos abanicos — Pacífico
    seagrassDensity: 0.5,
  },
  roatan: {
    emoji: '🇭🇳', pais: 'Honduras', ocean: 'caribbean',
    indicatorSpecies: 'Mero Nassau',
    fishColors: [0x3b82f6, 0x1d4ed8, 0x60a5fa, 0x93c5fd, 0x2563eb],
    showTurtle: false, showManta: false, showParrotfish: false,
    // Caribe turbio-cálido
    fogColor:   0x0d3b52,
    clearColor: 0x051020,
    rockColor:  0x374151,
    seaFanDensity:   0.6,
    seagrassDensity: 0.4,
  },
  cozumel: {
    emoji: '🇲🇽', pais: 'México', ocean: 'caribbean',
    indicatorSpecies: 'Pez Loro Gigante',
    fishColors: [0x06b6d4, 0x0891b2, 0x22d3ee, 0x67e8f9, 0x60a5fa],
    showTurtle: false, showManta: false, showParrotfish: true,
    // Caribe cristalino azul
    fogColor:   0x0a3d62,
    clearColor: 0x051020,
    rockColor:  0x2d4a6e,
    seaFanDensity:   1.2,
    seagrassDensity: 0.9,
  },
  cayos_miskitos: {
    emoji: '🇳🇮', pais: 'Nicaragua', ocean: 'caribbean',
    indicatorSpecies: 'Langosta Espinosa',
    fishColors: [0x34d399, 0x10b981, 0x6ee7b7, 0xf472b6, 0xa78bfa],
    showTurtle: true, showManta: true, showParrotfish: true,
    // Caribe pristino — agua más clara
    fogColor:   0x063b52,
    clearColor: 0x021525,
    rockColor:  0x1e3a5f,
    seaFanDensity:   1.6,  // más abanicos — arrecife sano
    seagrassDensity: 1.4,
  },
}

// ─── Metadata de especies para barras del overlay ────────────────────────────
const ESPECIE_META = {
  PoritesLobata: { label: 'Porites lobata',         color: '#10b981', resistencia: 1.35 },
  Pocillopora:   { label: 'Pocillopora damicornis',  color: '#f472b6', resistencia: 0.70 },
  Acropora:      { label: 'Acropora cervicornis',    color: '#22d3ee', resistencia: 0.65 },
  Diploria:      { label: 'Diploria labyrinthiformis', color: '#8b5cf6', resistencia: 1.10 },
}

const CREADORES = {
  PoritesLobata: crearPoritesLobata,
  Pocillopora:   crearPocillopora,
  Acropora:      crearAcropora,
  Diploria:      crearDiploria,
}

function getPredictiveCoralColor(dhw = 0) {
  const sano = new THREE.Color(0x22d3ee)
  const estres = new THREE.Color(0xf97316)
  const blanco = new THREE.Color(0xfffbeb)
  if (dhw <= 4) {
    return sano.lerp(estres, Math.max(0, Math.min(1, dhw / 4)))
  }
  return estres.lerp(blanco, Math.max(0, Math.min(1, (dhw - 4) / 8)))
}

function setCoralTargetColor(coral, dhw) {
  const target = getPredictiveCoralColor(dhw)
  coral.traverse(obj => {
    if (obj.isMesh && obj.material?.color) {
      obj.material.userData = obj.material.userData || {}
      obj.material.userData.targetColor = target.clone()
    }
  })
}

// ─── Altura del suelo (determinista) ─────────────────────────────────────────
function getFloorY(x) {
  return -2.0 + Math.sin(x * 0.25) * 0.6 + Math.sin(x * 0.18) * 0.8
}

// ─── Suelo marino con relieve ─────────────────────────────────────────────────
function crearSueloMarino() {
  const geo = new THREE.PlaneGeometry(44, 32, 40, 30)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    pos.setZ(i,
      Math.sin(x * 0.25) * 0.6 +
      Math.cos(z * 0.3)  * 0.5 +
      Math.sin((x + z) * 0.18) * 0.8 +
      (Math.random() - 0.5) * 0.4
    )
  }
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x1e3a5f }))
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = -2.5
  return mesh
}

// ─── Cáusticas con shader ─────────────────────────────────────────────────────
function crearCausticaShader() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv * 8.0;
        float c  = sin(uv.x * 3.0 + uTime) * sin(uv.y * 3.0 + uTime * 0.7);
              c += sin(uv.x * 5.0 - uTime * 0.5) * sin(uv.y * 4.0 + uTime * 0.3);
              c  = pow(c * 0.5 + 0.5, 3.0) * 0.18;
        gl_FragColor = vec4(0.3, 0.8, 1.0, c);
      }
    `,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(44, 32), mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = -2.35
  return mesh
}

// ─── Rayos de luz ─────────────────────────────────────────────────────────────
function crearRayosDeLuz() {
  const group = new THREE.Group()
  const mat = new THREE.MeshBasicMaterial({
    color: 0xfef9c3, transparent: true, opacity: 0.025, side: THREE.DoubleSide,
  })
  for (let i = 0; i < 6; i++) {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.9, 15, 4), mat)
    mesh.position.set(Math.sin(i * 1.05) * 5, 5, Math.cos(i * 1.05) * 4)
    mesh.rotation.set(0.2, i * 1.05, 0)
    group.add(mesh)
  }
  return group
}

// ─── Rocas (color por zona) ───────────────────────────────────────────────────
function crearRocas(scene, rockColor = 0x1a3a5f) {
  const rocas = []
  const mat = new THREE.MeshLambertMaterial({ color: rockColor })
  for (let i = 0; i < 10; i++) {
    const r   = 0.3 + Math.random() * 0.7
    const geo = new THREE.SphereGeometry(r, 6, 5)
    const v   = geo.attributes.position
    for (let j = 0; j < v.count; j++) {
      v.setX(j, v.getX(j) * (0.8 + Math.random() * 0.4))
      v.setY(j, v.getY(j) * (0.4 + Math.random() * 0.3))
      v.setZ(j, v.getZ(j) * (0.8 + Math.random() * 0.4))
    }
    geo.computeVertexNormals()
    const mesh = new THREE.Mesh(geo, mat)
    const rx   = (Math.random() - 0.5) * 32
    const rz   = (Math.random() - 0.5) * 20
    mesh.position.set(rx, getFloorY(rx) + r * 0.3, rz)
    scene.add(mesh)
    rocas.push(mesh)
  }
  return rocas
}

// ─── Abanico de mar ───────────────────────────────────────────────────────────
function crearAbanicoMar(x, z, color = 0x22c55e, rotY = 0) {
  const g = new THREE.Group()
  // Tallo
  const mat = new THREE.MeshLambertMaterial({ color })
  const tallo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.4, 6), mat)
  tallo.position.set(0, 0.2, 0)
  g.add(tallo)
  // Abanico (plano animado)
  const fanMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.8),
    new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.88 })
  )
  fanMesh.position.y = 1.2
  g.add(fanMesh)
  g.position.set(x, getFloorY(x), z)
  g.rotation.y = rotY
  g.userData.abanico = { fanMesh, fase: Math.random() * Math.PI * 2 }
  return g
}

// ─── Burbujas ─────────────────────────────────────────────────────────────────
function crearBurbujas(count = 80) {
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 30
    pos[i * 3 + 1] = Math.random() * 8 - 4
    pos[i * 3 + 2] = (Math.random() - 0.5) * 20
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0x7dd3fc, size: 0.08, transparent: true, opacity: 0.6, sizeAttenuation: true,
  }))
}

// ─── Plancton ─────────────────────────────────────────────────────────────────
function crearPlancton(count = 140) {
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 34
    pos[i * 3 + 1] = Math.random() * 10 - 2
    pos[i * 3 + 2] = (Math.random() - 0.5) * 22
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xbef264, size: 0.04, transparent: true, opacity: 0.5, sizeAttenuation: true,
  }))
}

// ─── Pasto marino ─────────────────────────────────────────────────────────────
function crearPastoMarino(count) {
  const grupos = []
  const mat = new THREE.MeshLambertMaterial({
    color: 0x22c55e, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
  })
  for (let k = 0; k < count; k++) {
    const g = new THREE.Group()
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.5 + Math.random() * 0.25, 0.008), mat
      )
      m.position.set((i - 2.5) * 0.06, 0.25, 0)
      m.rotation.z = (i - 2.5) * 0.08
      g.add(m)
    }
    const ax = Math.sin(k * 0.8) * 7
    const az = Math.cos(k * 0.8) * 6
    g.position.set(ax, getFloorY(ax), az)
    g.userData.pasto = { fase: Math.random() * Math.PI * 2 }
    grupos.push(g)
  }
  return grupos
}

// ─── Algas invasoras ──────────────────────────────────────────────────────────
function crearAlgas(count, intensity) {
  const grupos = []
  const mat = new THREE.MeshLambertMaterial({
    color: 0x65a30d, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
  })
  for (let k = 0; k < count; k++) {
    const g = new THREE.Group()
    for (let i = 0; i < Math.max(2, Math.floor(6 * intensity)); i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.5 + Math.random() * 0.35, 0.02), mat
      )
      m.position.set((i % 4 - 1.5) * 0.3, 0.3, Math.floor(i / 4) * 0.3)
      g.add(m)
    }
    const ax = (Math.random() - 0.5) * 28
    const az = (Math.random() - 0.5) * 18
    g.position.set(ax, getFloorY(ax), az)
    g.userData.alga = { fase: Math.random() * Math.PI * 2 }
    grupos.push(g)
  }
  return grupos
}

// ─── Pez ──────────────────────────────────────────────────────────────────────
function crearPez(color, radio = 3, alturaBase = -1, velocidad = 0.3, grande = false) {
  const g   = new THREE.Group()
  const mat = new THREE.MeshLambertMaterial({ color })
  const s   = grande ? 1.8 : 1

  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 8, 6), mat)
  cuerpo.scale.set(1, 0.6, 0.45)
  g.add(cuerpo)

  const cola = new THREE.Mesh(new THREE.ConeGeometry(0.12 * s, 0.22 * s, 4), mat)
  cola.rotation.z = Math.PI / 2
  cola.position.x = -0.28 * s
  g.add(cola)

  const ojo = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 4, 4),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  )
  ojo.position.set(0.18 * s, 0.04 * s, 0.1 * s)
  g.add(ojo)

  g.userData.orbita = {
    radio, alturaBase, velocidad,
    fase:  Math.random() * Math.PI * 2,
    oscY:  Math.random() * 0.5,
  }
  return g
}

// ─── Tortuga marina ───────────────────────────────────────────────────────────
function crearTortuga() {
  const g    = new THREE.Group()
  const mOsc = new THREE.MeshLambertMaterial({ color: 0x365314 })
  const mCla = new THREE.MeshLambertMaterial({ color: 0x4d7c0f })

  const capa = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 10), mOsc)
  capa.scale.set(1, 0.4, 0.85)
  g.add(capa)

  const cab = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), mCla)
  cab.position.set(0.7, 0.05, 0)
  g.add(cab)

  ;[-0.58, 0.58].forEach(sign => {
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.26, 6, 6), mCla)
    a.scale.set(1.2, 0.14, 0.55)
    a.position.set(0.2, -0.08, sign)
    g.add(a)
  })

  g.userData.tortuga = { fase: Math.random() * Math.PI * 2 }
  return g
}

// ─── Manta raya ───────────────────────────────────────────────────────────────
function crearMantaRaya() {
  const g   = new THREE.Group()
  const mat = new THREE.MeshLambertMaterial({ color: 0x1e3a5f })

  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), mat)
  cuerpo.scale.set(1, 0.1, 1.5)
  g.add(cuerpo)

  const cola = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.01, 1.6, 6), mat)
  cola.rotation.z = Math.PI / 2
  cola.position.x = -1.3
  g.add(cola)

  g.userData.manta = { fase: Math.random() * Math.PI * 2 }
  return g
}

// ─── Medusa ───────────────────────────────────────────────────────────────────
function crearMedusa(x, z, color = 0xc4b5fd) {
  const g   = new THREE.Group()
  const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide })

  g.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat
  ))

  const tentMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 })
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 4), tentMat)
    t.position.set(Math.sin(i * 1.05) * 0.15, -0.4, Math.cos(i * 1.05) * 0.15)
    g.add(t)
  }

  g.position.set(x, 2.5 + Math.random() * 2, z)
  g.userData.medusa = { fase: Math.random() * Math.PI * 2 }
  return g
}

// ─── Posiciones distribuidas en la escena ────────────────────────────────────
const MAX_POSICIONES = 22
const TODAS_POSICIONES = Array.from({ length: MAX_POSICIONES }, (_, i) => {
  const ang = (i / MAX_POSICIONES) * Math.PI * 2
  const rad = 3 + (i % 4) * 2.2
  return [(Math.cos(ang) * rad) * 0.9 + (Math.random() - 0.5) * 2,
          (Math.sin(ang) * rad) * 0.7 + (Math.random() - 0.5) * 2]
})

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function ReefViewer({ zone, dhw, baa, especies: especiesProp, cobertura, descripcion, showHud = true }) {
  const mountRef    = useRef(null)
  const sceneRef    = useRef(null)
  const clockRef    = useRef(null)
  const rendererRef = useRef(null)
  const rocasRef    = useRef([])
  const audioRef    = useRef(null) // Referencia para Bioacústica
  const [audioIniciado, setAudioIniciado] = useState(false)

  // — grupos animados —
  const coralesRef  = useRef([])
  const pecesRef    = useRef([])
  const tortugaRef  = useRef(null)
  const mantaRef    = useRef(null)
  const medusasRef  = useRef([])
  const causticaRef = useRef(null)
  const burbujasRef = useRef(null)
  const planctonRef = useRef(null)
  const pastoRef    = useRef([])
  const algasRef    = useRef([])
  const abanicoRef  = useRef([])
  const rayosRef    = useRef(null)

  // ─── Setup de escena (una sola vez) ────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    const W = mount.clientWidth
    const H = mount.clientHeight || 480

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x021525, 1)
    renderer.domElement.style.display = 'block'
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x051828, 0.032)

    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 200)
    camera.position.set(0, 8, 18)

    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = Math.max(1, Math.floor(entry.contentRect.width))
      const height = Math.max(1, Math.floor(entry.contentRect.height))
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    })
    resizeObserver.observe(mount)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping  = true
    controls.dampingFactor  = 0.08
    controls.target.set(0, 0, 0)
    controls.maxPolarAngle  = Math.PI / 2.1

    // Luces
    scene.add(new THREE.AmbientLight(0x1a4466, 2.2))
    const sol = new THREE.DirectionalLight(0xfef9c3, 1.8)
    sol.position.set(5, 12, 5)
    scene.add(sol)
    const fillLight = new THREE.DirectionalLight(0x67e8f9, 0.4)
    fillLight.position.set(-5, 5, -5)
    scene.add(fillLight)

    // Suelo + cáusticas + rayos
    scene.add(crearSueloMarino())
    const caustica = crearCausticaShader()
    scene.add(caustica)
    causticaRef.current = caustica
    const rayos = crearRayosDeLuz()
    scene.add(rayos)
    rayosRef.current = rayos

    // Burbujas + plancton
    const burbujas = crearBurbujas(80)
    scene.add(burbujas)
    burbujasRef.current = burbujas
    const plancton = crearPlancton(140)
    scene.add(plancton)
    planctonRef.current = plancton

    sceneRef.current = scene
    clockRef.current = new THREE.Clock()

    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
      const t = clockRef.current.getElapsedTime()

      if (causticaRef.current) causticaRef.current.material.uniforms.uTime.value = t
      if (rayosRef.current)    rayosRef.current.rotation.y = t * 0.02

      // Corales oscilan
      coralesRef.current.forEach((coral, i) => {
        const fase = i * 0.9
        const amp  = coral.userData.ampOscilacion ?? 0.03
        coral.rotation.z = Math.sin(t * 0.8 + fase) * amp
        coral.rotation.x = Math.cos(t * 0.6 + fase * 1.3) * amp * 0.5
      })

      // Abanicos de mar ondean
      abanicoRef.current.forEach(g => {
        const { fanMesh, fase } = g.userData.abanico
        fanMesh.rotation.z = Math.sin(t * 0.9 + fase) * 0.1
      })

      // Peces en órbita
      pecesRef.current.forEach(pez => {
        const { radio, alturaBase, velocidad, fase, oscY } = pez.userData.orbita
        const a = t * velocidad + fase
        pez.position.x  = Math.sin(a) * radio
        pez.position.z  = Math.cos(a * 0.7) * radio
        pez.position.y  = alturaBase + Math.sin(t * 1.5 + oscY) * 0.6
        pez.rotation.y  = Math.atan2(Math.cos(a), -Math.sin(a) * 0.7)
      })

      // Tortuga
      if (tortugaRef.current) {
        const { fase } = tortugaRef.current.userData.tortuga
        const a = t * 0.1 + fase
        tortugaRef.current.position.x = Math.sin(a) * 6
        tortugaRef.current.position.z = Math.cos(a) * 5
        tortugaRef.current.position.y = 0.8 + Math.sin(t * 0.5 + fase) * 0.9
        tortugaRef.current.rotation.y = a + Math.PI / 2
      }

      // Manta raya
      if (mantaRef.current) {
        const { fase } = mantaRef.current.userData.manta
        const a = t * 0.08 + fase
        mantaRef.current.position.x = Math.sin(a) * 7
        mantaRef.current.position.z = Math.cos(a) * 6
        mantaRef.current.position.y = 2.5 + Math.sin(t * 0.4 + fase) * 1.2
        mantaRef.current.rotation.y = a + Math.PI
      }

      // Medusas flotando
      medusasRef.current.forEach(med => {
        const { fase } = med.userData.medusa
        med.position.y = 2.5 + Math.sin(t * 0.5 + fase) * 1.4
        med.position.x += Math.sin(t * 0.2 + fase) * 0.003
        med.scale.y = 1 + Math.sin(t * 2 + fase) * 0.1
      })

      // Burbujas subiendo
      const bPos = burbujasRef.current?.geometry.attributes.position.array
      if (bPos) {
        for (let i = 0; i < bPos.length / 3; i++) {
          bPos[i * 3 + 1] += 0.015 + Math.random() * 0.008
          if (bPos[i * 3 + 1] > 7) {
            bPos[i * 3 + 1] = -4
            bPos[i * 3]     = (Math.random() - 0.5) * 30
            bPos[i * 3 + 2] = (Math.random() - 0.5) * 20
          }
        }
        burbujasRef.current.geometry.attributes.position.needsUpdate = true
      }

      // Plancton deriva
      const pPos = planctonRef.current?.geometry.attributes.position.array
      if (pPos) {
        for (let i = 0; i < pPos.length / 3; i++) {
          pPos[i * 3]     += Math.sin(t + i) * 0.003
          pPos[i * 3 + 1] += Math.cos(t * 0.5 + i) * 0.002
        }
        planctonRef.current.geometry.attributes.position.needsUpdate = true
      }

      // Pasto marino meciéndose
      pastoRef.current.forEach(g => {
        g.rotation.z = Math.sin(t * 1.2 + g.userData.pasto.fase) * 0.12
      })

      // Algas meciéndose
      algasRef.current.forEach(g => {
        g.children.forEach((c, ci) => {
          c.rotation.z = Math.sin(t * 1.5 + ci + g.userData.alga.fase) * 0.2
        })
      })

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      resizeObserver.disconnect()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  // ─── Poblar ecosistema cuando cambia zona / dhw ─────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const cfg          = REEF_CONFIG[zone] ?? REEF_CONFIG.cayos_miskitos
    const healthFactor = getHealthFactor(dhw)
    const fishBiomass  = Math.max(250, 3200 * healthFactor)
    const fishCount    = Math.max(0, Math.floor(fishBiomass / 400))

    // Efecto WOW: Turbidez del Agua (Fog) dinámica según salud
    if (scene.fog) {
      const baseColor = new THREE.Color(cfg.fogColor);
      const murkColor = new THREE.Color(0x2d4a22); // Agua turbia/sucia por algas y muerte coralina
      baseColor.lerp(murkColor, 1 - healthFactor);
      
      scene.fog.color.copy(baseColor);
      // A menor salud, mayor densidad de niebla (pérdida de claridad)
      scene.fog.density = 0.025 + Math.pow(1 - healthFactor, 2) * 0.12;
    }
    
    if (rendererRef.current) {
      const baseClear = new THREE.Color(cfg.clearColor);
      const murkClear = new THREE.Color(0x1a2a1a);
      baseClear.lerp(murkClear, 1 - healthFactor);
      rendererRef.current.setClearColor(baseClear, 1); // opaco — fondo marino visible
    }

    // Limpiar todo lo vivo anterior
    ;[
      ...coralesRef.current,
      ...pecesRef.current,
      ...medusasRef.current,
      ...pastoRef.current,
      ...algasRef.current,
      ...abanicoRef.current,
      ...rocasRef.current,
    ].forEach(o => scene.remove(o))
    if (tortugaRef.current) { scene.remove(tortugaRef.current); tortugaRef.current = null }
    if (mantaRef.current)   { scene.remove(mantaRef.current);   mantaRef.current   = null }
    coralesRef.current  = []
    pecesRef.current    = []
    medusasRef.current  = []
    abanicoRef.current  = []
    pastoRef.current    = []
    algasRef.current    = []

    // — Rocas (color por zona) —
    rocasRef.current = crearRocas(scene, cfg.rockColor)

    // — Corales: cantidad basada en cobertura REAL + salud —
    const coberturaBase = cobertura ?? Math.max(4, Math.round(50 * healthFactor))
    const coralCount    = Math.max(1, Math.round((coberturaBase / 50) * MAX_POSICIONES * Math.max(0.08, healthFactor)))
    
    // Función para mapear nombres biológicos reales a los modelos 3D matemáticos
    const mapEspecieAModelo = (nombre) => {
      const n = nombre.toLowerCase();
      if (n.includes('acropora') || n.includes('cuerno')) return 'Acropora';
      if (n.includes('diploria') || n.includes('orbicella') || n.includes('montastraea') || n.includes('cerebro')) return 'Diploria';
      if (n.includes('pocillopora')) return 'Pocillopora';
      if (n.includes('porites')) return 'PoritesLobata';
      return 'PoritesLobata'; // fallback
    }

    // Si recibimos especies reales de la API/Base, las mapeamos. Si no, usamos el mix predeterminado de la zona.
    const especiesRaw = especiesProp && especiesProp.length > 0 ? especiesProp : (ESPECIES_POR_ZONA[zone] || ['PoritesLobata']);
    const especies = especiesRaw.map(mapEspecieAModelo);

    TODAS_POSICIONES.slice(0, coralCount).forEach(([x, z], i) => {
      const especieId = especies[i % especies.length]
      const crear     = CREADORES[especieId]
      if (!crear) return
      const coral = crear(x, z, dhw)
      coral.position.y += getFloorY(x)
      coral.userData.ampOscilacion = (especieId === 'Pocillopora' || especieId === 'Acropora') ? 0.07 : 0.025
      scene.add(coral)
      coralesRef.current.push(coral)
    })

    // — Abanicos de mar (cantidad y umbral según zona) —
    const fanColor = dhw < 16 ? 0x22c55e : dhw < 25 ? 0x84cc16 : 0x6b7280
    const fanThreshold = 0.3 / cfg.seaFanDensity
    if (healthFactor > fanThreshold) {
      const basePositions = [
        [-5, 2, 0.5], [4, -3, -0.8], [1.5, 4, 1.2],
        [-3, -3.5, 2.0], [5.5, 1.5, -1.5],
        [-7, 0, 0.2], [2.5, -5, 2.8],
      ]
      const fanCount = Math.min(
        basePositions.length,
        Math.round(3 + (cfg.seaFanDensity - 1) * 4)
      )
      for (let i = 0; i < fanCount; i++) {
        const [fx, fz, rotY] = basePositions[i]
        const ab = crearAbanicoMar(fx, fz, fanColor, rotY)
        scene.add(ab)
        abanicoRef.current.push(ab)
      }
    }

    // — Peces —
    for (let i = 0; i < fishCount; i++) {
      const color = cfg.fishColors[i % cfg.fishColors.length]
      const pez   = crearPez(
        color,
        2.5 + Math.random() * 3,
        -1  + Math.random() * 3,
        0.25 + Math.random() * 0.35
      )
      scene.add(pez)
      pecesRef.current.push(pez)
    }

    // — Pez loro (grande) para zonas con showParrotfish —
    if (cfg.showParrotfish && healthFactor > 0.4) {
      const loro = crearPez(0x06b6d4, 4, 0, 0.15, true)
      scene.add(loro)
      pecesRef.current.push(loro)
    }

    // — Tortuga —
    if (cfg.showTurtle && healthFactor > 0.3) {
      const t = crearTortuga()
      scene.add(t)
      tortugaRef.current = t
    }

    // — Manta raya —
    if (cfg.showManta && healthFactor > 0.5) {
      const m = crearMantaRaya()
      scene.add(m)
      mantaRef.current = m
    }

    // — Medusas (3, colores variables) —
    ;[0xc4b5fd, 0xa5b4fc, 0xfda4af].forEach((col) => {
      const med = crearMedusa(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 8,
        col
      )
      scene.add(med)
      medusasRef.current.push(med)
    })

    // — Pasto marino (densidad según zona + salud) —
    const pastoCount = Math.floor(healthFactor * 10 * cfg.seagrassDensity)
    const pastos = crearPastoMarino(pastoCount)
    pastos.forEach(g => scene.add(g))
    pastoRef.current = pastos

    // — Algas invasoras —
    const algaIntensity = Math.max(0, 1 - healthFactor)
    if (algaIntensity > 0.3) {
      const algaCount = Math.floor(algaIntensity * 8)
      const algas = crearAlgas(algaCount, algaIntensity)
      algas.forEach(g => scene.add(g))
      algasRef.current = algas
    }

  }, [zone, dhw, especiesProp, cobertura])

  // ─── Métricas para el overlay ─────────────────────────────────────────────
  const cfg             = REEF_CONFIG[zone] ?? REEF_CONFIG.cayos_miskitos
  const healthLabel     = getHealthLabel(dhw)
  const healthCSS       = getHealthCSSColor(dhw)
  const hf              = getHealthFactor(dhw)
  const coberturaReal   = cobertura ?? Math.max(2, Math.round(50 * hf))
  const especiesDisplay = especiesProp || ESPECIES_POR_ZONA[zone] || []

  // ─── Control de Volumen Bioacústico ───────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) {
      // El sonido del arrecife disminuye drásticamente cuando la salud cae.
      // Se simula la pérdida de los chasquidos de camarones y peces.
      const targetVolume = Math.max(0, hf - 0.1);
      audioRef.current.volume = targetVolume;
    }
  }, [hf]);

  const toggleAudio = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(e => console.log('Audio error:', e));
        setAudioIniciado(true);
      } else {
        audioRef.current.pause();
        setAudioIniciado(false);
      }
    }
  }

  const handleInteraction = () => {
    if (!audioIniciado && audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio autoplay bloqueado', e));
      setAudioIniciado(true);
    }
  }

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', minHeight: showHud ? 360 : 0, overflow: 'hidden',
      background: `linear-gradient(180deg, ${cfg.ocean === 'pacific' ? '#031a0e' : '#021525'} 0%, ${cfg.ocean === 'pacific' ? '#041510' : '#010d18'} 100%)`,
    }} onPointerDown={handleInteraction}>
      {/* Pista de Audio Bioacústico (Placeholder). Reemplazar src con un mp3 real de ecosistema sano */}
      <audio ref={audioRef} loop src="https://actions.google.com/sounds/v1/water/underwater_bubbles.ogg" crossOrigin="anonymous" />
      
      {/* Botón de Audio */}
      {showHud && (
      <button 
        onClick={toggleAudio}
        style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          background: 'rgba(10,18,40,0.88)', border: '1px solid rgba(6,182,212,0.4)',
          color: '#67e8f9', padding: '6px 12px', borderRadius: 8,
          cursor: 'pointer', fontFamily: 'monospace', fontSize: 12,
          backdropFilter: 'blur(4px)'
        }}>
        {audioIniciado ? '🔊 AUDIO ON' : '🔇 AUDIO OFF'}
      </button>
      )}

      {/* Canvas Three.js */}
      <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab', overflow: 'hidden' }} />

      {/* ── Panel izquierdo: métricas + especies ─────────────────────────── */}
      {showHud && (
      <div style={{
        position: 'absolute', top: 12, left: 12,
        background: 'rgba(10,18,40,0.88)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(6,182,212,0.2)',
        borderRadius: 12, padding: '14px 16px', width: 220,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}>
        {/* Header zona */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: '#67e8f9', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
            {cfg.emoji} {cfg.pais} · {cfg.ocean === 'pacific' ? 'Pacífico' : 'Caribe'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
              {dhw.toFixed(1)}
            </span>
            <span style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 600,
              background: `${healthCSS}22`, color: healthCSS, border: `1px solid ${healthCSS}44`,
            }}>
              {healthLabel}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: -2 }}>DHW · Grados de Calor Acumulado</div>
        </div>

        {/* Métricas grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
          {[
            { label: 'Cobertura', value: `${coberturaReal}%`, color: coberturaReal > 30 ? '#34d399' : coberturaReal > 15 ? '#fb923c' : '#f87171' },
            { label: 'Alert Lvl', value: `${baa != null ? baa : (dhw < 4 ? 0 : dhw < 8 ? 1 : dhw < 16 ? 2 : 3)}/4`, color: healthCSS },
            { label: 'Esp. clave', value: cfg.indicatorSpecies.split(' ')[0], color: '#67e8f9' },
            { label: 'Salud', value: `${Math.round(hf * 100)}%`, color: healthCSS },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px' }}>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'monospace', marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Barras de especies reales (del gemelo digital) */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: '#67e8f9', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Especies dominantes
          </div>
          {especiesDisplay.map(espId => {
            const meta  = ESPECIE_META[espId]
            if (!meta) return null
            const pct   = Math.min(100, Math.round(hf * meta.resistencia * 100))
            return (
              <div key={espId} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>{meta.label}</span>
                  <span style={{ fontSize: 10, color: meta.color, fontFamily: 'monospace' }}>{pct}%</span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${meta.color}66, ${meta.color})`,
                    transition: 'width 0.7s ease',
                  }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Descripción / predicción */}
        {descripcion && (
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.07)',
            paddingTop: 8,
            fontSize: 10, color: '#94a3b8', lineHeight: 1.5,
          }}>
            {descripcion}
          </div>
        )}
      </div>
      )}

      {/* ── Panel derecho: leyenda + fauna ───────────────────────────────── */}
      {showHud && (
      <div style={{
        position: 'absolute', top: 12, right: 12,
        background: 'rgba(10,18,40,0.88)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(6,182,212,0.2)',
        borderRadius: 10, padding: '10px 12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 9, color: '#67e8f9', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Estado Coral
        </div>
        {[
          { color: '#a855f7', label: 'Sano (DHW&lt;4)' },
          { color: '#eab308', label: 'Vigilancia (4-8)' },
          { color: '#f97316', label: 'Estrés (8-16)' },
          { color: '#fef3c7', label: 'Blanqueando (16+)' },
          { color: '#9ca3af', label: 'Muerto (25+)' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#cbd5e1' }} dangerouslySetInnerHTML={{ __html: label }} />
          </div>
        ))}

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 6, paddingTop: 6 }}>
          <div style={{ fontSize: 9, color: '#67e8f9', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>
            Fauna activa
          </div>
          {cfg.showTurtle    && <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 3 }}>🐢 Tortuga marina</div>}
          {cfg.showManta     && <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 3 }}>🦅 Manta raya</div>}
          {cfg.showParrotfish && <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 3 }}>🐠 Pez Loro</div>}
          <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>📍 {cfg.indicatorSpecies}</div>
        </div>
      </div>
      )}
    </div>
  )
}
