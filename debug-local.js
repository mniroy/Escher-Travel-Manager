
async function test() {
    try {
        console.log("Fetching...");
        const res = await fetch('http://localhost:3000/api/parse-place', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://www.google.com/maps/search/Museum+MACAN' })
        });
        const data = await res.json();
        console.log("Result for Museum MACAN:");
        console.log("Price Level:", data.priceLevel);
        console.log("Editorial Summary:", data.editorialSummary);
        console.log("Full Data:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
