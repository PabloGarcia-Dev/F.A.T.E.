async function apiData(barcode){
    try
    {
        const foodresponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);

        const foodData = await foodresponse.json();


        if (!foodData || foodData.status !== 1 || !foodData.product) 
        {
            throw new Error('Invalid barcode or product not found');
        }

        return {
            name: foodData.product.product_name || 'Unknown Product',
            ingredients: foodData.product.ingredients_text || 'No ingredients available',
            imageUrl: foodData.product.image_front_url || 'No image available',
            ecoScore: foodData.product.ecoscore_grade || 'unknown',
            allergens: foodData.product.allergens || 'No allergens available',
            nutrition: foodData.product.nutriments || 'No nutrition information available'
    };

    } catch (error) {
        console.error('Error fetching food data:', error);
        return null;
    }

}