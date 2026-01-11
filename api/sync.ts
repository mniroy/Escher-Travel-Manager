import type { VercelRequest, VercelResponse } from '@vercel/node';

// Batch sync endpoint for offline changes
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const { actions } = req.body;

        if (!Array.isArray(actions)) {
            return res.status(400).json({ error: 'Invalid sync payload - expected actions array' });
        }

        const results: { id: string; success: boolean; error?: string }[] = [];

        for (const action of actions) {
            try {
                // Process each sync action
                // In a real implementation, this would route to the appropriate handler
                console.log(`[Sync] Processing action: ${action.type} ${action.entity} ${action.entityId}`);

                results.push({
                    id: action.entityId,
                    success: true,
                });
            } catch (error) {
                results.push({
                    id: action.entityId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return res.status(200).json({
            processed: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results,
            syncedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Sync API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
