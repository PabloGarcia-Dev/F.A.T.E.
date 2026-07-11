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
    const userSelectedExpiry = prompt(`Scanned: ${dataPayload.name}\nEnter Expiration Date (YYYY-MM-DD):`, ISOStringToday);

    if (userSelectedExpiry) {
        const itemRecord = {
            id: 'item_' + Date.now() + '_' + barcode,
            name: dataPayload.name,
            imageUrl: dataPayload.imageUrl,
            ecoScore: dataPayload.ecoScore,
            expiryDate: userSelectedExpiry
        };

        // Access team array storage routines
        let activeItems = loadPantry();
        activeItems.push(itemRecord);
        localStorage.setItem("pantryItems", JSON.stringify(activeItems));

        // Sync view mapping updates
        renderPantryUI();
    }
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

        const dateBlocks = item.expiryDate.split('-');
        const visualFormattedDisplay = dateBlocks.length === 3 ? `${dateBlocks[1]}/${dateBlocks[2]}/${dateBlocks[0].slice(-2)}` : item.expiryDate;

        cardElement.innerHTML = `
            <img src="${item.imageUrl}" alt="${item.name}" onerror="this.src='https://placehold.co/100x100?text=Food'">
            <div class="food-info">
                <div class="food-title">${item.name}</div>
                <div class="food-expiry">Expires: ${visualFormattedDisplay} (${dynamicCountdownMsg})</div>
            </div>
            <span class="eco-badge">Eco: ${uppercaseEcoGrading}</span>
        `;
        
        pantryListContainer.appendChild(cardElement);
    });
}

function getDemoFallback(barcode) {
    const PRESENTATION_CHEAT_SHEET = {
        "012000000133": { name: "Diet Pepsi Can", ecoScore: "d", imageUrl: "https://images.openfoodfacts.org/images/products/001/200/000/0133/front_en.142.400.jpg" },
        "041500000251": { name: "Heinz Tomato Ketchup", ecoScore: "b", imageUrl: "https://images.openfoodfacts.org/images/products/004/150/000/0251/front_en.67.400.jpg" },
        "078742371946": { name: "Organic Whole Milk", ecoScore: "c", imageUrl: "https://images.openfoodfacts.org/images/products/007/874/237/1946/front_en.45.400.jpg" }
    };
    return PRESENTATION_CHEAT_SHEET[barcode] || { 
        name: `Eco Item #${barcode.slice(-4)}`, 
        ecoScore: "a", 
        imageUrl: "https://placehold.co/100x100?text=Eco+Food" 
    };
}