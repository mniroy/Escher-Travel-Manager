import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { items, preserveOrder = false } = req.body;

    if (!items || !Array.isArray(items) || items.length < 2) {
        return res.status(400).json({ error: 'At least 2 items are required to optimize a route.' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    console.log('[DEBUG] GOOGLE_MAPS_API_KEY exists:', !!apiKey, 'Length:', apiKey?.length);
    if (!apiKey) {
        return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
    }

    // Debug: Log received items
    console.log('[DEBUG] Received items:', JSON.stringify(items.map((i: any) => ({
        title: i.title,
        placeId: i.placeId,
        place_id: i.place_id, // Check snake_case too
        lat: i.lat,
        lng: i.lng
    })), null, 2));

    try {
        // Construct Payload for Google Routes API
        // https://developers.google.com/maps/documentation/routes/compute_routes_reference

        const origin = items[0];
        const destination = items[items.length - 1]; // Keep start and end fixed? 
        // User usually wants to start at A and end at B?
        // Or Start at A, optimize B, C, D, E... ?
        // If the user presses "Optimize", usually they want the most efficient path VISITING all selected nodes.
        // If the list is: Hotel -> Beach -> Dinner -> Club -> Hotel.
        // We probably want to keep Origin (Hotel) and Destination (Hotel) fixed, and shuffle intermediates.

        // Let's assume the first item is FIXED (Origin). 
        // The rest are intermediates to be optimized.
        // The last item: If it's the same as first (round trip), it's fixed destination.
        // If it's different, do we optimize it too?
        // Google Routes API 'optimizeWaypointOrder' optimizes the `intermediates`.
        // Origin and Destination are fixed points.

        // STRATEGY: 
        // Origin = Item[0]
        // Destination = Item[last]
        // Intermediates = Item[1... last-1]

        // If only 2 items, nothing to optimize.

        // Build waypoint with correct structure for Google Routes API
        // Structure: { location: { latLng: {...} } } OR { placeId: "..." }
        const buildWaypoint = (item: any) => {
            if (item.placeId) {
                return { placeId: item.placeId };
            }
            if (item.lat && item.lng) {
                return {
                    location: {
                        latLng: {
                            latitude: item.lat,
                            longitude: item.lng
                        }
                    }
                };
            }
            return null;
        };

        const intermediates = items.slice(1, items.length - 1)
            .map(buildWaypoint)
            .filter(Boolean);

        const originLoc = buildWaypoint(origin);
        const destLoc = buildWaypoint(destination);

        if (!originLoc || !destLoc) {
            return res.status(400).json({ error: 'Origin and destination must have placeId or coordinates' });
        }

        const response = await fetch(`https://routes.googleapis.com/directions/v2:computeRoutes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex,routes.legs.duration,routes.legs.staticDuration,routes.legs.distanceMeters'
            },
            body: JSON.stringify({
                origin: originLoc,
                destination: destLoc,
                intermediates: intermediates,
                travelMode: 'DRIVE', // Configurable? Default to DRIVE for now.
                routingPreference: 'TRAFFIC_AWARE',
                optimizeWaypointOrder: !preserveOrder,
                departureTime: new Date().toISOString(),
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google Routes API Error:', errorText);
            return res.status(response.status).json({ error: 'Failed to calculate route', details: errorText });
        }

        const data = await response.json();
        console.log('[DEBUG] Google Routes API response:', JSON.stringify(data, null, 2));

        // The API returns 'routes' array.
        // routes[0].optimizedIntermediateWaypointIndex: [0, 2, 1...] indices into the `intermediates` array provided.
        // routes[0].legs: Array of legs. Leg 0 = Origin -> 1st Waypoint.

        return res.status(200).json(data);

    } catch (error) {
        console.error('Optimize Route Exception:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
