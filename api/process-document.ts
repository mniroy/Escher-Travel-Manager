
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

    const { fileUrl, tripId, fileName, fileType, category: userCategory = 'Other' } = req.body;

    if (!fileUrl || !tripId) {
        return res.status(400).json({ error: 'Missing fileUrl or tripId' });
    }

    try {
        console.log('Processing document with Gemini 2.5:', fileName, 'Type:', fileType);

        let finalTitle = fileName;
        let finalCategory = userCategory;
        let extractedEvent: any = null;
        let metadata: any = null;

        try {
            // 1. Fetch the file content
            const fileRes = await fetch(fileUrl);
            if (!fileRes.ok) throw new Error('Failed to fetch file from storage');
            const blob = await fileRes.blob();
            const buffer = await blob.arrayBuffer();
            const base64Data = Buffer.from(buffer).toString('base64');

            // 2. Analyze with Gemini
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const prompt = `Analyze this travel document. 
            - Categorize it as one of: 'Transport', 'Accommodation', 'Activity', 'Identity', 'Note', 'Finance', 'Other'.
            - Provide a concise, highly readable, and professional title.
            
            Determine the type and extract specific details:

            1. **Flight** (Boarding Pass/Booking):
                - bookingCode, passengers
                - flights array: origin (code/city), destination (code/city), date, departureTime, arrivalTime, flightNumber, duration, departureTimeZone (INFER from Origin City/Airport if not explicit, e.g. UTC+7), arrivalTimeZone (INFER from Destination City/Airport)

            2. **Accommodation** (Hotel/Airbnb):
                - hotelName, address, bookingReference
                - checkInDate, checkInTime, checkOutDate, checkOutTime
                - roomType, guestName

            3. **Ground Transport** (Train, Bus, Ferry - NOT Flight):
                - type (Train, Bus, Ferry), provider (e.g. Eurostar, JR)
                - origin, destination, date
                - departureTime, arrivalTime, duration
                - bookingReference, seat, carNumber, class (e.g. First, Economy)

            4. **Activity** (Museum, Park, Concert, Tour):
                - eventName, venue, date, time
                - ticketCount, ticketType (e.g. Adult, VIP)
                - seat (if applicable)

            5. **Note/Guide/Info**:
                - summary (brief overview)
                - keyPoints (array of strings for specific rules, gate info, or directions)

            Return ONLY a valid JSON object with these keys (fill only the relevant details object, null others):
            {
              "category": "Transport" | "Accommodation" | "Activity" | "Identity" | "Note" | "Finance" | "Other",
              "title": "Concise File Name",
              "flightDetails": { 
                "bookingCode": "...", 
                "passengers": ["..."], 
                "flights": [{ 
                    "originCode": "...", "originCity": "...", 
                    "destinationCode": "...", "destinationCity": "...", 
                    "date": "YYYY-MM-DD", 
                    "departureTime": "HH:MM", "departureTimeZone": "...", 
                    "arrivalTime": "HH:MM", "arrivalTimeTimeZone": "...", 
                    "flightNumber": "...", "duration": "..." 
                }] 
              } | null,
              "accommodationDetails": {
                "hotelName": "...", "address": "...", "bookingReference": "...",
                "checkInDate": "...", "checkInTime": "...", "checkOutDate": "...", "checkOutTime": "...",
                "roomType": "...", "guestName": "..."
              } | null,
              "transportDetails": {
                "type": "Train" | "Bus", "provider": "...", "origin": "...", "destination": "...",
                "date": "...", "departureTime": "...", "arrivalTime": "...", "duration": "...",
                "bookingReference": "...", "seat": "...", "carNumber": "...", "class": "..."
              } | null,
              "activityDetails": {
                "eventName": "...", "venue": "...", "date": "...", "time": "...",
                "ticketCount": "...", "ticketType": "...", "seat": "..."
              } | null,
              "noteDetails": {
                "summary": "...", "keyPoints": ["...", "..."]
              } | null,
              "extractedEvent": {
                "title": "Title", "type": "Transport"| "Stay"| "Eat"| "Play", "time": "...", 
                "duration": "...", "description": "...", "address": "...", "day_offset": 0
              } | null
            }`;

            const result = await model.generateContent([
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: fileType
                    }
                },
                prompt
            ]);

            const response = await result.response;
            const text = response.text();

            // Extract JSON from response (handling potential markdown blocks)
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const aiData = JSON.parse(jsonMatch[0]);
                if (aiData.title) finalTitle = aiData.title;
                if (aiData.category) finalCategory = aiData.category;
                if (aiData.extractedEvent) extractedEvent = aiData.extractedEvent;

                // Store everything in metadata
                metadata = {
                    ...aiData.extractedEvent,
                    flightDetails: aiData.flightDetails,
                    accommodationDetails: aiData.accommodationDetails,
                    transportDetails: aiData.transportDetails,
                    activityDetails: aiData.activityDetails,
                    noteDetails: aiData.noteDetails
                };
            }

            console.log('Gemini Analysis Result:', { finalTitle, finalCategory, hasFlight: !!metadata?.flightDetails });

        } catch (aiError) {
            console.error('Gemini Analysis failed, falling back to defaults:', aiError);
        }

        // --- NEW: Rename the file in storage for human readability ---
        let currentFileUrl = fileUrl;
        try {
            const ext = fileName.split('.').pop();
            const sanitizedTitle = finalTitle.replace(/[^a-zA-Z0-9]/g, '_');
            const newFileName = `${tripId}/${Date.now()}_${sanitizedTitle}.${ext}`;

            // Get original path from URL
            const urlPath = fileUrl.split('/storage/v1/object/public/trip_docs/')[1];

            if (urlPath) {
                console.log('Renaming file in storage from:', urlPath, 'to:', newFileName);
                const { error: moveError } = await supabase.storage
                    .from('trip_docs')
                    .move(urlPath, newFileName);

                if (!moveError) {
                    // Small delay to prevent race conditions in dev environment
                    await new Promise(resolve => setTimeout(resolve, 200));

                    const { data: { publicUrl } } = supabase.storage
                        .from('trip_docs')
                        .getPublicUrl(newFileName);
                    currentFileUrl = publicUrl;
                } else {
                    console.error('Failed to rename file:', moveError);
                }
            }
        } catch (renameError) {
            console.error('File renaming failed:', renameError);
        }

        // 3. Save Document to Supabase DB
        const { data: docData, error: docError } = await supabase
            .from('documents')
            .insert({
                trip_id: tripId,
                title: finalTitle,
                category: finalCategory,
                file_url: currentFileUrl,
                size: 'Unknown',
                mime_type: fileType,
                metadata: metadata
            })
            .select()
            .single();

        if (docError) throw docError;

        // 4. If AI extracted an event, save it to the events table
        let createdEvent = null;
        if (extractedEvent && extractedEvent.title) {
            console.log('Automatically creating itinerary card for:', extractedEvent.title);
            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .insert({
                    trip_id: tripId,
                    title: extractedEvent.title,
                    type: extractedEvent.type || (finalCategory === 'Accommodation' ? 'Stay' : 'Transport'),
                    time: extractedEvent.time || '12:00 PM',
                    duration: extractedEvent.duration || '1h',
                    description: extractedEvent.description || '',
                    address: extractedEvent.address || '',
                    day_offset: extractedEvent.day_offset || 0,
                    status: 'Scheduled',
                    sort_order: 999 // Put at end of day by default
                })
                .select()
                .single();

            if (!eventError) createdEvent = eventData;
            else console.error('Failed to auto-create event:', eventError);
        }

        return res.status(200).json({
            document: docData,
            event: createdEvent,
            analysis: {
                title: finalTitle,
                category: finalCategory,
                autoCreatedEvent: !!createdEvent
            }
        });

    } catch (error) {
        console.error('Error processing document:', error);
        return res.status(500).json({
            error: 'Processing failed',
            details: error instanceof Error ? error.message : String(error)
        });
    }
}
