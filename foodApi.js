
// Function to fetch food data from Open Food Facts API based on barcode
async function apiData(barcode){
    try
    {
        // Fetch product data from Open Food Facts API
        const foodresponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);

        // Check if the response is successful
        const foodData = await foodresponse.json();


        // Checks for valid product data and throws an error if not found
        if (!foodData || foodData.status !== 1 || !foodData.product) 
        {
            throw new Error('Invalid barcode or product not found');
        }

        // Return the relevant product data
        return {
            name: foodData.product.product_name || 'Unknown Product',
            ingredients: foodData.product.ingredients_text || 'No ingredients available',
            imageUrl: foodData.product.image_front_url || 'No image available',
            ecoScore: foodData.product.ecoscore_grade || 'unknown',
            allergens: foodData.product.allergens || 'No allergens available',
            nutrition: foodData.product.nutriments || 'No nutrition information available'
    };

    // Catch any errors that may occur during the fetch or data processing
    } catch (error) {
        console.error('Error fetching food data:', error);
        return null;
    }

}