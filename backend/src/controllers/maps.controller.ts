import type { Response } from 'express'
import { geocodeAddress, getDirections, getEta } from '../services/maps.service.js'
import type { AuthedRequest } from '../middleware/auth.js'

export async function geocode(req: AuthedRequest, res: Response) {
  const { address } = req.parsedQuery as { address: string }
  res.json(await geocodeAddress(address))
}

export async function directions(req: AuthedRequest, res: Response) {
  const { origin, destination, waypoints } = req.parsedQuery as {
    origin: string
    destination: string
    waypoints?: string
  }
  const waypointList = waypoints ? waypoints.split('|') : []
  res.json(await getDirections(origin, destination, waypointList))
}

export async function eta(req: AuthedRequest, res: Response) {
  const { origin, destination } = req.parsedQuery as { origin: string; destination: string }
  res.json(await getEta(origin, destination))
}
