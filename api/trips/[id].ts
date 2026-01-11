import type { VercelRequest, VercelResponse } from '@vercel/node';

// Shared trips storage (same instance as index.ts in serverless context)
let trips: any[] = [];

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
        return res.status(400).json({ error: 'Invalid trip ID' });
    }

    try {
        switch (req.method) {
            case 'GET': {
                const trip = trips.find(t => t.id === id);
                if (!trip) {
                    return res.status(404).json({ error: 'Trip not found' });
                }
                return res.status(200).json(trip);
            }

            case 'PUT': {
                const updatedTrip = req.body;
                const index = trips.findIndex(t => t.id === id);

                if (index === -1) {
                    // If not found, create it
                    trips.push({ ...updatedTrip, id });
                } else {
                    trips[index] = { ...updatedTrip, id };
                }

                return res.status(200).json(trips.find(t => t.id === id));
            }

            case 'DELETE': {
                const deleteIndex = trips.findIndex(t => t.id === id);
                if (deleteIndex >= 0) {
                    trips.splice(deleteIndex, 1);
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
