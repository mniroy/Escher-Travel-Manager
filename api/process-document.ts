
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Supabase
// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('SERVER ERROR: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing.');
}

const supabase = createClient(supabaseUrl || 'MISSING_URL', supabaseKey || 'MISSING_KEY');

// Initialize Gemini
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
    console.error('SERVER ERROR: GOOGLE_GENERATIVE_AI_API_KEY is missing in environment variables.');
}
const genAI = new GoogleGenerativeAI(apiKey || 'MISSING_KEY');

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (!apiKey) {
        return res.status(500).json({ error: 'Server Configuration Error: Missing Gemini API Key' });
    }
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!req.body) {
        return res.status(400).json({ error: 'Missing request body' });
    }

    const { fileUrl, tripId, fileName, fileType, category = 'Other' } = req.body;

    if (!fileUrl || !tripId) {
        return res.status(400).json({ error: 'Missing fileUrl or tripId' });
    }

    try {
        console.log('Processing document (Simple Upload):', fileName, 'Category:', category);

        // AI Feature Skipped as requested
        // Using fileName as title and identifying as provided category

        // 2. Save Document to Supabase DB
        const { data: docData, error: docError } = await supabase
            .from('documents')
            .insert({
                trip_id: tripId,
                title: fileName,
                category: category,
                file_url: fileUrl,
                size: 'Unknown',
                mime_type: fileType
            })
            .select()
            .single();

        if (docError) throw docError;

        return res.status(200).json({
            document: docData,
            event: null,
            analysis: {
                title: fileName,
                category: category,
                isBoardingPass: false
            }
        });

    } catch (error) {
        console.error('Error processing document (Detailed):', error);
        return res.status(500).json({
            error: 'Processing failed',
            details: error instanceof Error ? error.message : String(error)
        });
    }
}
