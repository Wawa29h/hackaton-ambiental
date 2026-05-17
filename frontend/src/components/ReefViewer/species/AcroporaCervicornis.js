import * as THREE from 'three'
import { getHealthColor } from '../utils/healthColors.js'

export function crearAcropora(x, z, dhw = 0) {
  const group = new THREE.Group()
  const color = getHealthColor(dhw)

  const numTroncos = 3 + Math.floor(Math.random() * 3)

  for (let t = 0; t < numTroncos; t++) {
    const tronco = crearTroncoAcropora(color)
    const angT = (t / numTroncos) * Math.PI * 2
    tronco.position.set(
      Math.cos(angT) * 0.2,
      0,
      Math.sin(angT) * 0.2
    )
    group.add(tronco)
  }

  group.position.set(x, 0, z)
  group.userData = {
    especie: 'Acropora cervicornis',
    zona: 'Roatán, Honduras',
    tipo: 'ramificado vertical',
    profundidad: '1-20m',
    abundancia: 'En recuperación',
    dhw,
  }
  return group
}

function crearTroncoAcropora(color) {
  const group = new THREE.Group()
  const mat = new THREE.MeshLambertMaterial({ color })

  // Tronco principal vertical
  const alturaPrincipal = 1.2 + Math.random() * 0.8
  const geo = new THREE.CylinderGeometry(0.04, 0.08, alturaPrincipal, 6)
  const tronco = new THREE.Mesh(geo, mat)
  tronco.position.y = alturaPrincipal / 2
  tronco.rotation.z = (Math.random() - 0.5) * 0.15
  group.add(tronco)

  // Ramificaciones laterales cortas
  const numLat = 4 + Math.floor(Math.random() * 4)
  for (let i = 0; i < numLat; i++) {
    const lat = new THREE.CylinderGeometry(0.02, 0.035, 0.3 + Math.random() * 0.3, 5)
    const latMesh = new THREE.Mesh(lat, mat)
    latMesh.rotation.z = Math.PI / 2.5 + (Math.random() - 0.5) * 0.3
    latMesh.rotation.y = Math.random() * Math.PI * 2
    latMesh.position.y = (i / numLat) * alturaPrincipal * 0.8 + 0.2
    group.add(latMesh)
  }

  // Punta superior
  const puntaGeo = new THREE.ConeGeometry(0.03, 0.15, 5)
  const punta = new THREE.Mesh(puntaGeo, mat)
  punta.position.y = alturaPrincipal + 0.07
  group.add(punta)

  return group
}

