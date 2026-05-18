export { crearPoritesLobata } from './PoritesLobata.js'
export { crearPocillopora }   from './Pocillopora.js'
export { crearAcropora }      from './AcroporaCervicornis.js'
export { crearDiploria }      from './Diploria.js'

// Species mixes keyed by reef characteristics rather than hard-coded IDs.
// To add a new reef: (1) add its zone id here, (2) add it to ZONAS_REALES in CoralMap.jsx.
// The 3D scene generates automatically from modelos + dhw.
// Distribución de especies por arrecife — alineada con scalable-digital-twin CORAL_DISTRIBUTION
// El orden define la proporción: más repeticiones = más presencia en la escena
export const ESPECIES_POR_ZONA = {
  // Los Cóbanos, El Salvador — Pacífico: Porites lobata + Pocillopora (arrecife crítico 4%)
  los_cobanos:    ['PoritesLobata', 'Pocillopora', 'PoritesLobata'],
  // Barra de Santiago, El Salvador — Pacífico: Porites + Pocillopora en roca volcánica (12%)
  barra_santiago: ['PoritesLobata', 'Pocillopora', 'PoritesLobata', 'Pocillopora'],
  // Roatán — Honduras: Acropora cervicornis + palmata + Diploria (18%)
  roatan:         ['Acropora', 'Acropora', 'Diploria', 'Acropora'],
  // Cozumel — México: Diploria + Acropora (profundo, 22%)
  cozumel:        ['Diploria', 'Acropora', 'Diploria', 'PoritesLobata'],
  // Cayos Miskitos — Nicaragua: mix masivo saludable (43%)
  cayos_miskitos: ['Diploria', 'PoritesLobata', 'Acropora', 'Diploria', 'PoritesLobata'],
  // Fallbacks por tipo de océano
  pacific:        ['PoritesLobata', 'Pocillopora'],
  caribbean:      ['Acropora', 'Diploria'],
  default:        ['PoritesLobata'],
}

// Derive a species mix from minimal reef metadata (ocean + depth + health)
// so new zones auto-configure without editing ESPECIES_POR_ZONA.
export function especiesDesdeMetadata({ ocean = 'caribbean', depth = 'shallow', estado = 'moderado' }) {
  if (estado === 'critico') return ['PoritesLobata']          // bleached — only survivors
  if (ocean === 'pacific')  return ['PoritesLobata', 'Pocillopora']
  if (depth === 'deep')     return ['Diploria']               // brain corals dominate deeper
  return ['Acropora', 'Diploria']                             // healthy Caribbean shallow
}
