// server/index.ts
import express from "express";
import http from "http";
import cors from "cors";
import path2 from "path";
import fs from "fs";
import { fileURLToPath as fileURLToPath2 } from "url";
import dotenv from "dotenv";
import multer from "multer";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenerativeAI } from "@google/generative-ai";

// server/db.ts
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
var { Pool } = pg;
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || "postgres://escher:escherpassword@localhost:5432/escher_travel";
var pool = null;
var isConnected = false;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 5e3
    });
    pool.on("error", (err) => {
      console.error("[PostgreSQL] Unexpected error on idle client:", err);
    });
  }
  return pool;
}
async function initDatabase() {
  try {
    const client = await getPool().connect();
    console.log("[PostgreSQL] Connected successfully to database.");
    await client.query(`
            CREATE TABLE IF NOT EXISTS trips (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                start_date TEXT NOT NULL,
                duration INTEGER NOT NULL DEFAULT 7,
                cover_image TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                time TEXT NOT NULL,
                end_time TEXT,
                description TEXT,
                rating REAL,
                reviews INTEGER,
                image TEXT,
                status TEXT DEFAULT 'Scheduled',
                duration TEXT,
                google_maps_link TEXT,
                travel_time TEXT,
                travel_mode TEXT,
                day_offset INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                congestion TEXT,
                place_id TEXT,
                lat REAL,
                lng REAL,
                address TEXT,
                parking_buffer INTEGER DEFAULT 10,
                opening_hours TEXT,
                is_start BOOLEAN DEFAULT FALSE,
                is_end BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                size TEXT,
                mime_type TEXT,
                file_url TEXT,
                metadata JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS trip_history (
                id TEXT PRIMARY KEY,
                trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
                action_type TEXT NOT NULL,
                event_title TEXT NOT NULL,
                event_data JSONB,
                comment TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_events_trip_id ON events(trip_id);
            CREATE INDEX IF NOT EXISTS idx_events_day_offset ON events(trip_id, day_offset);
            CREATE INDEX IF NOT EXISTS idx_documents_trip_id ON documents(trip_id);
            CREATE INDEX IF NOT EXISTS idx_trip_history_trip_id ON trip_history(trip_id);
        `);
    const countRes = await client.query("SELECT COUNT(*) FROM trips");
    const count = parseInt(countRes.rows[0].count, 10);
    if (count === 0) {
      console.log("[PostgreSQL] Database is empty. Seeding default Bali trip data...");
      const defaultTripId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
      await client.query(
        `INSERT INTO trips (id, name, start_date, duration, cover_image) 
                 VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [
          defaultTripId,
          "Bali Trip",
          "2024-08-21",
          9,
          "https://images.unsplash.com/photo-1555400038-63f5ba517a47?auto=format&fit=crop&w=1000&q=80"
        ]
      );
      const sampleEvents = [
        ["e1", defaultTripId, "Transport", "Arrive at Zurich International Airport", "03:00 PM", "Terminal 1, Flight LX180", 0, "45m", 1],
        ["e2", defaultTripId, "Eat", "Elfrentes Roasting", "04:00 PM", "Specialty coffee roaster with light bites.", 0, "1h 30m", 2],
        ["e3", defaultTripId, "Play", "Spend the day exploring Zurich", "05:00 PM", "Old Town, Lake Zurich, and Bahnhofstrasse.", 0, "3h", 3],
        ["e4", defaultTripId, "Eat", "Elmira fine dining", "07:00 PM", "Modern Swiss cuisine.", 0, "2h", 4],
        ["e5", defaultTripId, "Stay", "BVLGARI Hotel", "07:45 PM", "Check-in confirmed.", 0, null, 5],
        ["e6", defaultTripId, "Eat", "Cafe Odeon", "09:00 AM", "Historic Art Nouveau caf\xE9.", 1, "1h", 6],
        ["e7", defaultTripId, "Play", "Kunsthaus Z\xFCrich", "11:00 AM", "Visit the art museum.", 1, "2h 15m", 7]
      ];
      for (const ev of sampleEvents) {
        await client.query(
          `INSERT INTO events (id, trip_id, type, title, time, description, day_offset, duration, sort_order)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
          ev
        );
      }
    }
    client.release();
    isConnected = true;
    return true;
  } catch (err) {
    console.error("[PostgreSQL] Connection / initialization failed:", err);
    isConnected = false;
    return false;
  }
}
function isDbConnected() {
  return isConnected;
}
var dbService = {
  // ---- Trips ----
  async getTrips() {
    const pool2 = getPool();
    const res = await pool2.query("SELECT * FROM trips ORDER BY created_at DESC");
    return res.rows;
  },
  async getTrip(id) {
    const pool2 = getPool();
    const res = await pool2.query("SELECT * FROM trips WHERE id = $1", [id]);
    return res.rows[0] || null;
  },
  async createTrip(trip) {
    const pool2 = getPool();
    const res = await pool2.query(
      `INSERT INTO trips (id, name, start_date, duration, cover_image)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
      [trip.id, trip.name, trip.start_date, trip.duration || 7, trip.cover_image || null]
    );
    return res.rows[0];
  },
  async updateTrip(id, updates) {
    const pool2 = getPool();
    const fields = [];
    const values = [];
    let idx = 1;
    if (updates.name !== void 0) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.start_date !== void 0) {
      fields.push(`start_date = $${idx++}`);
      values.push(updates.start_date);
    }
    if (updates.duration !== void 0) {
      fields.push(`duration = $${idx++}`);
      values.push(updates.duration);
    }
    if (updates.cover_image !== void 0) {
      fields.push(`cover_image = $${idx++}`);
      values.push(updates.cover_image);
    }
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const query = `UPDATE trips SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`;
    const res = await pool2.query(query, values);
    return res.rows[0];
  },
  async deleteTrip(id) {
    const pool2 = getPool();
    await pool2.query("DELETE FROM trips WHERE id = $1", [id]);
  },
  // ---- Events ----
  async getEvents(tripId) {
    const pool2 = getPool();
    const res = await pool2.query(
      "SELECT * FROM events WHERE trip_id = $1 ORDER BY day_offset ASC, sort_order ASC",
      [tripId]
    );
    return res.rows.map((row) => ({
      ...row,
      opening_hours: typeof row.opening_hours === "string" ? JSON.parse(row.opening_hours) : row.opening_hours
    }));
  },
  async createEvent(event) {
    const pool2 = getPool();
    const openingHoursJson = event.opening_hours ? JSON.stringify(event.opening_hours) : null;
    const res = await pool2.query(
      `INSERT INTO events (
                id, trip_id, type, title, time, end_time, description, rating, reviews,
                image, status, duration, google_maps_link, travel_time, travel_mode,
                day_offset, sort_order, congestion, place_id, lat, lng, address,
                parking_buffer, opening_hours, is_start, is_end
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9,
                $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22,
                $23, $24, $25, $26
            ) RETURNING *`,
      [
        event.id,
        event.trip_id,
        event.type,
        event.title,
        event.time,
        event.end_time || null,
        event.description || null,
        event.rating || null,
        event.reviews || null,
        event.image || null,
        event.status || "Scheduled",
        event.duration || null,
        event.google_maps_link || null,
        event.travel_time || null,
        event.travel_mode || null,
        event.day_offset || 0,
        event.sort_order || 0,
        event.congestion || null,
        event.place_id || null,
        event.lat || null,
        event.lng || null,
        event.address || null,
        event.parking_buffer || 10,
        openingHoursJson,
        event.is_start || false,
        event.is_end || false
      ]
    );
    return res.rows[0];
  },
  async updateEvent(id, updates) {
    const pool2 = getPool();
    const fields = [];
    const values = [];
    let idx = 1;
    const allowedKeys = [
      "type",
      "title",
      "time",
      "end_time",
      "description",
      "rating",
      "reviews",
      "image",
      "status",
      "duration",
      "google_maps_link",
      "travel_time",
      "travel_mode",
      "day_offset",
      "sort_order",
      "congestion",
      "place_id",
      "lat",
      "lng",
      "address",
      "parking_buffer",
      "is_start",
      "is_end"
    ];
    for (const key of allowedKeys) {
      if (updates[key] !== void 0) {
        fields.push(`${key} = $${idx++}`);
        values.push(updates[key]);
      }
    }
    if (updates.opening_hours !== void 0) {
      fields.push(`opening_hours = $${idx++}`);
      values.push(updates.opening_hours ? JSON.stringify(updates.opening_hours) : null);
    }
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const query = `UPDATE events SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`;
    const res = await pool2.query(query, values);
    return res.rows[0];
  },
  async upsertEvents(events) {
    const results = [];
    for (const ev of events) {
      const pool2 = getPool();
      const exists = await pool2.query("SELECT id FROM events WHERE id = $1", [ev.id]);
      if (exists.rows.length > 0) {
        const updated = await this.updateEvent(ev.id, ev);
        results.push(updated);
      } else {
        const created = await this.createEvent(ev);
        results.push(created);
      }
    }
    return results;
  },
  async deleteEvent(id) {
    const pool2 = getPool();
    await pool2.query("DELETE FROM events WHERE id = $1", [id]);
  },
  // ---- Documents ----
  async getDocuments(tripId) {
    const pool2 = getPool();
    const res = await pool2.query(
      "SELECT * FROM documents WHERE trip_id = $1 ORDER BY created_at DESC",
      [tripId]
    );
    return res.rows;
  },
  async createDocument(doc) {
    const pool2 = getPool();
    const res = await pool2.query(
      `INSERT INTO documents (id, trip_id, title, category, size, mime_type, file_url, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
      [
        doc.id,
        doc.trip_id,
        doc.title,
        doc.category,
        doc.size || null,
        doc.mime_type || null,
        doc.file_url || null,
        doc.metadata ? JSON.stringify(doc.metadata) : null
      ]
    );
    return res.rows[0];
  },
  async deleteDocument(id) {
    const pool2 = getPool();
    const res = await pool2.query("DELETE FROM documents WHERE id = $1 RETURNING *", [id]);
    return res.rows[0] || null;
  },
  // ---- History ----
  async getHistory(tripId) {
    const pool2 = getPool();
    const res = await pool2.query(
      "SELECT * FROM trip_history WHERE trip_id = $1 ORDER BY created_at DESC",
      [tripId]
    );
    return res.rows;
  },
  async createHistoryRecord(record) {
    const pool2 = getPool();
    const res = await pool2.query(
      `INSERT INTO trip_history (id, trip_id, action_type, event_title, event_data, comment)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
      [
        record.id,
        record.trip_id,
        record.action_type,
        record.event_title,
        record.event_data ? JSON.stringify(record.event_data) : null,
        record.comment || null
      ]
    );
    return res.rows[0];
  },
  async updateHistoryComment(id, comment) {
    const pool2 = getPool();
    const res = await pool2.query(
      "UPDATE trip_history SET comment = $1 WHERE id = $2 RETURNING *",
      [comment, id]
    );
    return res.rows[0];
  }
};

// server/index.ts
dotenv.config();
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
var DIST_PATH = path2.resolve(__dirname2, "../dist");
var DATA_PATH = process.env.DATA_PATH || path2.resolve(__dirname2, "../data");
var UPLOADS_PATH = path2.join(DATA_PATH, "uploads");
if (!fs.existsSync(UPLOADS_PATH)) {
  fs.mkdirSync(UPLOADS_PATH, { recursive: true });
}
var app = express();
var server = http.createServer(app);
var PORT = parseInt(process.env.PORT || "3000", 10);
var HOST = process.env.HOST || "0.0.0.0";
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/uploads", express.static(UPLOADS_PATH, {
  maxAge: "7d"
}));
var storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_PATH);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const ext = path2.extname(file.originalname);
    const base = path2.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `${uniqueSuffix}_${base}${ext}`);
  }
});
var upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
  // 50MB
});
var geminiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
var placesApiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";
var mapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";
var genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;
var wss = new WebSocketServer({ server, path: "/ws" });
var clients = /* @__PURE__ */ new Set();
wss.on("connection", (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: "CONNECTED", message: "Realtime sync connected" }));
  ws.on("close", () => {
    clients.delete(ws);
  });
  ws.on("error", (err) => {
    console.error("[WebSocket] Client error:", err);
    clients.delete(ws);
  });
});
function broadcastChange(table, eventType, newRecord, oldRecord) {
  const payload = JSON.stringify({
    type: "CHANGE",
    table,
    eventType,
    new: newRecord,
    old: oldRecord || null,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    database: isDbConnected() ? "connected" : "disconnected",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    database: isDbConnected() ? "connected" : "disconnected",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/env.js", (_req, res) => {
  const envConfig = {
    VITE_GOOGLE_MAPS_API_KEY: mapsApiKey
  };
  res.setHeader("Content-Type", "application/javascript; charset=UTF-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.send(`window.__ENV__ = ${JSON.stringify(envConfig)};`);
});
app.get("/api/config", (_req, res) => {
  res.status(200).json({
    databaseConnected: isDbConnected(),
    hasGemini: !!geminiApiKey,
    hasPlacesApi: !!placesApiKey,
    hasMapsApi: !!mapsApiKey
  });
});
app.get("/api/trips", async (_req, res) => {
  try {
    const trips = await dbService.getTrips();
    return res.status(200).json(trips);
  } catch (error) {
    console.error("[Trips API Error]:", error);
    return res.status(500).json({ error: "Failed to fetch trips" });
  }
});
app.get("/api/trips/:id", async (req, res) => {
  try {
    const trip = await dbService.getTrip(req.params.id);
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    return res.status(200).json(trip);
  } catch (error) {
    console.error("[Trips API Error]:", error);
    return res.status(500).json({ error: "Failed to fetch trip" });
  }
});
app.post("/api/trips", async (req, res) => {
  try {
    const newTrip = req.body;
    if (!newTrip || !newTrip.name) {
      return res.status(400).json({ error: "Invalid trip data: name is required" });
    }
    if (!newTrip.id) {
      newTrip.id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    const created = await dbService.createTrip(newTrip);
    broadcastChange("trips", "INSERT", created);
    return res.status(201).json(created);
  } catch (error) {
    console.error("[Trips API Error]:", error);
    return res.status(500).json({ error: "Failed to create trip" });
  }
});
app.put("/api/trips/:id", async (req, res) => {
  try {
    const updated = await dbService.updateTrip(req.params.id, req.body);
    broadcastChange("trips", "UPDATE", updated);
    return res.status(200).json(updated);
  } catch (error) {
    console.error("[Trips API Error]:", error);
    return res.status(500).json({ error: "Failed to update trip" });
  }
});
app.delete("/api/trips/:id", async (req, res) => {
  try {
    await dbService.deleteTrip(req.params.id);
    broadcastChange("trips", "DELETE", { id: req.params.id });
    return res.status(204).end();
  } catch (error) {
    console.error("[Trips API Error]:", error);
    return res.status(500).json({ error: "Failed to delete trip" });
  }
});
app.get("/api/events", async (req, res) => {
  try {
    const { tripId } = req.query;
    if (!tripId || typeof tripId !== "string") {
      return res.status(400).json({ error: "tripId is required" });
    }
    const events = await dbService.getEvents(tripId);
    return res.status(200).json(events);
  } catch (error) {
    console.error("[Events API Error]:", error);
    return res.status(500).json({ error: "Failed to fetch events" });
  }
});
app.post("/api/events", async (req, res) => {
  try {
    const eventData = req.body;
    if (!eventData || !eventData.trip_id || !eventData.title) {
      return res.status(400).json({ error: "Invalid event data" });
    }
    if (!eventData.id) {
      eventData.id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    const created = await dbService.createEvent(eventData);
    broadcastChange("events", "INSERT", created);
    return res.status(201).json(created);
  } catch (error) {
    console.error("[Events API Error]:", error);
    return res.status(500).json({ error: "Failed to create event" });
  }
});
app.post("/api/events/batch", async (req, res) => {
  try {
    const events = req.body;
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: "Expected array of events" });
    }
    const results = await dbService.upsertEvents(events);
    for (const ev of results) {
      broadcastChange("events", "UPDATE", ev);
    }
    return res.status(200).json(results);
  } catch (error) {
    console.error("[Batch Events Error]:", error);
    return res.status(500).json({ error: "Failed to batch update events" });
  }
});
app.put("/api/events/:id", async (req, res) => {
  try {
    const updated = await dbService.updateEvent(req.params.id, req.body);
    broadcastChange("events", "UPDATE", updated);
    return res.status(200).json(updated);
  } catch (error) {
    console.error("[Events API Error]:", error);
    return res.status(500).json({ error: "Failed to update event" });
  }
});
app.delete("/api/events/:id", async (req, res) => {
  try {
    await dbService.deleteEvent(req.params.id);
    broadcastChange("events", "DELETE", { id: req.params.id });
    return res.status(204).end();
  } catch (error) {
    console.error("[Events API Error]:", error);
    return res.status(500).json({ error: "Failed to delete event" });
  }
});
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const publicUrl = `/uploads/${req.file.filename}`;
  return res.status(200).json({
    success: true,
    fileName: req.file.originalname,
    storedName: req.file.filename,
    fileUrl: publicUrl,
    size: `${(req.file.size / 1024).toFixed(1)} KB`,
    mimeType: req.file.mimetype
  });
});
app.get("/api/documents", async (req, res) => {
  try {
    const { tripId } = req.query;
    if (!tripId || typeof tripId !== "string") {
      return res.status(400).json({ error: "tripId is required" });
    }
    const docs = await dbService.getDocuments(tripId);
    return res.status(200).json(docs);
  } catch (error) {
    console.error("[Documents API Error]:", error);
    return res.status(500).json({ error: "Failed to fetch documents" });
  }
});
app.post("/api/documents", async (req, res) => {
  try {
    const docData = req.body;
    if (!docData || !docData.trip_id || !docData.title) {
      return res.status(400).json({ error: "Invalid document data" });
    }
    if (!docData.id) {
      docData.id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    const created = await dbService.createDocument(docData);
    broadcastChange("documents", "INSERT", created);
    return res.status(201).json(created);
  } catch (error) {
    console.error("[Documents API Error]:", error);
    return res.status(500).json({ error: "Failed to create document" });
  }
});
app.post("/api/process-document", async (req, res) => {
  const { fileUrl, tripId, fileName, fileType, category: userCategory = "Other" } = req.body;
  if (!fileUrl || !tripId) {
    return res.status(400).json({ error: "Missing fileUrl or tripId" });
  }
  try {
    console.log("[Process-Document] Processing document:", fileName, "Type:", fileType);
    let finalTitle = fileName;
    let finalCategory = userCategory;
    let extractedEvent = null;
    let metadata = null;
    if (genAI && geminiApiKey) {
      try {
        let base64Data = "";
        if (fileUrl.startsWith("/uploads/")) {
          const localPath = path2.join(UPLOADS_PATH, path2.basename(fileUrl));
          if (fs.existsSync(localPath)) {
            base64Data = fs.readFileSync(localPath).toString("base64");
          }
        } else if (fileUrl.startsWith("http")) {
          const fileRes = await fetch(fileUrl);
          if (fileRes.ok) {
            const blob = await fileRes.blob();
            const buffer = await blob.arrayBuffer();
            base64Data = Buffer.from(buffer).toString("base64");
          }
        }
        if (base64Data) {
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          const prompt = `Analyze this travel document. 
                    - Categorize it as one of: 'Transport', 'Accommodation', 'Activity', 'Identity', 'Note', 'Finance', 'Other'.
                    - Provide a concise, highly readable, and professional title.
                    Return ONLY valid JSON:
                    {
                      "category": "Transport" | "Accommodation" | "Activity" | "Identity" | "Note" | "Finance" | "Other",
                      "title": "Concise File Name",
                      "extractedEvent": {
                        "title": "Title", "type": "Transport"| "Stay"| "Eat"| "Play", "time": "12:00 PM", 
                        "duration": "1h", "description": "...", "address": "...", "day_offset": 0
                      } | null
                    }`;
          const result = await model.generateContent([
            {
              inlineData: {
                data: base64Data,
                mimeType: fileType
              }
            },
            prompt
          ]);
          const response = await result.response;
          const text = response.text();
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const aiData = JSON.parse(jsonMatch[0]);
            if (aiData.title) finalTitle = aiData.title;
            if (aiData.category) finalCategory = aiData.category;
            if (aiData.extractedEvent) extractedEvent = aiData.extractedEvent;
            metadata = aiData;
          }
        }
      } catch (aiErr) {
        console.warn("[Gemini Warning] AI Analysis skipped/failed:", aiErr);
      }
    }
    const docId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const docData = await dbService.createDocument({
      id: docId,
      trip_id: tripId,
      title: finalTitle,
      category: finalCategory,
      file_url: fileUrl,
      size: "Unknown",
      mime_type: fileType,
      metadata
    });
    broadcastChange("documents", "INSERT", docData);
    let createdEvent = null;
    if (extractedEvent && extractedEvent.title) {
      try {
        const eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        createdEvent = await dbService.createEvent({
          id: eventId,
          trip_id: tripId,
          title: extractedEvent.title,
          type: extractedEvent.type || (finalCategory === "Accommodation" ? "Stay" : "Transport"),
          time: extractedEvent.time || "12:00 PM",
          duration: extractedEvent.duration || "1h",
          description: extractedEvent.description || "",
          address: extractedEvent.address || "",
          day_offset: extractedEvent.day_offset || 0,
          status: "Scheduled",
          sort_order: 999,
          end_time: null,
          rating: null,
          reviews: null,
          image: null,
          google_maps_link: null,
          travel_time: null,
          travel_mode: null,
          congestion: null,
          place_id: null,
          lat: null,
          lng: null,
          parking_buffer: 10,
          opening_hours: null,
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        });
        broadcastChange("events", "INSERT", createdEvent);
      } catch (evErr) {
        console.error("[Itinerary] Failed to auto-create event:", evErr);
      }
    }
    return res.status(200).json({
      document: docData,
      event: createdEvent,
      analysis: {
        title: finalTitle,
        category: finalCategory,
        autoCreatedEvent: !!createdEvent
      }
    });
  } catch (error) {
    console.error("[Process-Document Error]:", error);
    return res.status(500).json({
      error: "Processing failed",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});
app.post("/api/delete-document", async (req, res) => {
  const { documentId, fileUrl } = req.body;
  if (!documentId) {
    return res.status(400).json({ error: "Missing documentId" });
  }
  try {
    const deleted = await dbService.deleteDocument(documentId);
    broadcastChange("documents", "DELETE", { id: documentId });
    if (fileUrl && typeof fileUrl === "string" && fileUrl.startsWith("/uploads/")) {
      const localFile = path2.join(UPLOADS_PATH, path2.basename(fileUrl));
      if (fs.existsSync(localFile)) {
        fs.unlinkSync(localFile);
      }
    }
    return res.status(200).json({ success: true, deleted });
  } catch (error) {
    console.error("[Delete-Document Error]:", error);
    return res.status(500).json({ error: "Failed to delete document" });
  }
});
app.get("/api/history", async (req, res) => {
  try {
    const { tripId } = req.query;
    if (!tripId || typeof tripId !== "string") {
      return res.status(400).json({ error: "tripId is required" });
    }
    const history = await dbService.getHistory(tripId);
    return res.status(200).json(history);
  } catch (error) {
    console.error("[History API Error]:", error);
    return res.status(500).json({ error: "Failed to fetch history" });
  }
});
app.post("/api/history", async (req, res) => {
  try {
    const record = req.body;
    if (!record || !record.trip_id || !record.action_type || !record.event_title) {
      return res.status(400).json({ error: "Invalid history record" });
    }
    if (!record.id) {
      record.id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    const created = await dbService.createHistoryRecord(record);
    return res.status(201).json(created);
  } catch (error) {
    console.error("[History API Error]:", error);
    return res.status(500).json({ error: "Failed to create history record" });
  }
});
app.patch("/api/history/:id", async (req, res) => {
  try {
    const { comment } = req.body;
    const updated = await dbService.updateHistoryComment(req.params.id, comment || "");
    return res.status(200).json(updated);
  } catch (error) {
    console.error("[History API Error]:", error);
    return res.status(500).json({ error: "Failed to update history comment" });
  }
});
function extractFromMapsUrl(url) {
  const result = {};
  try {
    const placeMatch = url.match(/\/place\/([^/@]+)/);
    if (placeMatch) {
      result.query = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
    }
    const coordsMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordsMatch) {
      result.coords = {
        lat: parseFloat(coordsMatch[1]),
        lng: parseFloat(coordsMatch[2])
      };
    }
    const placeIdMatch = url.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+|ChIJ[A-Za-z0-9_-]+)/i);
    if (placeIdMatch) {
      result.placeId = placeIdMatch[1];
    }
    const urlObj = new URL(url);
    const qParam = urlObj.searchParams.get("q");
    if (qParam && !result.query) {
      result.query = qParam;
    }
  } catch (e) {
    console.log("[ExtractUrl] Error parsing URL:", e);
  }
  return result;
}
app.post("/api/parse-place", async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Google Maps URL is required" });
  }
  if (!placesApiKey) {
    return res.status(500).json({
      error: "Google Places API key not configured",
      hint: "Set GOOGLE_PLACES_API_KEY in environment variables"
    });
  }
  try {
    let expandedUrl = url;
    if (url.includes("maps.app.goo.gl") || url.includes("goo.gl/maps")) {
      try {
        const headRes = await fetch(url, {
          method: "HEAD",
          redirect: "follow"
        });
        expandedUrl = headRes.url;
      } catch (e) {
        console.log("[ParsePlace] Could not expand short URL:", e);
      }
    }
    const extracted = extractFromMapsUrl(expandedUrl);
    if (!extracted.query && !extracted.placeId) {
      return res.status(400).json({
        error: "Could not extract place info from URL",
        hint: "Please use a full Google Maps URL, not a shortened link"
      });
    }
    if (extracted.query) {
      const searchBody = {
        textQuery: extracted.query
      };
      if (extracted.coords) {
        searchBody.locationBias = {
          circle: {
            center: {
              latitude: extracted.coords.lat,
              longitude: extracted.coords.lng
            },
            radius: 500
          }
        };
      }
      const searchResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": placesApiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.photos,places.regularOpeningHours,places.googleMapsUri,places.reviews,places.location,places.websiteUri,places.priceLevel,places.editorialSummary"
        },
        body: JSON.stringify(searchBody)
      });
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.places && searchData.places.length > 0) {
          const place = searchData.places[0];
          const photoUrls = place.photos?.slice(0, 5).map(
            (photo) => `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${placesApiKey}`
          ) || [];
          const result = {
            name: place.displayName?.text || extracted.query,
            address: place.formattedAddress || "",
            rating: place.rating,
            reviewCount: place.userRatingCount,
            placeId: place.id,
            lat: place.location?.latitude,
            lng: place.location?.longitude,
            types: place.types,
            photos: photoUrls,
            openingHours: place.regularOpeningHours?.weekdayDescriptions,
            isOpen: place.regularOpeningHours?.openNow,
            googleMapsUrl: place.googleMapsUri || url,
            reviews: place.reviews?.slice(0, 3),
            websiteUri: place.websiteUri,
            priceLevel: place.priceLevel,
            editorialSummary: place.editorialSummary?.text,
            source: "google_places"
          };
          return res.status(200).json(result);
        }
      }
    }
    return res.status(200).json({
      name: extracted.query || "Unknown Place",
      address: extracted.coords ? `${extracted.coords.lat}, ${extracted.coords.lng}` : "See Google Maps",
      googleMapsUrl: url,
      source: "url_parsing"
    });
  } catch (error) {
    console.error("[ParsePlace Error]:", error);
    return res.status(500).json({
      error: "Failed to parse place",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
app.get("/api/place-details", async (req, res) => {
  const { placeId } = req.query;
  if (!placeId || typeof placeId !== "string") {
    return res.status(400).json({ error: "Place ID is required" });
  }
  if (!placesApiKey) {
    return res.status(500).json({
      error: "Google Places API key not configured",
      hint: "Set GOOGLE_PLACES_API_KEY in environment variables"
    });
  }
  try {
    const url = `https://places.googleapis.com/v1/places/${placeId}`;
    const fieldMask = [
      "id",
      "displayName",
      "formattedAddress",
      "rating",
      "userRatingCount",
      "types",
      "photos",
      "regularOpeningHours",
      "websiteUri",
      "nationalPhoneNumber",
      "priceLevel",
      "location",
      "googleMapsUri",
      "reviews",
      "editorialSummary"
    ].join(",");
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": placesApiKey,
        "X-Goog-FieldMask": fieldMask
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[PlaceDetails Error]:", response.status, errorText);
      return res.status(response.status).json({
        error: "Failed to fetch place details",
        status: response.status,
        details: errorText
      });
    }
    const data = await response.json();
    const photoUrls = data.photos?.slice(0, 5).map(
      (photo) => `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${placesApiKey}`
    ) || [];
    const result = {
      name: data.id,
      displayName: data.displayName?.text || "Unknown Place",
      formattedAddress: data.formattedAddress || "",
      rating: data.rating,
      userRatingCount: data.userRatingCount,
      placeId,
      types: data.types,
      photos: data.photos,
      regularOpeningHours: data.regularOpeningHours,
      websiteUri: data.websiteUri,
      nationalPhoneNumber: data.nationalPhoneNumber,
      priceLevel: data.priceLevel,
      location: data.location,
      googleMapsUri: data.googleMapsUri,
      reviews: data.reviews,
      editorialSummary: data.editorialSummary?.text,
      photoUrls
    };
    return res.status(200).json(result);
  } catch (error) {
    console.error("[PlaceDetails Exception]:", error);
    return res.status(500).json({
      error: "Failed to fetch place details",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
app.post("/api/explore-places", async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Search query is required" });
  }
  if (!placesApiKey) {
    return res.status(500).json({
      error: "Google Places API key not configured",
      hint: "Set GOOGLE_PLACES_API_KEY in environment variables"
    });
  }
  try {
    const searchResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": placesApiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.photos,places.regularOpeningHours,places.googleMapsUri,places.reviews,places.location,places.websiteUri,places.priceLevel,places.editorialSummary"
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize: 20
      })
    });
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      throw new Error(`Google Places API error: ${searchResponse.status} ${errorText}`);
    }
    const searchData = await searchResponse.json();
    const formatPlace = (place) => {
      const photoUrls = place.photos?.slice(0, 5).map(
        (photo) => `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=400&maxHeightPx=400&key=${placesApiKey}`
      ) || [];
      return {
        name: place.displayName?.text,
        address: place.formattedAddress,
        rating: place.rating,
        userRatingCount: place.userRatingCount,
        placeId: place.id,
        types: place.types,
        photos: photoUrls,
        openingHours: place.regularOpeningHours?.weekdayDescriptions,
        isOpen: place.regularOpeningHours?.openNow,
        googleMapsUrl: place.googleMapsUri,
        reviews: place.reviews,
        location: place.location,
        websiteUri: place.websiteUri,
        priceLevel: place.priceLevel,
        editorialSummary: place.editorialSummary?.text
      };
    };
    const places = (searchData.places || []).map(formatPlace);
    places.sort((a, b) => {
      const scoreA = (a.rating || 0) * (a.userRatingCount || 0);
      const scoreB = (b.rating || 0) * (b.userRatingCount || 0);
      return scoreB - scoreA;
    });
    return res.status(200).json({ places });
  } catch (error) {
    console.error("[ExplorePlaces Error]:", error);
    return res.status(500).json({
      error: "Failed to explore places",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
app.post("/api/optimize-route", async (req, res) => {
  const { items, preserveOrder = false, fixEnd = false, travelMode = "DRIVE" } = req.body;
  if (!items || !Array.isArray(items) || items.length < 2) {
    return res.status(400).json({ error: "At least 2 items are required to optimize a route." });
  }
  if (!mapsApiKey) {
    return res.status(500).json({ error: "Server configuration error: Missing Google Maps API Key" });
  }
  try {
    let origin, destination, pool2;
    if (fixEnd) {
      origin = items[0];
      destination = items[items.length - 1];
      pool2 = items.slice(1, -1);
    } else {
      origin = items[0];
      destination = items[0];
      pool2 = items.slice(1);
    }
    const buildWaypoint = (item) => {
      const hasValidPlaceId = item.placeId && item.placeId !== "unknown" && !String(item.placeId).startsWith("link-");
      if (hasValidPlaceId) {
        return { placeId: item.placeId };
      }
      if (item.lat && item.lng) {
        return {
          location: {
            latLng: {
              latitude: item.lat,
              longitude: item.lng
            }
          }
        };
      }
      return null;
    };
    const validIntermediates = pool2.map((item, index) => ({
      waypoint: buildWaypoint(item),
      index,
      title: item.title
    }));
    const invalidItems = validIntermediates.filter((x) => !x.waypoint);
    if (invalidItems.length > 0) {
      return res.status(400).json({
        error: "Some items map to invalid locations.",
        details: `Cannot optimize route. The following items strictly lack location data: ${invalidItems.map((x) => x.title).join(", ")}`
      });
    }
    const intermediates = validIntermediates.map((x) => x.waypoint);
    const originLoc = buildWaypoint(origin);
    const destLoc = buildWaypoint(destination);
    if (!originLoc) {
      return res.status(400).json({ error: `Origin location invalid: ${origin.title}` });
    }
    if (!destLoc) {
      return res.status(400).json({ error: `Destination location invalid: ${destination.title}` });
    }
    const response = await fetch(`https://routes.googleapis.com/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": mapsApiKey,
        "X-Goog-FieldMask": "routes.optimizedIntermediateWaypointIndex,routes.legs.duration,routes.legs.staticDuration,routes.legs.distanceMeters"
      },
      body: JSON.stringify({
        origin: originLoc,
        destination: destLoc,
        intermediates,
        travelMode,
        routingPreference: "TRAFFIC_AWARE",
        optimizeWaypointOrder: !preserveOrder,
        departureTime: new Date(Date.now() + 5 * 60 * 1e3).toISOString()
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Routes API Error]:", errorText);
      return res.status(response.status).json({ error: "Failed to calculate route", details: errorText });
    }
    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      return res.status(422).json({
        error: "No route found.",
        details: "Google Maps could not find a driving route between the specified locations."
      });
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error("[OptimizeRoute Exception]:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
app.post("/api/sync", (req, res) => {
  try {
    const { actions } = req.body;
    if (!Array.isArray(actions)) {
      return res.status(400).json({ error: "Invalid sync payload - expected actions array" });
    }
    const results = actions.map((action) => ({
      id: action.entityId,
      success: true
    }));
    return res.status(200).json({
      processed: results.length,
      successful: results.length,
      failed: 0,
      results,
      syncedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("[Sync Error]:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
if (fs.existsSync(DIST_PATH)) {
  console.log(`[Static] Serving static assets from ${DIST_PATH}`);
  app.use(express.static(DIST_PATH, {
    maxAge: "1d",
    setHeaders: (res, pathUrl) => {
      if (pathUrl.endsWith(".html") || pathUrl.endsWith("sw.js")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    }
  }));
  app.use((req, res) => {
    if (req.method === "GET" && !req.path.startsWith("/api") && !req.path.startsWith("/uploads")) {
      res.sendFile(path2.join(DIST_PATH, "index.html"));
    } else {
      res.status(404).json({ error: "Not Found" });
    }
  });
} else {
  console.warn(`[Static] Warning: dist folder not found at ${DIST_PATH}. If running in development, use Vite dev server.`);
  app.use((_req, res) => {
    res.send('Server is running. Frontend build (dist/) not found. Run "npm run build" to build the frontend.');
  });
}
server.listen(PORT, HOST, async () => {
  console.log(`
\u{1F680} Escher Travel Manager server is running!`);
  console.log(`   \u279C Local:   http://localhost:${PORT}`);
  console.log(`   \u279C Network: http://${HOST}:${PORT}`);
  console.log(`   \u279C Uploads: ${UPLOADS_PATH}
`);
  await initDatabase();
});
var shutdown = () => {
  console.log("\nGracefully shutting down server...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
export {
  broadcastChange
};
