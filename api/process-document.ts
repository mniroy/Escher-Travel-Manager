
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { fileUrl, tripId, fileName, fileType } = req.body;

    if (!fileUrl || !tripId) {
        return res.status(400).json({ error: 'Missing fileUrl or tripId' });
    }

    try {
        console.log('Processing document:', fileName);

        // 1. Analyze with Gemini
        // Using gemini-1.5-flash as it is the current standard available flash model in most keys.
        // If user specifically has access to 2.5, they can swap it. 
        // Plan says 2.5, so we try that string, but fallback logic might be needed if it fails.
        // For now, sticking to the plan: "gemini-2.5-flash"
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Analyze this travel document.
            File Name: "${fileName}"
            File Type: "${fileType}"
            
            Extract the following information in JSON format:
            1. category: One of ['Transport', 'Accommodation', 'Identity', 'Finance', 'Other']
            2. title: A clean, descriptive title (e.g., "Flight to Bali", "Hotel Booking")
            3. date: A relevant date string (YYYY-MM-DD or readable text like "2 minutes ago" if unknown, but prefer real dates found in doc context or "Today")
            4. isBoardingPass: boolean
            5. eventDetails: (Optional, only if isBoardingPass is true)
               - type: 'Transport'
               - title: 'Flight ' + Airline + FlightNumber
               - time: Start Time (e.g. "10:00 AM")
               - endTime: Arrival Time (e.g. "01:00 PM")
               - description: "Seat: X, Gate: Y. From A to B."
               - duration: Estimated duration text
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse JSON from markdown code block if present
        const jsonBlock = text.match(/```json\n([\s\S]*?)\n```/);
        const parsedData = jsonBlock ? JSON.parse(jsonBlock[1]) : JSON.parse(text);

        console.log('Gemini Analysis:', parsedData);

        // 2. Save Document to Supabase DB
        const { data: docData, error: docError } = await supabase
            .from('documents')
            .insert({
                trip_id: tripId,
                title: parsedData.title || fileName,
                category: parsedData.category || 'Other',
                file_url: fileUrl,
                size: 'Unknown', // We could pass this from frontend
                mime_type: fileType
            })
            .select()
            .single();

        if (docError) throw docError;

        // 3. (Magic) Create Timeline Event if it's a Boarding Pass
        let newEvent = null;
        if (parsedData.isBoardingPass && parsedData.eventDetails) {
            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .insert({
                    trip_id: tripId,
                    type: 'Transport',
                    title: parsedData.eventDetails.title,
                    time: parsedData.eventDetails.time,
                    end_time: parsedData.eventDetails.endTime,
                    description: parsedData.eventDetails.description,
                    status: 'Scheduled',
                    day_offset: 0, // Default to day 0 or calculate from date
                    duration: parsedData.eventDetails.duration
                })
                .select()
                .single();
            newEvent = eventData;
        }

        return res.status(200).json({
            document: docData,
            event: newEvent,
            analysis: parsedData
        });

    } catch (error) {
        console.error('Error processing document:', error);
        return res.status(500).json({ error: error instanceof Error ? error.message : 'Processing failed' });
    }
}
