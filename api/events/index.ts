import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-memory events storage
let events: any[] = [];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        switch (req.method) {
            case 'GET': {
                const { tripId } = req.query;
                if (tripId && typeof tripId === 'string') {
                    const filtered = events.filter(e => e.tripId === tripId);
                    return res.status(200).json(filtered);
                }
                return res.status(200).json(events);
            }

            case 'POST': {
                const body = req.body;

                // Handle batch events
                if (Array.isArray(body)) {
                    for (const event of body) {
                        if (!event.id) continue;
                        const index = events.findIndex(e => e.id === event.id);
                        if (index >= 0) {
                            events[index] = event;
                        } else {
                            events.push(event);
                        }
                    }
                    return res.status(201).json(body);
                }

                // Handle single event
                const newEvent = body;
                if (!newEvent || !newEvent.id) {
                    return res.status(400).json({ error: 'Invalid event data' });
                }

                const existingIndex = events.findIndex(e => e.id === newEvent.id);
                if (existingIndex >= 0) {
                    events[existingIndex] = newEvent;
                } else {
                    events.push(newEvent);
                }

                return res.status(201).json(newEvent);
            }

            default:
                res.setHeader('Allow', ['GET', 'POST']);
                return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
