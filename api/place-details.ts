import type { VercelRequest, VercelResponse } from '@vercel/node';

// Google Places API (New) - Place Details Endpoint
// Uses the new v1 API: https://places.googleapis.com/v1/places/{placeId}

interface PlaceDetails {
    name: string;
    displayName: string;
    formattedAddress: string;
    rating?: number;
    userRatingCount?: number;
    placeId: string;
    types?: string[];
    photos?: { name: string; widthPx: number; heightPx: number }[];
    regularOpeningHours?: {
        weekdayDescriptions: string[];
        openNow: boolean;
    };
    websiteUri?: string;
    nationalPhoneNumber?: string;
    priceLevel?: string;
    location?: { latitude: number; longitude: number };
    googleMapsUri?: string;
    reviews?: {
        name: string;
        rating: number;
        text: { text: string };
        authorAttribution: { displayName: string; photoUri: string };
        relativePublishTimeDescription: string;
    }[];
    editorialSummary?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { placeId } = req.query;

    if (!placeId || typeof placeId !== 'string') {
        return res.status(400).json({ error: 'Place ID is required' });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: 'Google Places API key not configured',
            hint: 'Set GOOGLE_PLACES_API_KEY in Vercel environment variables'
        });
    }

    try {
        // Use the new Places API (v1) endpoint
        const url = `https://places.googleapis.com/v1/places/${placeId}`;

        // Field mask to specify which fields we want
        const fieldMask = [
            'id',
            'displayName',
            'formattedAddress',
            'rating',
            'userRatingCount',
            'types',
            'photos',
            'regularOpeningHours',
            'websiteUri',
            'nationalPhoneNumber',
            'priceLevel',
            'location',
            'googleMapsUri',
            'reviews',
            'editorialSummary'
        ].join(',');

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': fieldMask
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google Places API error:', response.status, errorText);
            return res.status(response.status).json({
                error: 'Failed to fetch place details',
                status: response.status,
                details: errorText
            });
        }

        const data = await response.json();

        // Transform photo references to URLs
        const photoUrls = data.photos?.slice(0, 5).map((photo: { name: string }) => {
            // Photo URL format for new API
            return `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${apiKey}`;
        }) || [];

        const result: PlaceDetails = {
            name: data.id,
            displayName: data.displayName?.text || 'Unknown Place',
            formattedAddress: data.formattedAddress || '',
            rating: data.rating,
            userRatingCount: data.userRatingCount,
            placeId: placeId,
            types: data.types,
            photos: data.photos,
            regularOpeningHours: data.regularOpeningHours,
            websiteUri: data.websiteUri,
            nationalPhoneNumber: data.nationalPhoneNumber,
            priceLevel: data.priceLevel,
            location: data.location,
            googleMapsUri: data.googleMapsUri,
            reviews: data.reviews,
            editorialSummary: data.editorialSummary?.text
        };

        // Add photo URLs for easy access
        return res.status(200).json({
            ...result,
            photoUrls
        });

    } catch (error) {
        console.error('Place details error:', error);
        return res.status(500).json({
            error: 'Failed to fetch place details',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
