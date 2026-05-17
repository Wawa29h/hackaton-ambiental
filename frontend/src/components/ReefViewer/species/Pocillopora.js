import * as THREE from 'three'
import { getHealthColor } from '../utils/healthColors.js'

export function crearPocillopora(x, z, dhw = 0) {
  const group = new THREE.Group()
  const color = getHealthColor(dhw)

  // Base central
  const baseGeo = new THREE.CylinderGeometry(0.15, 0.25, 0.3, 7)
  const baseMat = new THREE.MeshLambertMaterial({ color })
  const base = new THREE.Mesh(baseGeo, baseMat)
  base.position.y = 0.15
  group.add(base)

  // Ramas principales - salen en distintos ángulos
  const numRamas = 6 + Math.floor(Math.random() * 4)
  for (let i = 0; i < numRamas; i++) {
    const rama = crearRama(color, 0, i, numRamas)
    group.add(rama)

    // Sub-ramas
    const numSub = 2 + Math.floor(Math.random() * 3)
    for (let j = 0; j < numSub; j++) {
      const sub = crearRama(color, 1, j, numSub, rama)
      group.add(sub)
    }
  }

  group.position.set(x, 0, z)
  group.userData = {
    especie: 'Pocillopora damicornis',
    zona: 'Los Cóbanos, El Salvador',
    tipo: 'ramificado',
    profundidad: '0-5m',
    abundancia: 'Escasa - colonias muertas',
    dhw,
  }
  return group
}

function crearRama(color, nivel, idx, total, padre = null) {
  const largo = nivel === 0
    ? 0.6 + Math.random() * 0.8
    : 0.3 + Math.random() * 0.4
  const grosor = nivel === 0 ? 0.06 : 0.04

  const geo = new THREE.CylinderGeometry(grosor * 0.6, grosor, largo, 5)
  const mat = new THREE.MeshLambertMaterial({ color })
  const mesh = new THREE.Mesh(geo, mat)

  const angBase = (idx / total) * Math.PI * 2
  const inclinacion = nivel === 0
    ? 0.4 + Math.random() * 0.5
    : 0.2 + Math.random() * 0.4

  mesh.rotation.z = inclinacion
  mesh.rotation.y = angBase + (Math.random() - 0.5) * 0.6
  mesh.position.y = largo / 2 + (nivel === 0 ? 0.3 : 0)

  if (padre) {
    mesh.position.copy(padre.position)
    mesh.position.y += largo * 0.6
  }

  // Punta redondeada
  const tipGeo = new THREE.SphereGeometry(grosor * 0.8, 5, 4)
  const tip = new THREE.Mesh(tipGeo, mat)
  tip.position.y = largo / 2
  mesh.add(tip)

  return mesh
}

