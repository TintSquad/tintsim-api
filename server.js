// Tint Squad Window Tint Simulator API. No dependencies (Node 20+). Writes nothing to Airtable; collects no personal info.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { buildPrompt, gemini } = require('./prompt');
const E = process.env;
const PORT = E.PORT || 10000;
const MODEL = E.GEMINI_MODEL || 'gemini-3-pro-image';
const SIZE = E.GEMINI_SIZE || '2K';
const DAILY_CAP = +E.DAILY_CAP || 100;          // new (uncached) renders per day
const IP_PER_HOUR = +E.IP_PER_HOUR || 6;
const CACHE_DIR = E.CACHE_DIR || '/tmp/tintsim-cache';
const PUBLIC_URL = (E.PUBLIC_URL || '').replace(/\/$/, '');
const ORIGINS = (E.ALLOWED_ORIGINS || 'https://tintsquad-site-preview.onrender.com,https://tintsquad.com,https://www.tintsquad.com').split(',');
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json')));
fs.mkdirSync(CACHE_DIR, { recursive: true });

const vehById = new Map(); for (const [mk, ms] of Object.entries(DATA.vehicles)) for (const [mo, bs] of Object.entries(ms)) for (const [id, body] of bs) vehById.set(id, { make: mk, model: mo, body });
const colById = new Map(); for (const [mk, cs] of Object.entries(DATA.colors)) for (const [id, name] of cs) colById.set(id, { make: mk, name });

// --- simple in-memory limits (reset on restart) ---
const hits = new Map();
function bump(key, windowMs, max) {
  const now = Date.now(); const a = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (a.length >= max) { hits.set(key, a); return false; } a.push(now); hits.set(key, a); return true;
}
let day = new Date().toISOString().slice(0, 10), rendersToday = 0;
const inflight = new Map(); const mem = new Map(); // small LRU of image buffers
function memPut(k, b) { mem.set(k, b); if (mem.size > 120) mem.delete(mem.keys().next().value); }
function readCache(k) { if (mem.has(k)) return mem.get(k); const f = path.join(CACHE_DIR, k + '.jpg'); if (fs.existsSync(f)) { const b = fs.readFileSync(f); memPut(k, b); return b; } return null; }

function send(res, code, body, hdr = {}) {
  const isBuf = Buffer.isBuffer(body);
  res.writeHead(code, { 'Content-Type': isBuf ? 'image/jpeg' : 'application/json', ...hdr });
  res.end(isBuf ? body : JSON.stringify(body));
}
function cors(req, res) {
  const o = req.headers.origin;
  if (o && ORIGINS.includes(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); }
  return !o || ORIGINS.includes(o);
}
const shadeOk = (list, v) => !v || list.includes(v);

async function render(req, res) {
  let raw = ''; for await (const c of req) { raw += c; if (raw.length > 5000) return send(res, 413, { error: 'too big' }); }
  let b; try { b = JSON.parse(raw); } catch { return send(res, 400, { error: 'bad json' }); }
  const v = vehById.get(b.vehicleId); const col = colById.get(b.colorId);
  if (!v || !col || !DATA.years.includes(String(b.year))) return send(res, 400, { error: 'Please pick your vehicle and color.' });
  const S = DATA.shades; const t = { front: b.front || '', rear: b.rear || '', back: b.back || '', full: b.full || '', strip: !!b.strip };
  if (!shadeOk(S.front, t.front) || !shadeOk(S.rear, t.rear) || !shadeOk(S.back, t.back) || !shadeOk(S.full, t.full)) return send(res, 400, { error: 'Invalid shade.' });
  if (!t.front && !t.rear && !t.back && !t.full && !t.strip) return send(res, 400, { error: 'Pick at least one window to tint.' });
  if (b.website) return send(res, 400, { error: 'blocked' }); // honeypot
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (!bump('ip:' + ip, 3600e3, IP_PER_HOUR)) return send(res, 429, { error: 'Too many previews from this connection. Try again in an hour, or call (315) 418-5442.' });

  const combo = { year: String(b.year), make: v.make, model: v.model, body: v.body, color: col.name, ...t };
  const key = crypto.createHash('sha256').update(MODEL + '|' + SIZE + '|' + buildPrompt(combo)).digest('hex').slice(0, 32);
  if ((E.GEMINI_API_KEY||'').length < 20) return send(res, 503, { error: 'The simulator is not switched on yet. Please check back soon.' });
  const url = `${PUBLIC_URL}/img/${key}.jpg`;
    const t0 = Date.now(); let cached = !!readCache(key);
  if (!cached) {
    const today = new Date().toISOString().slice(0, 10); if (today !== day) { day = today; rendersToday = 0; }
    if (!inflight.has(key)) {
      if (rendersToday >= DAILY_CAP) return send(res, 503, { error: 'The simulator is at its daily limit. Please try again tomorrow or call (315) 418-5442.' });
      rendersToday++;
      inflight.set(key, gemini(MODEL, buildPrompt(combo), E.GEMINI_API_KEY, SIZE).then(r => { fs.writeFileSync(path.join(CACHE_DIR, key + '.jpg'), r.buf); memPut(key, r.buf); }).finally(() => inflight.delete(key)));
    }
    try { await inflight.get(key); } catch (e) { console.log('gemini error', e.message); return send(res, 502, { error: 'The preview could not be generated. Please try again.' }); }
  }
  console.log('render', key, cached ? 'cache' : 'new', Date.now() - t0, 'ms', 'today', rendersToday);
  send(res, 200, { image: url, cached, ms: Date.now() - t0 });
}

http.createServer(async (req, res) => {
  const okOrigin = cors(req, res);
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, okOrigin ? 204 : 403, '');
  if (u.pathname === '/health') return send(res, 200, { ok: true, model: MODEL, size: SIZE, format: 'JPEG 16:9', rendersToday, cap: DAILY_CAP, geminiKeySet: (E.GEMINI_API_KEY||'').length > 20 });
  const m = u.pathname.match(/^\/img\/([a-f0-9]{32})\.jpg$/);
  if (m && req.method === 'GET') { const b = readCache(m[1]); return b ? send(res, 200, b, { 'Cache-Control': 'public, max-age=31536000, immutable' }) : send(res, 404, { error: 'not found' }); }
  if (u.pathname === '/render' && req.method === 'POST') {
    if (!req.headers.origin || !okOrigin) return send(res, 403, { error: 'origin not allowed' });
    return render(req, res).catch(e => { console.log(e); send(res, 500, { error: 'server error' }); });
  }
  send(res, 404, { error: 'not found' });
}).listen(PORT, () => console.log('tintsim-api on', PORT, MODEL));
