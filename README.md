# tintsim-api
Tint Squad window tint simulator API (Render web service). Calls Gemini image directly, caches each combo.
Env: GEMINI_API_KEY (required), PUBLIC_URL, GEMINI_MODEL (default gemini-3.1-flash-image), DAILY_CAP (100), IP_PER_HOUR (6), ALLOWED_ORIGINS. No Airtable access, no personal data.
data.json is a copy of tintsquad-site/public/tint-simulator/data.json (refresh both with tools/export_tintsim.py).
