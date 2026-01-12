
async function test() {
    try {
        console.log("Fetching...");
        // Museum MACAN coords approximately
        const res = await fetch('http://localhost:3000/api/parse-place', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://www.google.com/maps/@-6.1907,106.7712,19z' })
        });
        const data = await res.json();
        console.log("Result for Museum MACAN:");
        console.log("Price Level:", data.priceLevel);
        console.log("Editorial Summary:", data.editorialSummary);
        console.log("Name:", data.name);
    } catch (e) {
        console.error(e);
    }
}
test();
