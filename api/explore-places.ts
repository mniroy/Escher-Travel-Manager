
export const config = {
    runtime: 'edge',
};

export default async function handler(request: Request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const { query } = body;

    if (!query || typeof query !== 'string') {
        return new Response(JSON.stringify({ error: 'Search query is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
        return new Response(JSON.stringify({
            error: 'Google Places API key not configured',
            hint: 'Set GOOGLE_PLACES_API_KEY in Vercel environment variables'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const searchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.photos,places.regularOpeningHours,places.googleMapsUri,places.reviews,places.location,places.websiteUri,places.priceLevel,places.editorialSummary'
            },
            body: JSON.stringify({
                textQuery: query,
                // Requesting 20 results (max per page)
                pageSize: 20
            })
        });

        if (!searchResponse.ok) {
            const errorText = await searchResponse.text();
            throw new Error(`Google Places API error: ${searchResponse.status} ${errorText}`);
        }

        const searchData = await searchResponse.json();

        // Helper to format place data
        const formatPlace = (place: any) => {
            // Build photo URLs
            const photoUrls = place.photos?.slice(0, 5).map((photo: { name: string }) =>
                `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=400&maxHeightPx=400&key=${apiKey}`
            ) || [];

            return {
                name: place.displayName?.text,
                address: place.formattedAddress,
                rating: place.rating,
                userRatingCount: place.userRatingCount,
                placeId: place.id,
                types: place.types,
                photos: photoUrls,
                openingHours: place.regularOpeningHours?.weekdayDescriptions,
                isOpen: place.regularOpeningHours?.openNow,
                googleMapsUrl: place.googleMapsUri,
                reviews: place.reviews,
                location: place.location,
                websiteUri: place.websiteUri,
                priceLevel: place.priceLevel,
                editorialSummary: place.editorialSummary?.text
            };
        };

        const places = (searchData.places || []).map(formatPlace);

        // Sort by rating and userRatingCount as requested
        // "return 10 recommended places based on top rating and number of rating"
        // Google TextSearch already ranks well, but we can enforce sorting if needed. 
        // For now, let's keep Google's ranking but maybe filter out low rated ones if needed?
        // User asked: "based on top rating and number of rating". 
        // A simple sort: (rating * log(count)) descending could balance it, or just trust Google returning 'relevance'
        // Let's sort by rating primarily

        places.sort((a: any, b: any) => {
            const scoreA = (a.rating || 0) * (a.userRatingCount || 0);
            const scoreB = (b.rating || 0) * (b.userRatingCount || 0);
            return scoreB - scoreA;
        });

        return new Response(JSON.stringify({ places: places }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
        });

    } catch (error) {
        console.error('Explore places error:', error);
        return new Response(JSON.stringify({
            error: 'Failed to explore places',
            message: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
