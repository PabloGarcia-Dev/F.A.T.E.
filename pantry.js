// example of a food OBJECT
// const standardFoodItem = {
  //id: "barcode-123456789",
  //name: "Organic Almond Milk",       // From Member 4 (API)
  //imageUrl: "https://...",            // From Member 4 (API)
  //ecoScore: "A",                      // From Member 4 (API)
  //expiryDate: "2026-07-25",          // From Member 1 (UI Form)
  //daysLeft: 14                       // Calculated by Member 2 (State)
//};
//


//Array that will hold food OBJECTS
let pantryItems =loadPantry();

//Creates Object
export function createFoodItem(apiData, expiryDate){
  return {
      id: apiData.id,   
      name: apiData.name,
      imageUrl: apiData.imageUrl,
      ecoScore: apiData.ecoScore,
      expiryDate: expiryDate
  };
}

export function addFoodItem(foodItem) {
  pantryItems.push(foodItem);
  savePantry();
}

//Uploads CURRENt pantry to local save
export function savePantry() {
  localStorage.setItem("pantryItems", JSON.stringify(pantryItems));
}

/* Load the pantry from the browser */
export function loadPantry() {
  const savedPantry = localStorage.getItem("pantryItems");

  return savedPantry ? JSON.parse(savedPantry) : [];
}

/* Return every pantry item */
export function listFoodItems() {
  return pantryItems;
}

/* Find one item by its ID/barcode */
export function getFoodItem(id) {
  return pantryItems.find((item) => item.id === id);
}

/* Update an existing food item */
export function updateFoodItem(id, updatedData) {
  const item = getFoodItem(id);

  if (!item) {
    return null;
  }

  Object.assign(item, updatedData);
  savePantry();

  return item;
}

/* Remove an item */
export function removeFoodItem(id) {
  const originalLength = pantryItems.length;

  pantryItems = pantryItems.filter((item) => item.id !== id);

  if (pantryItems.length === originalLength) {
    return false;
  }

  savePantry();
  return true;
}

/* Remove every pantry item */
export function clearPantry() {
  pantryItems = [];
  savePantry();
}