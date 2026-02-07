export async function searchShoppingPrices(query: string) {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
        console.warn('SERPER_API_KEY is not set. Returning mock results for demonstration.');
        return [
            {
                title: `${query} - Tienda A`,
                price: "$100.00",
                source: "Tienda de Ejemplo A",
                link: "https://example.com/a",
                thumbnail: "https://via.placeholder.com/100"
            },
            {
                title: `${query} - Tienda B`,
                price: "$110.00",
                source: "Tienda de Ejemplo B",
                link: "https://example.com/b",
                thumbnail: "https://via.placeholder.com/100"
            }
        ];
    }

    try {
        const response = await fetch('https://google.serper.dev/shopping', {
            method: 'POST',
            headers: {
                'X-API-KEY': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: query, gl: 'mx', hl: 'es' })
        });

        const data = await response.json();
        return data.shopping || [];
    } catch (error) {
        console.error('Serper API Error:', error);
        return [];
    }
}
