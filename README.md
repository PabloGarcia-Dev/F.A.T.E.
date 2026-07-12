# F.A.T.E. — Food Alert and Tracking Engine

F.A.T.E. is a mobile-friendly web app that helps reduce household food waste. Scan a barcode when you put groceries away, set an expiration date, and F.A.T.E. tracks your pantry — sorted by what's about to go bad — and uses AI to suggest recipes built around using up expiring items first.

## Features

- 📷 **Barcode scanning** via device camera (UPC-A, UPC-E, EAN-13, EAN-8), with manual entry as a fallback
- 🥫 **Live product lookup** — name, ingredients, allergens, and eco-score pulled from [Open Food Facts](https://world.openfoodfacts.org/)
- ⏰ **Expiration tracking** with color-coded urgency (fresh → attention → warning → critical → expired)
- 🍳 **AI-powered recipe suggestions** — real-time calls to Google's Gemini API, prioritizing whatever's expiring soonest
- 🌱 **Eco-score badges** on every item to nudge greener choices
- 📱 Fully responsive, installable as a mobile web app — no framework, no build step

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript (ES Modules), HTML5, CSS3 |
| Barcode scanning | [ZXing](https://github.com/zxing-js/browser) (loaded via CDN) |
| Product data | Open Food Facts API |
| AI recipes | Google Gemini API (`gemini-2.5-flash`) |
| Backend | Netlify Functions (serverless) |
| Hosting | Netlify |
| Storage | Browser `localStorage` (no database) |

## Project Structure

```
.
├── index.html                       # App shell: manual entry, pantry list, scanner + recipe panels
├── app.js                           # Orchestrator: wires scanning → lookup → save → render
├── scanner.js                       # Camera barcode scanning + manual barcode validation
├── foodApi.js                       # Fetches product data from Open Food Facts
├── metric.js                        # Expiration math: days left, urgency status, sorting
├── pantry.js                        # localStorage CRUD for pantry items
├── recipes.js                       # Builds pantry context, calls recipe API, renders recipe cards
├── style.css                        # App styling
├── netlify.toml                     # Routes /api/gemini-recipes to the serverless function
└── netlify/
    └── functions/
        └── gemini-recipes.js        # Server-side function that securely calls the Gemini API
```

## Getting Started

### Prerequisites
- [Netlify CLI](https://docs.netlify.com/cli/get-started/) (for local dev with working serverless functions)
- A [Gemini API key](https://aistudio.google.com/apikey) (free tier is sufficient for development)

### Local Setup

1. Clone the repo:
   ```bash
   git clone <your-repo-url>
   cd fate
   ```

2. Install the Netlify CLI if you don't have it:
   ```bash
   npm install -g netlify-cli
   ```

3. Create a `.env` file in the project root:
   ```
   GEMINI_API_KEY=your_key_here
   ```

4. Run locally (serves the static site *and* the serverless function together):
   ```bash
   netlify dev
   ```

5. Open the local URL shown in the terminal.

> **Note:** Opening `index.html` directly in a browser (without `netlify dev`) will load the app, but the AI recipe feature will fail since `/api/gemini-recipes` won't resolve — the app falls back to offline template recipes in that case.

### Deploying to Netlify

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. In Netlify, click **Add new site → Import an existing project**, and connect your repo.
3. Netlify will auto-detect `netlify.toml` and the `netlify/functions` folder — no build command needed.
4. In **Site configuration → Environment variables**, add:
   - `GEMINI_API_KEY` = your Gemini API key
5. Deploy. If you added the environment variable after your first deploy, trigger a redeploy from the **Deploys** tab so the function picks it up.

## How the AI Recipe Flow Works

```
User taps "Get Recipe Ideas"
   → recipes.js splits the pantry into "expiring soon" vs "everything else"
   → POST /api/gemini-recipes
   → netlify.toml redirects to netlify/functions/gemini-recipes.js
   → the function reads GEMINI_API_KEY from Netlify's environment (server-side only)
   → calls Gemini's generateContent API, requesting structured JSON output
   → recipes render as cards, with expiring ingredients highlighted
```

If the API or network is unavailable, the app silently falls back to a local, templated recipe generator so the user never sees a dead end.

## Known Limitations

- Pantry data is stored per-device (`localStorage`) — no cloud sync between devices
- No automated tests
- No push notifications for upcoming expirations (planned)
- Fallback recipe mode is currently invisible to the user — no on-screen indicator when AI generation fails and a template recipe is shown instead

## Roadmap Ideas

- Cloud sync / user accounts so pantry data persists across devices
- Push notifications a day or two before an item expires
- Visible UI state when recipe suggestions fall back to offline mode
- Nutrition-aware recipe filtering using the nutrition data already returned by Open Food Facts

## Credits

Built for BloomKnights Hackathon by Ceasar, Pablo, Sam, and Xavian. Product data courtesy of [Open Food Facts](https://world.openfoodfacts.org/), an open, collaborative database of food products. Recipe generation powered by Google's Gemini API.
