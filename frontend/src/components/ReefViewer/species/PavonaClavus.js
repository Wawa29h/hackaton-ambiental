import * as THREE from 'three'
import { getColor } from '../utils/healthColors'
import { baseDome } from '../utils/proceduralGeo'

// Pavona clavus — coral masivo irregular con superficie rugosa
// Presente en: Los Cóbanos (SV)
export function PavonaClavus(x, z, estado) {
  const group = new THREE.Group()
  const color = getColor(estado === 'sano' ? 0 : estado === 'riesgo' ? 5 : estado === 'blanqueando' ? 9 : 13)
  const mat = new THREE.MeshLambertMaterial({ color })

  // Cuerpo principal aplanado e irregular
  const geo = baseDome(0.35 + Math.random() * 0.2, 0.4)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, 0.15, z)
  mesh.rotation.y = Math.random() * Math.PI
  group.add(mesh)
  return group
}
