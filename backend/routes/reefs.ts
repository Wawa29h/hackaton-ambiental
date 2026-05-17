import { Router } from 'express'
import { getMesoamericanReefs } from '../noaaService'

const router = Router()

// GET /api/reefs/mesoamerica
// Devuelve estaciones del Caribe Occidental listas para Leaflet
router.get('/mesoamerica', async (_req, res) => {
  try {
    const stations = await getMesoamericanReefs()
    res.json(stations)
  } catch (err) {
    res.status(500).json({ error: 'Error fetching NOAA data' })
  }
})

export default router
