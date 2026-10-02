import axios from 'axios'
import { auth } from './firebase'

// Where the backend lives. Empty in local dev, where Vite proxies /api and
// /socket.io to localhost:4100 — so the relative path is correct and nothing
// needs configuring. In a deployment the frontend and backend are separate
// origins (static host + Render/Cloud Run), and there is no proxy in front of
// the static host, so VITE_API_URL must carry the backend origin or every
// request resolves against the static host and comes back as index.html.
export const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export const api = axios.create({
  baseURL: `${API_ORIGIN}/api/v1`,
})

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
