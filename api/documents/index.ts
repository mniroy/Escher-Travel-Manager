import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-memory documents storage
let documents: any[] = [];

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
                    const filtered = documents.filter(d => d.tripId === tripId);
                    return res.status(200).json(filtered);
                }
                return res.status(200).json(documents);
            }

            case 'POST': {
                const newDoc = req.body;
                if (!newDoc || !newDoc.id) {
                    return res.status(400).json({ error: 'Invalid document data' });
                }

                const existingIndex = documents.findIndex(d => d.id === newDoc.id);
                if (existingIndex >= 0) {
                    documents[existingIndex] = newDoc;
                } else {
                    documents.push(newDoc);
                }

                return res.status(201).json(newDoc);
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
