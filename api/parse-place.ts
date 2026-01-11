// Google Places API (New) - Parse Place from URL
// Edge Function for better Vercel detection

export const config = {
    runtime: 'edge',
};

// Extract place info from Google Maps URL
function extractFromUrl(url: string): { query?: string; placeId?: string; coords?: { lat: number; lng: number } } {
    const result: { query?: string; placeId?: string; coords?: { lat: number; lng: number } } = {};

    try {
        // Extract place name from /place/Name/ path
        const placeMatch = url.match(/\/place\/([^/@]+)/);
        if (placeMatch) {
            result.query = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
        }

        // Extract coordinates from @lat,lng pattern
        const coordsMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordsMatch) {
            result.coords = {
                lat: parseFloat(coordsMatch[1]),
                lng: parseFloat(coordsMatch[2])
            };
        }

        // Extract place ID from data parameter
        const placeIdMatch = url.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+|ChIJ[A-Za-z0-9_-]+)/i);
        if (placeIdMatch) {
            result.placeId = placeIdMatch[1];
        }

        // Try q param
        const urlObj = new URL(url);
        const qParam = urlObj.searchParams.get('q');
        if (qParam && !result.query) {
            result.query = qParam;
        }
    } catch (e) {
        console.log('Error parsing URL:', e);
    }

    return result;
}

export default async function handler(request: Request) {
    // Handle CORS preflight
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

    const { url } = body;

    if (!url || typeof url !== 'string') {
        return new Response(JSON.stringify({ error: 'Google Maps URL is required' }), {
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
        let expandedUrl = url;

        // Handle short URLs by following redirects
        if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
            try {
                const response = await fetch(url, {
                    method: 'HEAD',
                    redirect: 'follow'
                });
                expandedUrl = response.url;
            } catch (e) {
                console.log('Could not expand short URL:', e);
            }
        }

        const extracted = extractFromUrl(expandedUrl);

        if (!extracted.query && !extracted.placeId) {
            return new Response(JSON.stringify({
                error: 'Could not extract place info from URL',
                hint: 'Please use a full Google Maps URL, not a shortened link'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }

        // If we have a query, use Text Search to find place details
        if (extracted.query) {
            const searchBody: Record<string, unknown> = {
                textQuery: extracted.query
            };

            if (extracted.coords) {
                searchBody.locationBias = {
                    circle: {
                        center: {
                            latitude: extracted.coords.lat,
                            longitude: extracted.coords.lng
                        },
                        radius: 500
                    }
                };
            }

            const searchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.photos,places.regularOpeningHours,places.googleMapsUri,places.reviews'
                },
                body: JSON.stringify(searchBody)
            });

            if (searchResponse.ok) {
                const searchData = await searchResponse.json();

                if (searchData.places && searchData.places.length > 0) {
                    const place = searchData.places[0];

                    // Build photo URLs
                    const photoUrls = place.photos?.slice(0, 5).map((photo: { name: string }) =>
                        `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${apiKey}`
                    ) || [];

                    const result = {
                        name: place.displayName?.text || extracted.query,
                        address: place.formattedAddress || '',
                        rating: place.rating,
                        reviewCount: place.userRatingCount,
                        placeId: place.id,
                        types: place.types,
                        photos: photoUrls,
                        openingHours: place.regularOpeningHours?.weekdayDescriptions,
                        isOpen: place.regularOpeningHours?.openNow,
                        googleMapsUrl: place.googleMapsUri || url,
                        reviews: place.reviews?.slice(0, 3),
                        source: 'google_places'
                    };

                    return new Response(JSON.stringify(result), {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                    });
                }
            }
        }

        // Fallback: return extracted data
        return new Response(JSON.stringify({
            name: extracted.query || 'Unknown Place',
            address: extracted.coords ? `${extracted.coords.lat}, ${extracted.coords.lng}` : 'See Google Maps',
            googleMapsUrl: url,
            source: 'url_parsing'
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
        });

    } catch (error) {
        console.error('Parse place error:', error);
        return new Response(JSON.stringify({
            error: 'Failed to parse place',
            message: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
