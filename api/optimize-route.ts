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
            // Validate Place ID: Must exist and not be a placeholder
            const hasValidPlaceId = item.placeId &&
                item.placeId !== 'unknown' &&
                !String(item.placeId).startsWith('link-');

            if (hasValidPlaceId) {
                return { placeId: item.placeId };
            }

            // Fallback to coordinates if Place ID is missing or invalid
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

        // Map pool to waypoints, keep track of indices to detect failures
        const validIntermediates = pool.map((item, index) => ({
            waypoint: buildWaypoint(item),
            index: index,
            title: item.title
        }));

        const invalidItems = validIntermediates.filter(x => !x.waypoint);

        if (invalidItems.length > 0) {
            console.error('[DEBUG] Invalid items for optimization:', JSON.stringify(invalidItems.map(x => x.title)));
            // We cannot optimize if we drop items, as indices will mismatch.
            // Return 400 so the client knows why it failed.
            return res.status(400).json({
                error: 'Some items map to invalid locations.',
                details: `Cannot optimize route. The following items strictly lack location data (Place ID or Coordinates): ${invalidItems.map(x => x.title).join(', ')}`
            });
        }

        const intermediates = validIntermediates.map(x => x.waypoint);

        const originLoc = buildWaypoint(origin);
        const destLoc = buildWaypoint(destination);

        if (!originLoc) {
            return res.status(400).json({ error: `Origin location invalid: ${origin.title}` });
        }
        if (!destLoc) {
            return res.status(400).json({ error: `Destination location invalid: ${destination.title}` });
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

        // Log basic success/failure signals instead of full object to avoid IO crashes
        console.log(`[DEBUG] Google Routes API Status: ${response.status}. Routes found: ${data.routes ? data.routes.length : 0}`);

        if (!data.routes || data.routes.length === 0) {
            console.warn('[DEBUG] No accessible routes found. Likely impossible drive (island hopping without broken-out ferry steps).');
            return res.status(422).json({
                error: 'No route found.',
                details: 'Google Maps could not find a driving route. You may be trying to connect locations separated by water (e.g. Bali to Nusa Penida/Lembongan) that require a ferry. Please split your trip or manage these legs manually.'
            });
        }

        // The API returns 'routes' array.
        // routes[0].optimizedIntermediateWaypointIndex: [0, 2, 1...] indices into the `intermediates` array provided.
        // routes[0].legs: Array of legs. Leg 0 = Origin -> 1st Waypoint.

        return res.status(200).json(data);

    } catch (error) {
        console.error('Optimize Route Exception:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
