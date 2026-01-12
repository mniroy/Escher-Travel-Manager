import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { items, preserveOrder = false, fixEnd = false } = req.body;

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

        let origin, destination, pool;

        if (fixEnd) {
            // Linear Optimization: Start -> [Pool] -> End
            // Origin = First item
            // Destination = Last item
            // Pool = Middle items (everything else)
            origin = items[0];
            destination = items[items.length - 1];
            pool = items.slice(1, -1);
            console.log('[DEBUG] Optimization Mode: LINEAR (Fixed Start & End)');
        } else {
            // Loop Optimization: Start -> [Pool] -> Start
            // Origin = First item
            // Destination = First item (Loop back)
            // Pool = All items except first
            origin = items[0];
            destination = items[0];
            pool = items.slice(1);
            console.log('[DEBUG] Optimization Mode: LOOP (Round Trip)');
        }

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

        const intermediates = pool
            .map(buildWaypoint)
            .filter(Boolean);

        const originLoc = buildWaypoint(origin);
        // Destination is same as origin
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
                // Google Routes API requires departureTime to be in the future for TRAFFIC_AWARE.
                // We add a 5-minute buffer to account for any server clock drift.
                departureTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
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
