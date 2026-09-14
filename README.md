# Web Snake — Deluxe 🐍

A modern, upgraded Snake game built with vanilla HTML, CSS, and JavaScript — no dependencies, no build step.

## Features

- **Squished apples** — chunky oval apples with a shine, stem, and leaf
- **Golden boost stars ⭐** — grab them to move **2× faster** for a short burst
- **Rock obstacles 🪨** — a bigger field with rocks you have to steer around
- **Realistic snake** — tapered body that thins toward the tail, a rounded head with eyes, and a belly pattern
- **Bigger field** — 24×24 grid (up from 20×20) with **2× larger cells** (40px vs 20px), on a 960×960 canvas
- **Slow start, then accelerates** — the snake starts slow and speeds up as you eat more apples
- **Sound effects** — eat, boost, death, and start sounds via the Web Audio API (mute with `M`)
- Score and best-score tracking (persisted in `localStorage`)
- Responsive canvas that scales to fit the screen

## Play

Open `index.html` in any modern browser, or serve the folder:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Controls

| Key(s)            | Action                    |
| ----------------- | ------------------------- |
| `↑ ↓ ← →` / `WASD`| Move the snake            |
| `P`               | Pause / resume            |
| `M`               | Mute / unmute sound       |
| `Enter` / `Space` | Start / restart after game over |
| Click `🔊`        | Mute / unmute sound       |