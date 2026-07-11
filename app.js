// Change from relative folder strings to local flat files
import { startScanner, stopScanner, submitManualBarcode } from "./scanner.js";
import { apiData } from "./foodApi.js";
import { getExpirationStatus, getExpirationMessage, getItemsSortedByExpiry } from "./metric.js";
import { loadPantry, savePantry } from "./pantry.js";

const outputText = document.querySelector("#barcode-result");
const pantryListContainer = document.querySelector("#pantry-list");

// Initialize application visual array states on runtime spin up
document.addEventListener("DOMContentLoaded", () => {
    renderPantryUI();

    // Hook entry listeners to the floating footer actions
    document.querySelector("#start-scan-button").addEventListener("click", () => {
        startScanner(handleProcessedBarcode);
    });

    document.querySelector("#close-scanner-button").addEventListener("click", stopScanner);

    document.querySelector("#manual-barcode-button").addEventListener("click", () => {
        submitManualBarcode(handleProcessedBarcode);
    });

    document.querySelector("#manual-barcode-input").addEventListener("keydown", (event) => {
        if (event.key === "Enter") submitManualBarcode(handleProcessedBarcode);
    });
});

// Central callback handling ingestions across both input points
async function handleProcessedBarcode(barcode) {
    console.log("Processing Ingestion Target:", barcode);
    outputText.textContent = `Scanned Target: ${barcode}`;

    // Query teammate's live fetch engine
    let dataPayload = await apiData(barcode);

    // Fallback dictionary mock object safe-guard for venue validation
    if (!dataPayload) {
        dataPayload = getDemoFallback(barcode);
    }

    const ISOStringToday = new Date().toISOString().split('T')[0];
    const userSelectedExpiry = prompt(`Scanned: ${dataPayload.name}\nEnter Expiration Date (YYYY-MM-DD), or leave blank for no expiration date:`, ISOStringToday);

    // Only a real Cancel should abandon the scan; a blank field just means "no expiration date"
    if (userSelectedExpiry === null) {
        return;
    }

    const trimmedExpiry = userSelectedExpiry.trim();

    const itemRecord = {
        id: 'item_' + Date.now() + '_' + barcode,
        barcode: barcode,
        name: dataPayload.name,
        imageUrl: dataPayload.imageUrl,
        ecoScore: dataPayload.ecoScore,
        ingredients: dataPayload.ingredients || 'No ingredient data available',
        allergens: dataPayload.allergens || 'No allergen data available',
        expiryDate: trimmedExpiry === '' ? null : trimmedExpiry
    };

    // Access team array storage routines
    let activeItems = loadPantry();
    activeItems.push(itemRecord);
    localStorage.setItem("pantryItems", JSON.stringify(activeItems));

    // Sync view mapping updates
    renderPantryUI();
}

