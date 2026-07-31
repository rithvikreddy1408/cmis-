import type { Response } from 'express'
import {
  startTrip,
  endTrip,
  getActiveTripForDriverUid,
  getTripHistoryForDriver,
  getTripForDriver,
  raiseEmergency,
} from '../services/trips.service.js'
import { getBoardingFeedForTrip } from '../services/attendance.service.js'
import type { AuthedRequest } from '../middleware/auth.js'

export async function start(req: AuthedRequest, res: Response) {
  res.status(201).json(await startTrip(req.user!.uid))
}

export async function end(req: AuthedRequest, res: Response) {
  res.json(await endTrip(req.user!.uid, req.params.id as string))
}

export async function active(req: AuthedRequest, res: Response) {
  const trip = await getActiveTripForDriverUid(req.user!.uid)
  res.json(trip)
}

export async function history(req: AuthedRequest, res: Response) {
  res.json(await getTripHistoryForDriver(req.user!.uid))
}

export async function boardingFeed(req: AuthedRequest, res: Response) {
  const trip = await getTripForDriver(req.params.id as string, req.user!.uid)
  res.json(await getBoardingFeedForTrip(trip.tripId))
}

export async function emergency(req: AuthedRequest, res: Response) {
  await raiseEmergency(req.user!.uid, req.body.message)
  res.status(204).end()
}
