# Web Snake Game

A classic Snake game built with vanilla HTML, CSS, and JavaScript — no dependencies, no build step.

## Features

- Arrow keys or `WASD` to steer
- Score and best-score tracking (persisted in `localStorage`)
- Adjustable speed: `-` slows down, `=` speeds up
- Game-over overlay with restart
- Responsive canvas that scales to fit the screen

## Play

Open `index.html` in any modern browser, or serve the folder:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Controls

| Key(s)            | Action             |
| ----------------- | ------------------ |
| `↑ ↓ ← →` / `WASD`| Move the snake     |
| `P`               | Pause / resume     |
| `-` / `=`         | Slow down / speed up |
| `Enter` / `Space` | Restart after game over |