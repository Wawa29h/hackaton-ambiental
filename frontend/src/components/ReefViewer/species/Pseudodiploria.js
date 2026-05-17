import * as THREE from 'three'
import { getColor } from '../utils/healthColors'
import { baseDome } from '../utils/proceduralGeo'

// Pseudodiploria strigosa — coral cerebro simétrico
// Presente en: Cayos Miskitos (NI)
export function Pseudodiploria(x, z, estado) {
  const group = new THREE.Group()
  const color = getColor(estado === 'sano' ? 0 : estado === 'riesgo' ? 5 : estado === 'blanqueando' ? 9 : 13)
  const mat = new THREE.MeshLambertMaterial({ color })

  // Similar a Diploria pero más simétrico y compacto
  const radius = 0.32 + Math.random() * 0.2
  const geo = baseDome(radius, 0.8)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, radius * 0.8 * 0.5, z)
  group.add(mesh)
  return group
}
