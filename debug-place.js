
const apiKey = process.env.GOOGLE_PLACES_API_KEY;

async function fetchPlace() {
    console.log("Fetching Museum MACAN...");
    // First search to get ID
    const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.priceLevel,places.editorialSummary'
        },
        body: JSON.stringify({ textQuery: "Museum MACAN" })
    });

    const searchData = await searchRes.json();
    if (!searchData.places || searchData.places.length === 0) {
        console.log("No places found");
        return;
    }

    const place = searchData.places[0];
    console.log("Place found:", place.displayName.text);
    console.log("ID:", place.id);
    console.log("Price Level:", place.priceLevel);
    console.log("Editorial Summary:", place.editorialSummary);


    // Now try fetching details directly to be sure (as app does)
    const detailsUrl = `https://places.googleapis.com/v1/places/${place.id}`;
    const detailsRes = await fetch(detailsUrl, {
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'priceLevel,editorialSummary'
        }
    });
    const detailsData = await detailsRes.json();
    console.log("--- Details Endpoint ---");
    console.log("Price Level:", detailsData.priceLevel);
    console.log("Editorial Summary:", detailsData.editorialSummary);
}

fetchPlace().catch(console.error);
