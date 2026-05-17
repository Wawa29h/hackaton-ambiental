export { crearPoritesLobata } from './PoritesLobata.js'
export { crearPocillopora }   from './Pocillopora.js'
export { crearAcropora }      from './AcroporaCervicornis.js'
export { crearDiploria }      from './Diploria.js'

// Species mixes keyed by reef characteristics rather than hard-coded IDs.
// To add a new reef: (1) add its zone id here, (2) add it to ZONAS_REALES in CoralMap.jsx.
// The 3D scene generates automatically from modelos + dhw.
export const ESPECIES_POR_ZONA = {
  // Pacific: massive dominants
  los_cobanos:    ['PoritesLobata', 'Pocillopora'],
  // Caribbean shallow: branching + brain
  roatan:         ['Acropora', 'Diploria'],
  // Caribbean deep: brain dominant
  cozumel:        ['Diploria', 'Acropora'],
  // Caribbean pristine: mixed massive
  cayos_miskitos: ['PoritesLobata', 'Diploria'],
  // Fallbacks by ocean type — used when no zone match
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
