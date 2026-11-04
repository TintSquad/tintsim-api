// Replicates Mike's Airtable formulas literally (Windshield Segment, Side & Rear Segment, Prompt)
// and diffs them against buildPrompt for every combination.
const { buildPrompt } = require('../prompt');
const T = v => !!v; // Airtable truthiness: any non-empty string, incl. "None", is true
function wsSeg(full, strip) {
  if (T(full) && strip === 'Yes') return 'CRUCIAL WINDSHIELD SPECIFICATION: The entire front windshield is fully covered in a distinct, dark ' + full + '  window tint. The glass must be rendered as dark smoked glass, significantly obscuring the view into the vehicle cabin. Additionally with an extra dark 5%  solid black eyebrow/sun strip running across the top 8 inches of the windshield.';
  if (T(full)) return 'CRUCIAL WINDSHIELD SPECIFICATION: The entire front windshield is fully covered in a distinct, dark ' + full + ' window tint. The glass must be rendered as dark smoked glass, significantly obscuring the view into the vehicle cabin.';
  if (strip === 'Yes') return 'CRUCIAL WINDSHIELD SPECIFICATION: The main front windshield glass is clear and transparent, but features an extra-dark 5% solid black eyebrow strip running across the top 8 inches of the glass.';
  return '';
}
function srSeg(f, r, b) {
  return 'The front side windows have  ' + (T(f) ? f + ' window tint. ' : 'The standard clear factory glass. ') +
    'The rear side windows have ' + (T(r) ? r + ' window tint. ' : 'The standard OEM factory glass. ') +
    'The rear windshield has ' + (T(b) ? b + ' window tint. ' : 'The standard OEM factory glass. ');
}
function airtablePrompt(ymm, body, color, f, r, b, full, strip) {
  return "You are generating an Image response for an automotive window tint simulator application. Your primary objective is to produce an image that accurately depicts the specified windows along with their corresponding tint percentages on the client's exact vehicle." + '\n\n' +
    'Users Vehicle Specifications:' + '\n' + ' ' + ymm + ' ' + body + '.\n' + 'Paint Color: ' + color + '.\n\n' +
    'Window Tint Details:' + '\n' + srSeg(f, r, b) + ' ' + wsSeg(full, strip) + '\n\n' +
    'Note: Standard OEM rear privacy glass represents a 20% darkness level—front windows tinted at 20% must seamlessly match the factory rear glass in shade and opacity for a uniform visual match.' +
    'Environment & Background Setup' + '\n' + 'Setting: Minimalist professional commercial photography studio.' + '\n' +
    'Backdrop: Solid, neutral dark grey seamless cyclorama wall ensuring full focus remains on the vehicle and glass texture.' + '\n' +
    'Flooring: Polished studio floor featuring smooth, subtle ambient reflections of the car and overhead light banks.' + '\n\n' +
    'Lighting, Camera & Rendering Specifications' + '\n' +
    'Perspective & Angle: Eye-level, three-quarter front perspective capturing the front fascia, windshield, and side profile.' + '\n' +
    'Lighting Setup: Professional studio softbox overhead diffuser lighting with controlled reflections that highlight body panels without washing out tint opacity.' + '\n' +
    'Image Quality: Tack-sharp focus, high contrast, vibrant color fidelity, and ultra-high commercial detail.';
}
// Allowed normalisations only: underscores->spaces, whitespace runs collapsed per line, line break after the Note.
const norm = s => s.replace('uniform visual match.Environment', 'uniform visual match.\n\nEnvironment')
  .split('\n').map(l => l.replace(/_/g, ' ').replace(/ +/g, ' ').trim()).join('\n');
const none = v => (v === 'None' ? '' : v); // the "None" bug fix: Airtable fed "None" as a shade
const SH = ['', 'None', '5%', '20%', '35%', '50%'], WS = ['', 'None', '20%', '35%', '50%'];
let n = 0, fail = 0, noneOnly = 0;
for (const f of SH) for (const r of SH) for (const b of SH) for (const full of WS) for (const strip of ['No', 'Yes']) {
  n++;
  const body = 'Crew_Cab', ymm = '2026 Chevrolet Tahoe';
  const mine = buildPrompt({ year: '2026', make: 'Chevrolet', model: 'Tahoe', body, color: 'Red_Hot', front: none(f), rear: none(r), back: none(b), full: none(full), strip: strip === 'Yes' });
  const raw = airtablePrompt(ymm, body, 'Red_Hot', f, r, b, full, strip);
  const fixed = airtablePrompt(ymm, body, 'Red_Hot', none(f), none(r), none(b), none(full), strip);
  if (norm(fixed) !== norm(mine)) { fail++; if (fail < 4) console.log('DIFF', { f, r, b, full, strip }, '\nA:', norm(fixed), '\nB:', mine); }
  else if (norm(raw) !== norm(mine)) noneOnly++;
}
console.log(`${n} combos; ${n - fail} identical after allowed fixes; ${noneOnly} of those differ from the raw formula only because a field said "None"; ${fail} real differences`);
process.exit(fail ? 1 : 0);
