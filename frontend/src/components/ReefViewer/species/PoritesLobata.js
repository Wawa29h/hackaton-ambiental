import * as THREE from 'three'

export function crearPoritesLobata(x, z, dhw = 0) {
  const group = new THREE.Group()
  const escala = 0.8 + Math.random() * 0.6

  // Cuerpo principal - esfera muy deformada
  const geo = new THREE.SphereGeometry(escala, 14, 10)
  const verts = geo.attributes.position
  for (let i = 0; i < verts.count; i++) {
    const noise = 0.85 + Math.random() * 0.3
    verts.setX(i, verts.getX(i) * noise)
    verts.setY(i, verts.getY(i) * (0.55 + Math.random() * 0.2))
    verts.setZ(i, verts.getZ(i) * noise)
  }
  geo.computeVertexNormals()

  const color = getColorDHW(dhw)
  const mat = new THREE.MeshLambertMaterial({ color })
  const mesh = new THREE.Mesh(geo, mat)

  // Pequeños tubérculos encima para simular pólipos
  for (let i = 0; i < 8; i++) {
    const tGeo = new THREE.SphereGeometry(0.06 + Math.random() * 0.04, 5, 4)
    const tMat = new THREE.MeshLambertMaterial({ color })
    const t = new THREE.Mesh(tGeo, tMat)
    const ang = Math.random() * Math.PI * 2
    const r = escala * (0.5 + Math.random() * 0.4)
    t.position.set(
      Math.cos(ang) * r,
      escala * 0.4 + Math.random() * 0.2,
      Math.sin(ang) * r
    )
    group.add(t)
  }

  group.add(mesh)
  group.position.set(x, -escala * 0.4, z)
  group.userData = {
    especie: 'Porites lobata',
    zona: 'Los Cóbanos, El Salvador',
    tipo: 'masivo',
    profundidad: '0-13m',
    abundancia: 'Dominante',
    dhw,
  }
  return group
}

function getColorDHW(dhw) {
  if (dhw < 4)  return 0x2ecc71
  if (dhw < 8)  return 0xf39c12
  if (dhw < 12) return 0xe8e8e8
  return 0x555555
}
