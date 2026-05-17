import * as THREE from 'three'

// Base: cilindro con variación aleatoria de altura y radio
export function baseCylinder(radiusBottom, radiusTop, height, segments = 8) {
  return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments)
}

// Base: esfera achatada (para corales masivos tipo Porites)
export function baseDome(radius, flattenY = 0.6) {
  const geo = new THREE.SphereGeometry(radius, 12, 8)
  geo.scale(1, flattenY, 1)
  return geo
}

// Base: cono ramificado (para corales arborescentes tipo Acropora)
export function baseBranch(length, radiusBase, radiusTip, segments = 6) {
  return new THREE.CylinderGeometry(radiusTip, radiusBase, length, segments)
}

// Posición aleatoria dentro de un radio
export function randomInRadius(cx, cz, radius) {
  const angle = Math.random() * Math.PI * 2
  const r = Math.random() * radius
  return [cx + Math.cos(angle) * r, cz + Math.sin(angle) * r]
}
