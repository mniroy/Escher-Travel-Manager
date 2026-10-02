import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbService, initDatabase, isDbConnected, DbTrip, DbEvent, DbDocument, DbHistory } from './db.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_PATH = path.resolve(__dirname, '../dist');
const DATA_PATH = process.env.DATA_PATH || path.resolve(__dirname, '../data');
const UPLOADS_PATH = path.join(DATA_PATH, 'uploads');

// Ensure upload directories exist
if (!fs.existsSync(UPLOADS_PATH)) {
    fs.mkdirSync(UPLOADS_PATH, { recursive: true });
}

const app = express();
const server = http.createServer(app);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Global CORS & Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve local uploaded files
app.use('/uploads', express.static(UPLOADS_PATH, {
    maxAge: '7d',
}));

// Configure Multer for local file storage
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOADS_PATH);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `${uniqueSuffix}_${base}${ext}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ----------------------------------------------------
// Google AI & Maps Config
// ----------------------------------------------------
const geminiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
const placesApiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';
const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';

const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

// ----------------------------------------------------
// WebSocket Server for Real-Time Multi-Device Sync
// ----------------------------------------------------
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Realtime sync connected' }));

    ws.on('close', () => {
        clients.delete(ws);
    });

    ws.on('error', (err) => {
        console.error('[WebSocket] Client error:', err);
        clients.delete(ws);
    });
});

export function broadcastChange(table: 'trips' | 'events' | 'documents' | 'history', eventType: 'INSERT' | 'UPDATE' | 'DELETE', newRecord: any, oldRecord?: any) {
    const payload = JSON.stringify({
        type: 'CHANGE',
        table,
        eventType,
        new: newRecord,
        old: oldRecord || null,
        timestamp: new Date().toISOString(),
    });

    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}

// ----------------------------------------------------
// Health Check & Runtime Config Endpoints
// ----------------------------------------------------
app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
        status: 'ok',
        database: isDbConnected() ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
    });
});

app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
        status: 'ok',
        database: isDbConnected() ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
    });
});

// Runtime configuration injected into frontend
app.get('/env.js', (_req: Request, res: Response) => {
    const envConfig = {
        VITE_GOOGLE_MAPS_API_KEY: mapsApiKey,
    };

    res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.send(`window.__ENV__ = ${JSON.stringify(envConfig)};`);
});

app.get('/api/config', (_req: Request, res: Response) => {
    res.status(200).json({
        databaseConnected: isDbConnected(),
        hasGemini: !!geminiApiKey,
        hasPlacesApi: !!placesApiKey,
        hasMapsApi: !!mapsApiKey,
    });
});

// ----------------------------------------------------
// 1. Trips API (Self-Hosted)
// ----------------------------------------------------
app.get('/api/trips', async (_req: Request, res: Response) => {
    try {
        const trips = await dbService.getTrips();
        return res.status(200).json(trips);
    } catch (error) {
        console.error('[Trips API Error]:', error);
        return res.status(500).json({ error: 'Failed to fetch trips' });
    }
});

app.get('/api/trips/:id', async (req: Request, res: Response) => {
    try {
        const trip = await dbService.getTrip(req.params.id);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });
        return res.status(200).json(trip);
    } catch (error) {
        console.error('[Trips API Error]:', error);
        return res.status(500).json({ error: 'Failed to fetch trip' });
    }
});

app.post('/api/trips', async (req: Request, res: Response) => {
    try {
        const newTrip = req.body;
        if (!newTrip || !newTrip.name) {
            return res.status(400).json({ error: 'Invalid trip data: name is required' });
        }
        if (!newTrip.id) {
            newTrip.id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        }
        const created = await dbService.createTrip(newTrip);
        broadcastChange('trips', 'INSERT', created);
        return res.status(201).json(created);
    } catch (error) {
        console.error('[Trips API Error]:', error);
        return res.status(500).json({ error: 'Failed to create trip' });
    }
});

app.put('/api/trips/:id', async (req: Request, res: Response) => {
    try {
        const updated = await dbService.updateTrip(req.params.id, req.body);
        broadcastChange('trips', 'UPDATE', updated);
        return res.status(200).json(updated);
    } catch (error) {
        console.error('[Trips API Error]:', error);
        return res.status(500).json({ error: 'Failed to update trip' });
    }
});

app.delete('/api/trips/:id', async (req: Request, res: Response) => {
    try {
        await dbService.deleteTrip(req.params.id);
        broadcastChange('trips', 'DELETE', { id: req.params.id });
        return res.status(204).end();
    } catch (error) {
        console.error('[Trips API Error]:', error);
        return res.status(500).json({ error: 'Failed to delete trip' });
    }
});

// ----------------------------------------------------
// 2. Events API (Self-Hosted)
// ----------------------------------------------------
app.get('/api/events', async (req: Request, res: Response) => {
    try {
        const { tripId } = req.query;
        if (!tripId || typeof tripId !== 'string') {
            return res.status(400).json({ error: 'tripId is required' });
        }
        const events = await dbService.getEvents(tripId);
        return res.status(200).json(events);
    } catch (error) {
        console.error('[Events API Error]:', error);
        return res.status(500).json({ error: 'Failed to fetch events' });
    }
});

app.post('/api/events', async (req: Request, res: Response) => {
    try {
        const eventData = req.body;
        if (!eventData || !eventData.trip_id || !eventData.title) {
            return res.status(400).json({ error: 'Invalid event data' });
        }
        if (!eventData.id) {
            eventData.id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        }
        const created = await dbService.createEvent(eventData);
        broadcastChange('events', 'INSERT', created);
        return res.status(201).json(created);
    } catch (error) {
        console.error('[Events API Error]:', error);
        return res.status(500).json({ error: 'Failed to create event' });
    }
});

app.post('/api/events/batch', async (req: Request, res: Response) => {
    try {
        const events: DbEvent[] = req.body;
        if (!Array.isArray(events)) {
            return res.status(400).json({ error: 'Expected array of events' });
        }
        const results = await dbService.upsertEvents(events);
        for (const ev of results) {
            broadcastChange('events', 'UPDATE', ev);
        }
        return res.status(200).json(results);
    } catch (error) {
        console.error('[Batch Events Error]:', error);
        return res.status(500).json({ error: 'Failed to batch update events' });
    }
});

app.put('/api/events/:id', async (req: Request, res: Response) => {
    try {
        const updated = await dbService.updateEvent(req.params.id, req.body);
        broadcastChange('events', 'UPDATE', updated);
        return res.status(200).json(updated);
    } catch (error) {
        console.error('[Events API Error]:', error);
        return res.status(500).json({ error: 'Failed to update event' });
    }
});

app.delete('/api/events/:id', async (req: Request, res: Response) => {
    try {
        await dbService.deleteEvent(req.params.id);
        broadcastChange('events', 'DELETE', { id: req.params.id });
        return res.status(204).end();
    } catch (error) {
        console.error('[Events API Error]:', error);
        return res.status(500).json({ error: 'Failed to delete event' });
    }
});

// ----------------------------------------------------
// 3. Local File Upload & Document Processing
// ----------------------------------------------------
app.post('/api/upload', upload.single('file'), (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const publicUrl = `/uploads/${req.file.filename}`;
    return res.status(200).json({
        success: true,
        fileName: req.file.originalname,
        storedName: req.file.filename,
        fileUrl: publicUrl,
        size: `${(req.file.size / 1024).toFixed(1)} KB`,
        mimeType: req.file.mimetype,
    });
});

app.get('/api/documents', async (req: Request, res: Response) => {
    try {
        const { tripId } = req.query;
        if (!tripId || typeof tripId !== 'string') {
            return res.status(400).json({ error: 'tripId is required' });
        }
        const docs = await dbService.getDocuments(tripId);
        return res.status(200).json(docs);
    } catch (error) {
        console.error('[Documents API Error]:', error);
        return res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

app.post('/api/documents', async (req: Request, res: Response) => {
    try {
        const docData = req.body;
        if (!docData || !docData.trip_id || !docData.title) {
            return res.status(400).json({ error: 'Invalid document data' });
        }
        if (!docData.id) {
            docData.id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        }
        const created = await dbService.createDocument(docData);
        broadcastChange('documents', 'INSERT', created);
        return res.status(201).json(created);
    } catch (error) {
        console.error('[Documents API Error]:', error);
        return res.status(500).json({ error: 'Failed to create document' });
    }
});

app.post('/api/process-document', async (req: Request, res: Response) => {
    const { fileUrl, tripId, fileName, fileType, category: userCategory = 'Other' } = req.body;

    if (!fileUrl || !tripId) {
        return res.status(400).json({ error: 'Missing fileUrl or tripId' });
    }

    try {
        console.log('[Process-Document] Processing document:', fileName, 'Type:', fileType);

        let finalTitle = fileName;
        let finalCategory = userCategory;
        let extractedEvent: any = null;
        let metadata: any = null;

        // Run Gemini Analysis if API Key is configured
        if (genAI && geminiApiKey) {
            try {
                let base64Data = '';

                if (fileUrl.startsWith('/uploads/')) {
                    const localPath = path.join(UPLOADS_PATH, path.basename(fileUrl));
                    if (fs.existsSync(localPath)) {
                        base64Data = fs.readFileSync(localPath).toString('base64');
                    }
                } else if (fileUrl.startsWith('http')) {
                    const fileRes = await fetch(fileUrl);
                    if (fileRes.ok) {
                        const blob = await fileRes.blob();
                        const buffer = await blob.arrayBuffer();
                        base64Data = Buffer.from(buffer).toString('base64');
                    }
                }

                if (base64Data) {
                    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
                                mimeType: fileType,
                            },
                        },
                        prompt,
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
                console.warn('[Gemini Warning] AI Analysis skipped/failed:', aiErr);
            }
        }

        // Save Document to Database
        const docId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const docData = await dbService.createDocument({
            id: docId,
            trip_id: tripId,
            title: finalTitle,
            category: finalCategory,
            file_url: fileUrl,
            size: 'Unknown',
            mime_type: fileType,
            metadata: metadata,
        });

        broadcastChange('documents', 'INSERT', docData);

        // Auto-create event if AI extracted one
        let createdEvent = null;
        if (extractedEvent && extractedEvent.title) {
            try {
                const eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                createdEvent = await dbService.createEvent({
                    id: eventId,
                    trip_id: tripId,
                    title: extractedEvent.title,
                    type: extractedEvent.type || (finalCategory === 'Accommodation' ? 'Stay' : 'Transport'),
                    time: extractedEvent.time || '12:00 PM',
                    duration: extractedEvent.duration || '1h',
                    description: extractedEvent.description || '',
                    address: extractedEvent.address || '',
                    day_offset: extractedEvent.day_offset || 0,
                    status: 'Scheduled',
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
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });
                broadcastChange('events', 'INSERT', createdEvent);
            } catch (evErr) {
                console.error('[Itinerary] Failed to auto-create event:', evErr);
            }
        }

        return res.status(200).json({
            document: docData,
            event: createdEvent,
            analysis: {
                title: finalTitle,
                category: finalCategory,
                autoCreatedEvent: !!createdEvent,
            },
        });
    } catch (error) {
        console.error('[Process-Document Error]:', error);
        return res.status(500).json({
            error: 'Processing failed',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});

app.post('/api/delete-document', async (req: Request, res: Response) => {
    const { documentId, fileUrl } = req.body;
    if (!documentId) {
        return res.status(400).json({ error: 'Missing documentId' });
    }

    try {
        const deleted = await dbService.deleteDocument(documentId);
        broadcastChange('documents', 'DELETE', { id: documentId });

        // Remove local file if stored in /uploads
        if (fileUrl && typeof fileUrl === 'string' && fileUrl.startsWith('/uploads/')) {
            const localFile = path.join(UPLOADS_PATH, path.basename(fileUrl));
            if (fs.existsSync(localFile)) {
                fs.unlinkSync(localFile);
            }
        }

        return res.status(200).json({ success: true, deleted });
    } catch (error) {
        console.error('[Delete-Document Error]:', error);
        return res.status(500).json({ error: 'Failed to delete document' });
    }
});

// ----------------------------------------------------
// 4. Trip History API (Self-Hosted)
// ----------------------------------------------------
app.get('/api/history', async (req: Request, res: Response) => {
    try {
        const { tripId } = req.query;
        if (!tripId || typeof tripId !== 'string') {
            return res.status(400).json({ error: 'tripId is required' });
        }
        const history = await dbService.getHistory(tripId);
        return res.status(200).json(history);
    } catch (error) {
        console.error('[History API Error]:', error);
        return res.status(500).json({ error: 'Failed to fetch history' });
    }
});

app.post('/api/history', async (req: Request, res: Response) => {
    try {
        const record = req.body;
        if (!record || !record.trip_id || !record.action_type || !record.event_title) {
            return res.status(400).json({ error: 'Invalid history record' });
        }
        if (!record.id) {
            record.id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        }
        const created = await dbService.createHistoryRecord(record);
        return res.status(201).json(created);
    } catch (error) {
        console.error('[History API Error]:', error);
        return res.status(500).json({ error: 'Failed to create history record' });
    }
});

app.patch('/api/history/:id', async (req: Request, res: Response) => {
    try {
        const { comment } = req.body;
        const updated = await dbService.updateHistoryComment(req.params.id, comment || '');
        return res.status(200).json(updated);
    } catch (error) {
        console.error('[History API Error]:', error);
        return res.status(500).json({ error: 'Failed to update history comment' });
    }
});

// ----------------------------------------------------
// 5. Google Places & Maps API
// ----------------------------------------------------
function extractFromMapsUrl(url: string): { query?: string; placeId?: string; coords?: { lat: number; lng: number } } {
    const result: { query?: string; placeId?: string; coords?: { lat: number; lng: number } } = {};
    try {
        const placeMatch = url.match(/\/place\/([^/@]+)/);
        if (placeMatch) {
            result.query = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
        }

        const coordsMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordsMatch) {
            result.coords = {
                lat: parseFloat(coordsMatch[1]),
                lng: parseFloat(coordsMatch[2]),
            };
        }

        const placeIdMatch = url.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+|ChIJ[A-Za-z0-9_-]+)/i);
        if (placeIdMatch) {
            result.placeId = placeIdMatch[1];
        }

        const urlObj = new URL(url);
        const qParam = urlObj.searchParams.get('q');
        if (qParam && !result.query) {
            result.query = qParam;
        }
    } catch (e) {
        console.log('[ExtractUrl] Error parsing URL:', e);
    }
    return result;
}

app.post('/api/parse-place', async (req: Request, res: Response) => {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Google Maps URL is required' });
    }

    if (!placesApiKey) {
        return res.status(500).json({
            error: 'Google Places API key not configured',
            hint: 'Set GOOGLE_PLACES_API_KEY in environment variables',
        });
    }

    try {
        let expandedUrl = url;

        if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
            try {
                const headRes = await fetch(url, {
                    method: 'HEAD',
                    redirect: 'follow',
                });
                expandedUrl = headRes.url;
            } catch (e) {
                console.log('[ParsePlace] Could not expand short URL:', e);
            }
        }

        const extracted = extractFromMapsUrl(expandedUrl);

        if (!extracted.query && !extracted.placeId) {
            return res.status(400).json({
                error: 'Could not extract place info from URL',
                hint: 'Please use a full Google Maps URL, not a shortened link',
            });
        }

        if (extracted.query) {
            const searchBody: Record<string, unknown> = {
                textQuery: extracted.query,
            };

            if (extracted.coords) {
                searchBody.locationBias = {
                    circle: {
                        center: {
                            latitude: extracted.coords.lat,
                            longitude: extracted.coords.lng,
                        },
                        radius: 500,
                    },
                };
            }

            const searchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': placesApiKey,
                    'X-Goog-FieldMask':
                        'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.photos,places.regularOpeningHours,places.googleMapsUri,places.reviews,places.location,places.websiteUri,places.priceLevel,places.editorialSummary',
                },
                body: JSON.stringify(searchBody),
            });

            if (searchResponse.ok) {
                const searchData = await searchResponse.json();

                if (searchData.places && searchData.places.length > 0) {
                    const place = searchData.places[0];

                    const photoUrls =
                        place.photos?.slice(0, 5).map(
                            (photo: { name: string }) =>
                                `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${placesApiKey}`
                        ) || [];

                    const result = {
                        name: place.displayName?.text || extracted.query,
                        address: place.formattedAddress || '',
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
                        source: 'google_places',
                    };

                    return res.status(200).json(result);
                }
            }
        }

        return res.status(200).json({
            name: extracted.query || 'Unknown Place',
            address: extracted.coords ? `${extracted.coords.lat}, ${extracted.coords.lng}` : 'See Google Maps',
            googleMapsUrl: url,
            source: 'url_parsing',
        });
    } catch (error) {
        console.error('[ParsePlace Error]:', error);
        return res.status(500).json({
            error: 'Failed to parse place',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.get('/api/place-details', async (req: Request, res: Response) => {
    const { placeId } = req.query;

    if (!placeId || typeof placeId !== 'string') {
        return res.status(400).json({ error: 'Place ID is required' });
    }

    if (!placesApiKey) {
        return res.status(500).json({
            error: 'Google Places API key not configured',
            hint: 'Set GOOGLE_PLACES_API_KEY in environment variables',
        });
    }

    try {
        const url = `https://places.googleapis.com/v1/places/${placeId}`;
        const fieldMask = [
            'id',
            'displayName',
            'formattedAddress',
            'rating',
            'userRatingCount',
            'types',
            'photos',
            'regularOpeningHours',
            'websiteUri',
            'nationalPhoneNumber',
            'priceLevel',
            'location',
            'googleMapsUri',
            'reviews',
            'editorialSummary',
        ].join(',');

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': placesApiKey,
                'X-Goog-FieldMask': fieldMask,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[PlaceDetails Error]:', response.status, errorText);
            return res.status(response.status).json({
                error: 'Failed to fetch place details',
                status: response.status,
                details: errorText,
            });
        }

        const data = await response.json();

        const photoUrls =
            data.photos?.slice(0, 5).map(
                (photo: { name: string }) =>
                    `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${placesApiKey}`
            ) || [];

        const result = {
            name: data.id,
            displayName: data.displayName?.text || 'Unknown Place',
            formattedAddress: data.formattedAddress || '',
            rating: data.rating,
            userRatingCount: data.userRatingCount,
            placeId: placeId,
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
            photoUrls,
        };

        return res.status(200).json(result);
    } catch (error) {
        console.error('[PlaceDetails Exception]:', error);
        return res.status(500).json({
            error: 'Failed to fetch place details',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.post('/api/explore-places', async (req: Request, res: Response) => {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
    }

    if (!placesApiKey) {
        return res.status(500).json({
            error: 'Google Places API key not configured',
            hint: 'Set GOOGLE_PLACES_API_KEY in environment variables',
        });
    }

    try {
        const searchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': placesApiKey,
                'X-Goog-FieldMask':
                    'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.photos,places.regularOpeningHours,places.googleMapsUri,places.reviews,places.location,places.websiteUri,places.priceLevel,places.editorialSummary',
            },
            body: JSON.stringify({
                textQuery: query,
                pageSize: 20,
            }),
        });

        if (!searchResponse.ok) {
            const errorText = await searchResponse.text();
            throw new Error(`Google Places API error: ${searchResponse.status} ${errorText}`);
        }

        const searchData = await searchResponse.json();

        const formatPlace = (place: any) => {
            const photoUrls =
                place.photos?.slice(0, 5).map(
                    (photo: { name: string }) =>
                        `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=400&maxHeightPx=400&key=${placesApiKey}`
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
                editorialSummary: place.editorialSummary?.text,
            };
        };

        const places = (searchData.places || []).map(formatPlace);

        places.sort((a: any, b: any) => {
            const scoreA = (a.rating || 0) * (a.userRatingCount || 0);
            const scoreB = (b.rating || 0) * (b.userRatingCount || 0);
            return scoreB - scoreA;
        });

        return res.status(200).json({ places });
    } catch (error) {
        console.error('[ExplorePlaces Error]:', error);
        return res.status(500).json({
            error: 'Failed to explore places',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

app.post('/api/optimize-route', async (req: Request, res: Response) => {
    const { items, preserveOrder = false, fixEnd = false, travelMode = 'DRIVE' } = req.body;

    if (!items || !Array.isArray(items) || items.length < 2) {
        return res.status(400).json({ error: 'At least 2 items are required to optimize a route.' });
    }

    if (!mapsApiKey) {
        return res.status(500).json({ error: 'Server configuration error: Missing Google Maps API Key' });
    }

    try {
        let origin: any, destination: any, pool: any[];

        if (fixEnd) {
            origin = items[0];
            destination = items[items.length - 1];
            pool = items.slice(1, -1);
        } else {
            origin = items[0];
            destination = items[0];
            pool = items.slice(1);
        }

        const buildWaypoint = (item: any) => {
            const hasValidPlaceId =
                item.placeId &&
                item.placeId !== 'unknown' &&
                !String(item.placeId).startsWith('link-');

            if (hasValidPlaceId) {
                return { placeId: item.placeId };
            }

            if (item.lat && item.lng) {
                return {
                    location: {
                        latLng: {
                            latitude: item.lat,
                            longitude: item.lng,
                        },
                    },
                };
            }
            return null;
        };

        const validIntermediates = pool.map((item, index) => ({
            waypoint: buildWaypoint(item),
            index: index,
            title: item.title,
        }));

        const invalidItems = validIntermediates.filter((x) => !x.waypoint);

        if (invalidItems.length > 0) {
            return res.status(400).json({
                error: 'Some items map to invalid locations.',
                details: `Cannot optimize route. The following items strictly lack location data: ${invalidItems.map((x) => x.title).join(', ')}`,
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
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': mapsApiKey,
                'X-Goog-FieldMask':
                    'routes.optimizedIntermediateWaypointIndex,routes.legs.duration,routes.legs.staticDuration,routes.legs.distanceMeters',
            },
            body: JSON.stringify({
                origin: originLoc,
                destination: destLoc,
                intermediates: intermediates,
                travelMode: travelMode,
                routingPreference: 'TRAFFIC_AWARE',
                optimizeWaypointOrder: !preserveOrder,
                departureTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Routes API Error]:', errorText);
            return res.status(response.status).json({ error: 'Failed to calculate route', details: errorText });
        }

        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
            return res.status(422).json({
                error: 'No route found.',
                details: 'Google Maps could not find a driving route between the specified locations.',
            });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('[OptimizeRoute Exception]:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ----------------------------------------------------
// 6. Offline Sync API
// ----------------------------------------------------
app.post('/api/sync', (req: Request, res: Response) => {
    try {
        const { actions } = req.body;

        if (!Array.isArray(actions)) {
            return res.status(400).json({ error: 'Invalid sync payload - expected actions array' });
        }

        const results = actions.map((action) => ({
            id: action.entityId,
            success: true,
        }));

        return res.status(200).json({
            processed: results.length,
            successful: results.length,
            failed: 0,
            results,
            syncedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[Sync Error]:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ----------------------------------------------------
// 7. Static Files & SPA Fallback
// ----------------------------------------------------
if (fs.existsSync(DIST_PATH)) {
    console.log(`[Static] Serving static assets from ${DIST_PATH}`);
    app.use(express.static(DIST_PATH, {
        maxAge: '1d',
        setHeaders: (res, pathUrl) => {
            if (pathUrl.endsWith('.html') || pathUrl.endsWith('sw.js')) {
                res.setHeader('Cache-Control', 'no-cache');
            }
        },
    }));

    app.use((req: Request, res: Response) => {
        if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
            res.sendFile(path.join(DIST_PATH, 'index.html'));
        } else {
            res.status(404).json({ error: 'Not Found' });
        }
    });
} else {
    console.warn(`[Static] Warning: dist folder not found at ${DIST_PATH}. If running in development, use Vite dev server.`);
    app.use((_req: Request, res: Response) => {
        res.send('Server is running. Frontend build (dist/) not found. Run "npm run build" to build the frontend.');
    });
}

// ----------------------------------------------------
// Start Server and Initialize Database
// ----------------------------------------------------
server.listen(PORT, HOST, async () => {
    console.log(`\n🚀 Escher Travel Manager server is running!`);
    console.log(`   ➜ Local:   http://localhost:${PORT}`);
    console.log(`   ➜ Network: http://${HOST}:${PORT}`);
    console.log(`   ➜ Uploads: ${UPLOADS_PATH}\n`);

    // Initialize database tables
    await initDatabase();
});

// Graceful Shutdown
const shutdown = () => {
    console.log('\nGracefully shutting down server...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
