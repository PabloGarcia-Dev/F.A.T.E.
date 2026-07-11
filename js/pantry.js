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
let pantryItems =[];

//Creates Object
function createFoodItem(apiData, expiryDate){
  return {
    id: apiData.id,   
      name: apiData.name,
      imageUrl: apiData.imageUrl,
      ecoScore: apiData.ecoScore,
      expiryDate: expiryDate
  };
}

function addFoodItem(foodItem) {
  pantryItems.push(foodItem);
  savePantry();
}

//Uploads CURRENt pantry to local save
function savePantry() {
  localStorage.setItem("pantryItems", JSON.stringify(pantryItems));
}


