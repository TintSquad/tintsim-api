const STRIP_CUT = ' The strip is precision plotter-cut so its bottom edge forms a perfectly straight, level horizontal line across the full width of the windshield, parallel to the hood line. It does NOT follow the curved factory dot-matrix/frit edge and does not dip or slope down at the corners; the strip is an even height from side to side.';
const clean = s => String(s || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
// Wording is Mike's original Airtable formulas (Windshield Segment, Side & Rear Segment, Prompt),
// verbatim except typo fixes: underscores -> spaces, double spaces collapsed, missing line break after the Note.
function sideRear(o) {
  return 'The front side windows have ' + (o.front ? `${o.front} window tint. ` : 'The standard clear factory glass. ') +
    'The rear side windows have ' + (o.rear ? `${o.rear} window tint. ` : 'The standard OEM factory glass. ') +
    'The rear windshield has ' + (o.back ? `${o.back} window tint. ` : 'The standard OEM factory glass. ');
}
function windshield(full, strip) {
  if (full && strip) return `CRUCIAL WINDSHIELD SPECIFICATION: The entire front windshield is fully covered in a distinct, dark ${full} window tint. The glass must be rendered as dark smoked glass, significantly obscuring the view into the vehicle cabin. Additionally with an extra dark 5% solid black eyebrow/sun strip running across the top 8 inches of the windshield.` + STRIP_CUT;
  if (full) return `CRUCIAL WINDSHIELD SPECIFICATION: The entire front windshield is fully covered in a distinct, dark ${full} window tint. The glass must be rendered as dark smoked glass, significantly obscuring the view into the vehicle cabin.`;
  if (strip) return 'CRUCIAL WINDSHIELD SPECIFICATION: The main front windshield glass is clear and transparent, but features an extra-dark 5% solid black eyebrow strip running across the top 8 inches of the glass.' + STRIP_CUT;
  return '';
}
function buildPrompt(o) {
  const veh = clean(`${o.year} ${o.make} ${o.model} ${o.body || ''}`);
  return [
    "You are generating an Image response for an automotive window tint simulator application. Your primary objective is to produce an image that accurately depicts the specified windows along with their corresponding tint percentages on the client's exact vehicle.",
    '',
    'Users Vehicle Specifications:',
    `${veh}.`,
    `Paint Color: ${clean(o.color)}.`,
    '',
    'Window Tint Details:',
    clean(sideRear(o) + ' ' + windshield(o.full, o.strip)),
    '',
    'Note: Standard OEM rear privacy glass represents a 20% darkness level—front windows tinted at 20% must seamlessly match the factory rear glass in shade and opacity for a uniform visual match.',
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
module.exports = { buildPrompt, gemini, STRIP_CUT };
