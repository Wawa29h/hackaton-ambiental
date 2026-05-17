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

export default function ReefViewer({ zone, dhw }) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    const W = mount.clientWidth
    const H = 480

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setClearColor(0x0a1628)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000)
    camera.position.set(0, 10, 20)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0, 0, 0)

    scene.add(new THREE.AmbientLight(0x224466, 1.5))
    const dir = new THREE.DirectionalLight(0x88ccff, 2)
    dir.position.set(5, 10, 5)
    scene.add(dir)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 30),
      new THREE.MeshLambertMaterial({ color: 0x0d2a1a })
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -2
    scene.add(floor)

    sceneRef.current = scene

    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
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

    const toRemove = scene.children.filter(c => c.userData.especie)
    toRemove.forEach(c => scene.remove(c))

    const especies = ESPECIES_POR_ZONA[zone] || []
    const posiciones = generarPosiciones(20)

    posiciones.forEach(([x, z], i) => {
      const especieId = especies[i % especies.length]
      const crear = CREADORES[especieId]
      if (crear) {
        const coral = crear(x, z, dhw)
        scene.add(coral)
      }
    })
  }, [zone, dhw])

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: 480, cursor: 'grab' }}
    />
  )
}

function generarPosiciones(n) {
  return Array.from({ length: n }, () => [
    (Math.random() - 0.5) * 28,
    (Math.random() - 0.5) * 18,
  ])
}
