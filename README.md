# CMIS — Campus Mobility Intelligence and IoT Management System

Smart campus transportation platform: RFID attendance, live bus tracking,
bus pass validation, and an admin dashboard.

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Phased build plan: [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md)

## Stack

React 19 + Vite + TypeScript + Tailwind CSS 4 · Node.js + Express + Socket.IO ·
Firebase (Auth + Firestore) · Google Maps Platform

## Local development

```bash
# backend (http://localhost:4100)
cd backend
cp .env.example .env        # fill in Firebase service account path
npm install
npm run dev

# frontend (http://localhost:5173, or next free port)
cd frontend
cp .env.example .env        # fill in Firebase web config + Maps key
npm install
npm run dev
```

The Vite dev server proxies `/api` and `/socket.io` to the backend.

## Firebase setup (one-time)

1. Create a Firebase project, enable **Authentication (email/password)** and **Firestore**.
2. Frontend: Project settings → *Your apps* → Web app → copy config into `frontend/.env`.
3. Backend: Project settings → *Service accounts* → generate private key →
   save as `backend/serviceAccountKey.json` (gitignored).
