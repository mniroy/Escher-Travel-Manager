
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { documentId, fileUrl } = req.body;

    if (!documentId) {
        return res.status(400).json({ error: 'Missing documentId' });
    }

    try {
        // 1. Delete from DB
        const { error: dbError } = await supabase
            .from('documents')
            .delete()
            .eq('id', documentId);

        if (dbError) throw dbError;

        // 2. Delete from Storage (if fileUrl exists)
        if (fileUrl) {
            // Extract path from URL
            // e.g. .../storage/v1/object/public/trip_docs/folder/file.pdf -> folder/file.pdf
            const urlParts = fileUrl.split('/trip_docs/');
            if (urlParts.length > 1) {
                const path = urlParts[1];
                const { error: storageError } = await supabase
                    .storage
                    .from('trip_docs')
                    .remove([path]);

                if (storageError) console.error('Storage deletion error (non-fatal):', storageError);
            }
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to delete document' });
    }
}
