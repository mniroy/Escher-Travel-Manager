import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-memory storage for serverless (will reset on cold start)
// For production, connect to Vercel KV, Postgres, or external DB
let trips: any[] = [];

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
            case 'GET':
                return res.status(200).json(trips);

            case 'POST':
                const newTrip = req.body;
                if (!newTrip || !newTrip.id) {
                    return res.status(400).json({ error: 'Invalid trip data' });
                }

                // Check for duplicate
                const existingIndex = trips.findIndex(t => t.id === newTrip.id);
                if (existingIndex >= 0) {
                    trips[existingIndex] = newTrip;
                } else {
                    trips.push(newTrip);
                }

                return res.status(201).json(newTrip);

            default:
                res.setHeader('Allow', ['GET', 'POST']);
                return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
