import * as THREE from 'three'

export function crearDiploria(x, z, dhw = 0) {
  const group = new THREE.Group()
  const color = getColorDHW(dhw)
  const escala = 0.9 + Math.random() * 0.7
  const mat = new THREE.MeshLambertMaterial({ color })

  // Base esférica con ondulación tipo cerebro
  const baseGeo = new THREE.SphereGeometry(escala, 20, 16)
  const verts = baseGeo.attributes.position
  for (let i = 0; i < verts.count; i++) {
    const x0 = verts.getX(i)
    const y0 = verts.getY(i)
    const z0 = verts.getZ(i)
    const wave =
      Math.sin(x0 * 4) * 0.08 +
      Math.sin(y0 * 5) * 0.07 +
      Math.sin(z0 * 4) * 0.08 +
      Math.sin((x0 + z0) * 6) * 0.05
    const len = Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0)
    const factor = (escala + wave) / len
    verts.setX(i, x0 * factor)
    verts.setY(i, y0 * factor * 0.75)
    verts.setZ(i, z0 * factor)
  }
  baseGeo.computeVertexNormals()
  const base = new THREE.Mesh(baseGeo, mat)
  group.add(base)

  // Crestas superficiales tipo surcos de cerebro
  for (let c = 0; c < 6; c++) {
    const ang = (c / 6) * Math.PI
    const cresta = new THREE.TorusGeometry(escala * 0.6, 0.04, 4, 12, Math.PI * 0.6)
    const crestaMesh = new THREE.Mesh(cresta, mat)
    crestaMesh.rotation.y = ang
    crestaMesh.rotation.x = (Math.random() - 0.5) * 0.8
    crestaMesh.position.y = escala * 0.1
    group.add(crestaMesh)
  }

  // seatOffset: bottom of sphere flattened to 75% Y ≈ escala * 0.75
  group.position.set(x, escala * 0.75, z)
  group.userData = {
    especie: 'Diploria labyrinthiformis',
    zona: 'Cozumel, México',
    tipo: 'cerebro masivo',
    profundidad: '1-40m',
    abundancia: 'Común',
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
