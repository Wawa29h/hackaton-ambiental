export function getColor(dhw) {
  if (dhw < 4)  return 0x2ecc71  // sano
  if (dhw < 8)  return 0xf39c12  // riesgo
  if (dhw < 12) return 0xe8e8e8  // blanqueando
  return 0x555555                // muerto
}

export function getEstado(dhw) {
  if (dhw < 4)  return 'sano'
  if (dhw < 8)  return 'riesgo'
  if (dhw < 12) return 'blanqueando'
  return 'muerto'
}
