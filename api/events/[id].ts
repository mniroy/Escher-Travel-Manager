import type { VercelRequest, VercelResponse } from '@vercel/node';

// Shared events storage
let events: any[] = [];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Invalid event ID' });
    }

    try {
        switch (req.method) {
            case 'GET': {
                const event = events.find(e => e.id === id);
                if (!event) {
                    return res.status(404).json({ error: 'Event not found' });
                }
                return res.status(200).json(event);
            }

            case 'PUT': {
                const updatedEvent = req.body;
                const index = events.findIndex(e => e.id === id);

                if (index === -1) {
                    events.push({ ...updatedEvent, id });
                } else {
                    events[index] = { ...updatedEvent, id };
                }

                return res.status(200).json(events.find(e => e.id === id));
            }

            case 'DELETE': {
                const deleteIndex = events.findIndex(e => e.id === id);
                if (deleteIndex >= 0) {
                    events.splice(deleteIndex, 1);
                }
                return res.status(204).end();
            }

            default:
                res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
                return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