function renderPantryUI() {
    pantryListContainer.innerHTML = '';
    const currentInventory = loadPantry();

    if (currentInventory.length === 0) {
        pantryListContainer.innerHTML = `<div class="pantry-placeholder">No items scanned yet. Ready to reduce waste?</div>`;
        return;
    }

    const chronologicallySorted = getItemsSortedByExpiry(currentInventory);

    chronologicallySorted.forEach(item => {
        const cardElement = document.createElement('div');
        cardElement.className = 'food-card';
        
        const statusUrgency = getExpirationStatus(item.expiryDate);
        const dynamicCountdownMsg = getExpirationMessage(item.expiryDate);
        const uppercaseEcoGrading = (item.ecoScore || 'unknown').toUpperCase();

        if (statusUrgency === 'critical' || statusUrgency === 'expired') {
            cardElement.style.borderLeftColor = 'crimson';
        } else if (statusUrgency === 'warning') {
            cardElement.style.borderLeftColor = 'orange';
        } else if (statusUrgency === 'attention') {
            cardElement.style.borderLeftColor = 'gold';
        }

        const dateBlocks = item.expiryDate ? item.expiryDate.split('-') : null;
        const visualFormattedDisplay = dateBlocks && dateBlocks.length === 3 ? `${dateBlocks[1]}/${dateBlocks[2]}/${dateBlocks[0].slice(-2)}` : item.expiryDate;

        const expiryLine = item.expiryDate
            ? `Expires: ${visualFormattedDisplay} (${dynamicCountdownMsg})`
            : dynamicCountdownMsg;

        const ingredientsText = escapeHtml(item.ingredients || 'No ingredient data available');
        const allergensText = escapeHtml(item.allergens || 'No allergen data available');

        cardElement.innerHTML = `
            <button class="delete-item-button" type="button" aria-label="Remove ${escapeHtml(item.name)} from pantry">&times;</button>
            <div class="food-card-summary">
                <img src="${item.imageUrl}" alt="${item.name}" onerror="this.src='https://placehold.co/100x100?text=Food'">
                <div class="food-info">
                    <div class="food-title">${escapeHtml(item.name)}</div>
                    <div class="food-expiry">${expiryLine}</div>
                </div>
                <span class="eco-badge">Eco: ${uppercaseEcoGrading}</span>
            </div>
            <div class="food-details">
                <p><strong>Ingredients:</strong> ${ingredientsText}</p>
                <p><strong>Allergens:</strong> ${allergensText}</p>
            </div>
        `;

        // Toggle the expanded detail view whenever the card itself is clicked
        cardElement.addEventListener('click', () => {
            cardElement.classList.toggle('expanded');
        });

        // Deleting an item shouldn't also toggle the expanded view underneath it
        cardElement.querySelector('.delete-item-button').addEventListener('click', (event) => {
            event.stopPropagation();
            handleDeleteItem(item.id, item.name);
        });

        pantryListContainer.appendChild(cardElement);
    });
}

// Removes a single pantry item by id and refreshes the list
function handleDeleteItem(itemId, itemName) {
    const confirmed = confirm(`Remove ${itemName} from your pantry?`);

    if (!confirmed) return;

    const remainingItems = loadPantry().filter(item => item.id !== itemId);
    localStorage.setItem("pantryItems", JSON.stringify(remainingItems));

    renderPantryUI();
}

// Escapes text pulled from external API responses before it's inserted via innerHTML
function escapeHtml(rawText) {
    const div = document.createElement('div');
    div.textContent = rawText;
    return div.innerHTML;
}

function getDemoFallback(barcode) {
    const PRESENTATION_CHEAT_SHEET = {
        "012000000133": { name: "Diet Pepsi Can", ecoScore: "d", imageUrl: "https://images.openfoodfacts.org/images/products/001/200/000/0133/front_en.142.400.jpg", ingredients: "Carbonated water, caramel color, aspartame, phosphoric acid, potassium benzoate, caffeine, natural flavor, citric acid.", allergens: "None listed" },
        "041500000251": { name: "Heinz Tomato Ketchup", ecoScore: "b", imageUrl: "https://images.openfoodfacts.org/images/products/004/150/000/0251/front_en.67.400.jpg", ingredients: "Tomato concentrate, distilled vinegar, high fructose corn syrup, salt, spice, onion powder, natural flavoring.", allergens: "None listed" },
        "078742371946": { name: "Organic Whole Milk", ecoScore: "c", imageUrl: "https://images.openfoodfacts.org/images/products/007/874/237/1946/front_en.45.400.jpg", ingredients: "Grade A organic whole milk, vitamin D3.", allergens: "Milk" }
    };
    return PRESENTATION_CHEAT_SHEET[barcode] || { 
        name: `Eco Item #${barcode.slice(-4)}`, 
        ecoScore: "a", 
        imageUrl: "https://placehold.co/100x100?text=Eco+Food",
        ingredients: "No ingredient data available for this demo item.",
        allergens: "No allergen data available for this demo item."
    };
}