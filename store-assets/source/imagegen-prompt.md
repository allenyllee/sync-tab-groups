# Icon generation prompt

The former circular-arrow icon concept was generated with the built-in OpenAI
image generation tool and converted from a flat chroma-key background to a
transparent PNG. It is retained here as design history, but is no longer used
for production assets.

The current production icon is the deterministic
`tab-groups-resurrection.svg`. It uses four large, asymmetric tab-group blocks
without an outline or surrounding circle. `npm run icons:build` renders that
single source at every extension and Chrome Web Store icon size.

## Prompt

Use case: logo-brand

Asset type: Chrome browser extension icon master artwork

Primary request: Create a distinctive icon for "Tab Groups Resurrection", an
extension that saves and restores organized browser tab groups.

Subject: Four rounded browser-tab tiles arranged as a compact group, with a
clear circular renewal/resurrection arrow integrated around them.

Style/medium: Crisp minimal flat vector-style symbol, bold simple geometry,
professional open-source utility branding.

Composition/framing: Centered square icon, generous safe margin, readable at 16
pixels, no tiny details.

Color palette: Deep indigo and teal tiles with a warm golden renewal arrow.

Text: None.

Scene/backdrop: Perfectly flat solid `#ff00ff` chroma-key background for
background removal.

Constraints: The background must be one uniform color with no shadows,
gradients, texture, reflections, floor plane, or lighting variation. Keep the
subject fully separated with crisp edges and padding. Do not use `#ff00ff` in
the subject. No cast shadow, contact shadow, reflection, watermark, letters,
words, or browser brand logo.
