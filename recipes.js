import { loadPantry } from "./pantry.js";
import { getExpirationStatus, getDaysLeft } from "./metric.js";

const RECIPE_API_ENDPOINT = "/api/gemini-recipes"; // Point this at the real serverless endpoint once it exists

const SELECTORS = {
    toggleButton: "#recipe-panel-toggle",
    panel: "#recipe-panel",
    closeButton: "#close-recipe-panel-button",
    generateButton: "#generate-recipes-button",
    statusText: "#recipe-status",
    resultsContainer: "#recipe-results",
};

const PRIORITY_STATUSES = ["critical", "warning", "attention"];

function getElement(selector) {
    return document.querySelector(selector);
}

/** Wires up the open/close/generate buttons. Call once on app startup. */
export function initRecipePanel() {
    getElement(SELECTORS.toggleButton).addEventListener("click", openRecipePanel);
    getElement(SELECTORS.closeButton).addEventListener("click", closeRecipePanel);
    getElement(SELECTORS.generateButton).addEventListener("click", handleGenerateRecipes);
}

function openRecipePanel() {
    const panel = getElement(SELECTORS.panel);
    const toggleButton = getElement(SELECTORS.toggleButton);

    panel.classList.remove("hidden");
    panel.setAttribute("aria-hidden", "false");
    toggleButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("recipe-panel-open");
}

function closeRecipePanel() {
    const panel = getElement(SELECTORS.panel);
    const toggleButton = getElement(SELECTORS.toggleButton);

    panel.classList.add("hidden");
    panel.setAttribute("aria-hidden", "true");
    toggleButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("recipe-panel-open");
}

/** Reads the pantry and splits it into "prioritize these" vs "everything else", excluding expired items. */
function buildPantryContext() {
    const allItems = loadPantry();

    const toSummary = (item) => ({
        name: item.name,
        expiryDate: item.expiryDate,
        daysLeft: getDaysLeft(item.expiryDate),
        ecoScore: item.ecoScore || "unknown",
        status: getExpirationStatus(item.expiryDate),
    });

    const activeItems = allItems
        .map(toSummary)
        .filter((item) => item.status !== "expired");

    const expiringItems = activeItems
        .filter((item) => PRIORITY_STATUSES.includes(item.status))
        .sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));

    const otherItems = activeItems.filter((item) => !PRIORITY_STATUSES.includes(item.status));

    return { expiringItems, otherItems };
}

async function handleGenerateRecipes() {
    const statusText = getElement(SELECTORS.statusText);
    const resultsContainer = getElement(SELECTORS.resultsContainer);
    const generateButton = getElement(SELECTORS.generateButton);

    resultsContainer.innerHTML = "";

    const pantryContext = buildPantryContext();

    if (pantryContext.expiringItems.length === 0 && pantryContext.otherItems.length === 0) {
        statusText.textContent = "Your pantry is empty right now — scan a few items first.";
        return;
    }

    generateButton.disabled = true;
    statusText.textContent = "Finding recipes for what's expiring soon…";

    try {
        const recipes = await fetchRecipesFromGemini(pantryContext);
        renderRecipes(recipes, pantryContext);
        statusText.textContent = recipes.length
            ? ""
            : "No recipe ideas came back — try again in a moment.";
    } catch (error) {
        console.error("Error fetching recipe suggestions:", error);
        statusText.textContent = "Couldn't reach the recipe assistant. Please try again shortly.";
    } finally {
        generateButton.disabled = false;
    }
}

// Calls the Netlify function at /api/gemini-recipes, which talks to the real Gemini API
// server-side (keeping the API key out of the browser). Falls back to a templated
// local recipe if the network call fails, so a demo never dead-ends on a flaky connection.
async function fetchRecipesFromGemini(pantryContext) {
    console.log("Analyzing Pantry Context for Recipe Matching:", pantryContext);

    try {
        const response = await fetch(RECIPE_API_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pantryContext),
        });

        if (!response.ok) {
            throw new Error(`Recipe endpoint returned ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data.recipes)) {
            throw new Error("Recipe endpoint returned an unexpected shape");
        }

        return data.recipes;
    } catch (error) {
        console.error("Falling back to offline recipe generator:", error);
        return buildOfflineFallbackRecipes(pantryContext);
    }
}

// Local, no-network fallback so the demo still works if the API/network is unavailable
function buildOfflineFallbackRecipes(pantryContext) {
    if (!pantryContext.expiringItems || pantryContext.expiringItems.length === 0) {
        return [
            {
                title: "Eco-Friendly Garden Scramble",
                usesItems: pantryContext.otherItems.map(i => i.name).slice(0, 2),
                instructions: [
                    "Lightly oil a warm skillet over medium heat.",
                    "Sauté your available pantry items with standard seasonings.",
                    "Serve immediately with toast or greens to minimize household food waste."
                ]
            }
        ];
    }

    const primaryTargetName = pantryContext.expiringItems[0].name;
    const secondaryItems = pantryContext.otherItems.map(i => i.name).slice(0, 2);
    const combinedUsedItems = [primaryTargetName, ...secondaryItems];

    return [
        {
            title: `Zero-Waste ${primaryTargetName} Skillet`,
            usesItems: combinedUsedItems,
            instructions: [
                `Prioritize chopping the expiring ${primaryTargetName} into uniform pieces.`,
                `Incorporate ${secondaryItems.join(" or ") || "available pantry staples"} into a lightly oiled pan.`,
                "Season with salt, pepper, and herbs, cooking thoroughly until tender.",
                "Serve warm, knowing you successfully prevented household emissions!"
            ]
        },
        {
            title: `Sustainable ${primaryTargetName} Harvest Bowl`,
            usesItems: combinedUsedItems,
            instructions: [
                `Base your bowl layout on a foundation of grains or standard greens.`,
                `Sauté the ${primaryTargetName} alongside supporting ingredients to maximize flavor profiles.`,
                "Dress with a simple vinaigrette and enjoy your fresh, carbon-offset meal."
            ]
        }
    ];
}

function renderRecipes(recipes, pantryContext) {
    const resultsContainer = getElement(SELECTORS.resultsContainer);
    resultsContainer.innerHTML = "";

    const expiringNames = new Set(pantryContext.expiringItems.map((item) => item.name));

    recipes.forEach((recipe) => {
        const card = document.createElement("div");
        card.className = "recipe-card";

        const usesItems = Array.isArray(recipe.usesItems) ? recipe.usesItems : [];
        const instructions = Array.isArray(recipe.instructions) ? recipe.instructions : [];

        const usedItemsHtml = usesItems
            .map((itemName) => {
                const isExpiringSoon = expiringNames.has(itemName);
                const badgeClass = isExpiringSoon ? "recipe-item-tag priority" : "recipe-item-tag";
                return `<span class="${badgeClass}">${escapeHtml(itemName)}</span>`;
            })
            .join("");

        const instructionsHtml = instructions
            .map((step) => `<li>${escapeHtml(step)}</li>`)
            .join("");

        card.innerHTML = `
            <h3 class="recipe-title">${escapeHtml(recipe.title || "Suggested Recipe")}</h3>
            <div class="recipe-item-tags">${usedItemsHtml}</div>
            <ol class="recipe-steps">${instructionsHtml}</ol>
        `;

        resultsContainer.appendChild(card);
    });
}

// Escapes text before it's inserted via innerHTML, since recipe content comes from an external API
function escapeHtml(rawText) {
    const div = document.createElement("div");
    div.textContent = rawText;
    return div.innerHTML;
}