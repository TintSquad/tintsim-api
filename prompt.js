// Cleaned-up version of the Airtable "Prompt" formula (Leads & Submissions).
const clean = s => String(s || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const FACTORY = 'the standard factory (OEM) glass, left untouched';
function glass(label, shade) {
  return shade ? `The ${label} have ${shade} window tint.` : `The ${label} have ${FACTORY}.`;
}
function windshield(full, strip) {
  if (full && strip) return `CRUCIAL WINDSHIELD SPECIFICATION: The entire front windshield is fully covered in a distinct, dark ${full} window tint. The glass must be rendered as dark smoked glass, significantly obscuring the view into the vehicle cabin. Additionally, an extra-dark 5% solid black eyebrow/sun strip runs across the top 8 inches of the windshield.`;
  if (full) return `CRUCIAL WINDSHIELD SPECIFICATION: The entire front windshield is fully covered in a distinct, dark ${full} window tint. The glass must be rendered as dark smoked glass, significantly obscuring the view into the vehicle cabin.`;
  if (strip) return 'CRUCIAL WINDSHIELD SPECIFICATION: The main front windshield glass is clear and transparent, but features an extra-dark 5% solid black eyebrow strip running across the top 8 inches of the glass.';
  return 'The front windshield is clear, untinted factory glass.';
}
function buildPrompt(o) {
  const veh = clean(`${o.year} ${o.make} ${o.model} ${o.body || ''}`);
  return [
    "You are generating an image for an automotive window tint simulator application. Your primary objective is to produce an image that accurately depicts the specified windows with their corresponding tint percentages on the customer's exact vehicle.",
    '',
    "User's Vehicle Specifications:",
    `${veh}.`,
    `Paint Color: ${clean(o.color)}.`,
    '',
    'Window Tint Details:',
    [glass('front side windows', o.front), glass('rear side windows', o.rear), glass('rear windshield', o.back).replace('The rear windshield have', 'The rear windshield has'), windshield(o.full, o.strip)].join(' '),
    '',
    'Note: Standard OEM rear privacy glass represents a 20% darkness level. Front windows tinted at 20% must match the factory rear glass in shade and opacity for a uniform visual match.',
    '',
    'Environment & Background Setup',
    'Setting: Minimalist professional commercial photography studio.',
    'Backdrop: Solid, neutral dark grey seamless cyclorama wall ensuring full focus remains on the vehicle and glass texture.',
    'Flooring: Polished studio floor featuring smooth, subtle ambient reflections of the car and overhead light banks.',
    '',
    'Lighting, Camera & Rendering Specifications',
    'Perspective & Angle: Eye-level, three-quarter front perspective capturing the front fascia, windshield, and side profile.',
    'Lighting Setup: Professional studio softbox overhead diffuser lighting with controlled reflections that highlight body panels without washing out tint opacity.',
    'Image Quality: Tack-sharp focus, high contrast, vibrant color fidelity, and ultra-high commercial detail.'
  ].join('\n');
}
async function gemini(model, prompt, key, size = '1K') {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9', imageSize: size } } })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`gemini ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const part = (j.candidates?.[0]?.content?.parts || []).find(p => p.inlineData);
  if (!part) throw new Error('no image: ' + JSON.stringify(j).slice(0, 300));
  return { buf: Buffer.from(part.inlineData.data, 'base64'), mime: part.inlineData.mimeType, usage: j.usageMetadata };
}
module.exports = { buildPrompt, gemini };
