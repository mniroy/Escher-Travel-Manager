# Escher Travel Manager (100% Self-Hosted)

A premium Travel Management Progressive Web App (PWA) designed for travelers. Plan your itineraries, scan and parse tickets with Gemini AI, explore places with Google Maps, and optimize routes — **fully self-hosted with Docker & PostgreSQL**.

## ✨ Features
- 🚀 **100% Self-Hosted**: No Vercel or Supabase Cloud required.
- 🗄️ **Self-Hosted PostgreSQL**: Automatically provisioned with persistent storage.
- 📂 **Local Document Storage**: Upload and manage travel tickets locally.
- ⚡ **Realtime Multi-Device Sync**: WebSocket synchronization across phones and laptops.
- 🤖 **AI Smart Scan**: Gemini Flash 2.5 extracts itineraries from PDF & image tickets.
- 🗺️ **Interactive Maps & Routes**: Google Places search and automated route optimization.

---

## 🚀 Quick Start with Docker Compose

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Fill in your Google API keys in .env
nano .env

# 3. Launch with Docker Compose
docker compose up -d --build
```
Access the application at `http://localhost:3000`.
For complete documentation, see [DOCKER.md](file:///Users/royyanwicaksono/Dev/Docker/Escher_Travel_Manager/DOCKER.md).

---

## 🛠️ Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Framer Motion
- **Backend**: Node.js, Express, WebSocket (`ws`), Multer, esbuild
- **Database**: PostgreSQL (`postgres:16-alpine` + `pg` driver)
- **AI & Maps**: Google Gemini Flash 2.5, Google Places (New), Google Routes API
- **Deployment**: Docker & Docker Compose
