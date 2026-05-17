import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import {
  crearPoritesLobata,
  crearPocillopora,
  crearAcropora,
  crearDiploria,
  ESPECIES_POR_ZONA,
} from './species/index'

const CREADORES = {
  PoritesLobata: crearPoritesLobata,
  Pocillopora:   crearPocillopora,
  Acropora:      crearAcropora,
  Diploria:      crearDiploria,
}

// PlaneGeometry lies in the local XY plane — local Z is 0 for every vertex when
// the displacement formula ran, so cos(z*0.3)=1 and sin((x+z)*0.18)=sin(x*0.18).
// Floor height therefore only varies with world X (local X is preserved under rotation.x).
function getFloorY(x) {
  return -2.0 +
    Math.sin(x * 0.25) * 0.6 +
    Math.sin(x * 0.18) * 0.8
}

function crearSueloMarino() {
  const geo = new THREE.PlaneGeometry(44, 32, 40, 30)
  const pos = geo.attributes.position

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const altura =
      Math.sin(x * 0.25) * 0.6 +
      Math.cos(z * 0.3) * 0.5 +
      Math.sin((x + z) * 0.18) * 0.8 +
      (Math.random() - 0.5) * 0.4
    pos.setZ(i, altura)
  }
  geo.computeVertexNormals()

  const mat = new THREE.MeshLambertMaterial({ color: 0x0a2e1a })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = -2.5
  mesh.userData.suelo = true
  return mesh
}

function crearRocas(scene) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x1a3a28 })
  for (let i = 0; i < 12; i++) {
    const r = 0.3 + Math.random() * 0.7
    const geo = new THREE.SphereGeometry(r, 6, 5)
    const v = geo.attributes.position
    for (let j = 0; j < v.count; j++) {
      v.setX(j, v.getX(j) * (0.8 + Math.random() * 0.4))
      v.setY(j, v.getY(j) * (0.4 + Math.random() * 0.3))
      v.setZ(j, v.getZ(j) * (0.8 + Math.random() * 0.4))
    }
    geo.computeVertexNormals()
    const mesh = new THREE.Mesh(geo, mat)
    const rx = (Math.random() - 0.5) * 36
    const rz = (Math.random() - 0.5) * 24
    mesh.position.set(rx, getFloorY(rx) + r * 0.3, rz)
    mesh.rotation.y = Math.random() * Math.PI
    scene.add(mesh)
  }
}

// 5 animated SpotLights from above simulate underwater caustic shimmer
function crearCausticos(scene) {
  const spots = []
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2
    const r   = 5 + Math.random() * 4
    const spot = new THREE.SpotLight(0x44ddff, 0.4, 40, 0.5, 0.95, 1.6)
    spot.position.set(Math.cos(ang) * r, 13, Math.sin(ang) * r)
    spot.target.position.set(Math.cos(ang) * 2, -2.5, Math.sin(ang) * 2)
    scene.add(spot)
    scene.add(spot.target)
    spots.push({
      spot,
      r,
      freq:  0.35 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
    })
  }
  return spots
}

export default function ReefViewer({ zone, dhw, especies: especiesProp }) {
  const mountRef   = useRef(null)
  const sceneRef   = useRef(null)
  const coralesRef = useRef([])
  const causRef    = useRef([])   // caustic spot refs for animation

  useEffect(() => {
    const mount = mountRef.current
    const W = mount.clientWidth
    const H = 480

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setClearColor(0x051020)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x051828, 0.035)

    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 200)
    camera.position.set(0, 8, 18)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(0, 0, 0)
    controls.maxPolarAngle = Math.PI / 2.1

    scene.add(new THREE.AmbientLight(0x1a4466, 2.0))

    const sol = new THREE.DirectionalLight(0x88ddff, 2.5)
    sol.position.set(3, 12, 6)
    scene.add(sol)

    // Base caustic point (always-on subtle fill)
    const caustica = new THREE.PointLight(0x00aaaa, 1.0, 25)
    caustica.position.set(0, 1, 0)
    scene.add(caustica)

    scene.add(crearSueloMarino())
    crearRocas(scene)

    causRef.current = crearCausticos(scene)
    sceneRef.current = scene

    const clock = new THREE.Clock()
    let animId

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      // Coral sway
      coralesRef.current.forEach((coral, i) => {
        const fase = i * 0.9
        const amp  = coral.userData.ampOscilacion ?? 0.03
        coral.rotation.z = Math.sin(t * 0.8 + fase) * amp
        coral.rotation.x = Math.cos(t * 0.6 + fase * 1.3) * amp * 0.5
      })

      // Caustic spots orbit + shimmer — creates underwater zigzag light pattern
      causRef.current.forEach(({ spot, r, freq, phase }) => {
        const a = t * freq + phase
        spot.position.x = Math.cos(a) * r + Math.sin(t * 2.3 + phase) * 1.5
        spot.position.z = Math.sin(a * 1.4) * r * 0.75
        spot.intensity   = 0.28 + Math.sin(t * 3.1 + phase) * 0.18
      })

      // Base fill pulse
      caustica.intensity = 1.0 + Math.sin(t * 1.5) * 0.3

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    coralesRef.current.forEach(c => scene.remove(c))
    coralesRef.current = []

    const especies   = especiesProp || ESPECIES_POR_ZONA[zone] || []
    const posiciones = generarPosiciones(22)

    posiciones.forEach(([x, z], i) => {
      const especieId = especies[i % especies.length]
      const crear     = CREADORES[especieId]
      if (!crear) return

      const coral = crear(x, z, dhw)

      // Anchor to the deterministic floor surface — no more floating
      coral.position.y += getFloorY(x)

      const esRamificado = especieId === 'Pocillopora' || especieId === 'Acropora'
      coral.userData.ampOscilacion = esRamificado ? 0.07 : 0.025

      scene.add(coral)
      coralesRef.current.push(coral)
    })
  }, [zone, dhw, especiesProp])

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: 480, cursor: 'grab' }}
    />
  )
}

function generarPosiciones(n) {
  return Array.from({ length: n }, () => [
    (Math.random() - 0.5) * 30,
    (Math.random() - 0.5) * 20,
  ])
}
