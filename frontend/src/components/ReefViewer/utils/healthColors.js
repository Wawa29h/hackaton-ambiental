// Escala de colores alineada con el gemelo digital — basada en DHW
export function getHealthColor(dhw) {
  if (dhw < 4)  return 0xa855f7  // púrpura — sano
  if (dhw < 8)  return 0xeab308  // amarillo — vigilancia
  if (dhw < 16) return 0xf97316  // naranja — estrés térmico
  if (dhw < 25) return 0xfef3c7  // crema — blanqueamiento activo
  return 0x9ca3af                 // gris — mortalidad
}

export function getHealthLabel(dhw) {
  if (dhw < 4)  return 'Sano'
  if (dhw < 8)  return 'Vigilancia'
  if (dhw < 16) return 'Estrés térmico'
  if (dhw < 25) return 'Blanqueamiento'
  return 'Mortalidad'
}

export function getHealthFactor(dhw) {
  return Math.max(0, Math.min(1, 1 - dhw / 35))
}

// Hex CSS string para el overlay UI
export function getHealthCSSColor(dhw) {
  if (dhw < 4)  return '#a855f7'
  if (dhw < 8)  return '#eab308'
  if (dhw < 16) return '#f97316'
  if (dhw < 25) return '#fef3c7'
  return '#9ca3af'
}
