# tintsim-api
Tint Squad window tint simulator API (Render web service). Calls Gemini image directly, caches each combo, writes the lead to Airtable (Leads & Submissions) in the background.
Env: GEMINI_API_KEY, AIRTABLE_TOKEN, PUBLIC_URL, GEMINI_MODEL (default gemini-3.1-flash-image), DAILY_CAP (100), IP_PER_HOUR (6), PHONE_PER_DAY (5), ALLOWED_ORIGINS, WRITE_LEADS.
data.json is a copy of tintsquad-site/public/tint-simulator/data.json (refresh both with tools/export_tintsim.py).
