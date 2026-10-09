# Rize Badge Generator

A simple web tool: a founder picks a Rize badge design, uploads their logo, and downloads
a share-ready image. Everything runs in the browser — logos never leave the founder's device.

## What's inside

```
index.html          the page
app.js              the logic (gallery, filters, logo placement, download)
manifest.json       the list of designs (community, format, theme, logo-box, card tone)
assets/             the 15 full-resolution badge backgrounds
assets/thumbs/      small gallery previews
```

It is **100% static** — no server, no Python, no build step. Any static host works.

## Run it on your computer

```
cd rize-badge-generator
python3 -m http.server 8787
```

Then open **http://localhost:8787**

## Put it online (GitHub Pages — free)

1. github.com → **New repository** → name it `rize-badge` → Create.
2. **Add file → Upload files** → drag in `index.html`, `app.js`, `manifest.json`, and the
   **`assets` folder** (keep the folder structure). Commit.
3. **Settings → Pages** → Branch: `main` / `root` → Save.
4. After ~1 minute your link is live: `https://<username>.github.io/rize-badge/`

### Pre-filtered community links (what you share)

- Tech:  `…/rize-badge/?c=tech`
- D2C:   `…/rize-badge/?c=d2c`
- Xport: `…/rize-badge/?c=xport`

Opening the plain link (no `?c=`) shows a "pick your community" screen.

## Current scope

- **Communities:** Tech, D2C, Xport
- **Formats:** Square (1:1) and Story (4:5)
- **Not yet included:** Slide format (the old PowerPoint decks need a separate conversion step)

## Adding or fixing designs later

Each design is one entry in `manifest.json`:

```json
{
  "id": "tech-square-1",
  "community": "tech",
  "format": "square",
  "theme": "dark",          // for the Light/Dark filter
  "cardTone": "light",      // colour of the logo area (drives auto backing)
  "box": { "x": 0.44, "y": 0.45, "w": 0.13, "h": 0.09 },  // logo area, as fractions of the image
  "w": 2160, "h": 2160,
  "file": "assets/tech-square-1.png"
}
```

Add the background to `assets/`, a thumbnail to `assets/thumbs/`, and a matching entry here.
