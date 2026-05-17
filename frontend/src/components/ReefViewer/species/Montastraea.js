import * as THREE from 'three'
import { getColor } from '../utils/healthColors'
import { baseDome, baseCylinder } from '../utils/proceduralGeo'

// Montastraea cavernosa — coral estrella grande, masivo
// Presente en: Cozumel (MX), Roatán (HN)
export function Montastraea(x, z, estado) {
  const group = new THREE.Group()
  const color = getColor(estado === 'sano' ? 0 : estado === 'riesgo' ? 5 : estado === 'blanqueando' ? 9 : 13)
  const mat = new THREE.MeshLambertMaterial({ color })

  // Cuerpo masivo tipo montículo grande
  const radius = 0.5 + Math.random() * 0.35
  const domeGeo = baseDome(radius, 0.65)
  const dome = new THREE.Mesh(domeGeo, mat)
  dome.position.set(x, radius * 0.65 * 0.5, z)
  group.add(dome)

  // Base cilíndrica
  const baseGeo = baseCylinder(radius * 0.8, radius * 0.85, 0.1)
  const base = new THREE.Mesh(baseGeo, mat)
  base.position.set(x, 0.05, z)
  group.add(base)

  return group
}
