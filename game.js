(() => {
  "use strict";

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best-num");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMessage = document.getElementById("overlay-message");
  const muteInd = document.getElementById("mute-ind");
  const boostInd = document.getElementById("boost-ind");

  const CELL = 40;                 // px per cell — 2× the old 20px squares
  const COLS = canvas.width / CELL; // 24
  const ROWS = canvas.height / CELL; // 24
  const START_SPEED = 220;         // ms per step — snake starts slow
  const MIN_SPEED = 55;            // fastest base speed
  const ACCEL = 6;                 // ms shaved off per apple eaten
  const BOOST_TURNS = 16;          // steps the 2× boost lasts
  const ROCK_COUNT = 10;           // obstacles on the big field

  const DIRS = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 },
    s: { x: 0, y: 1 },
    a: { x: -1, y: 0 },
    d: { x: 1, y: 0 },
  };

  // ---- Web Audio sound effects -------------------------------------------
  let audioCtx = null;
  let muted = localStorage.getItem("snake-muted") === "1";
  updateMuteUi();

  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        audioCtx = null;
      }
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  function tone(freq, dur, type, vol, when, endFreq) {
    if (muted || !audioCtx) return;
    const t = audioCtx.currentTime + (when || 0);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  const sfx = {
    eat: () => tone(660, 0.1, "sine", 0.18, 0, 880),
    boost: () => { tone(500, 0.1, "triangle", 0.2); tone(760, 0.15, "triangle", 0.2, 0.07, 1100); },
    death: () => tone(300, 0.3, "sawtooth", 0.22, 0, 60),
    start: () => tone(440, 0.09, "sine", 0.15),
  };

  function updateMuteUi() {
    muteInd.textContent = muted ? "🔇" : "🔊";
  }

  function toggleMute() {
    muted = !muted;
    localStorage.setItem("snake-muted", muted ? "1" : "0");
    updateMuteUi();
  }

  // ---- Game state --------------------------------------------------------
  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = dir;
  let food = null;
  let boost = null;
  let rocks = [];
  let score = 0;
  let best = Number(localStorage.getItem("snake-best") || 0);
  let running = false;
  let paused = false;
  let gameOver = false;
  let interval = null;
  let boostLeft = 0;
  let loopDelay = -1;

  bestEl.textContent = best;

  function isOut(pos) {
    return pos.x < 0 || pos.x >= COLS || pos.y < 0 || pos.y >= ROWS;
  }

  function occupied(pos) {
    return (
      snake.some((s) => s.x === pos.x && s.y === pos.y) ||
      rocks.some((r) => r.x === pos.x && r.y === pos.y)
    );
  }

  function freeCells() {
    const free = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const pos = { x, y };
        if (occupied(pos)) continue;
        if (food && food.x === x && food.y === y) continue;
        if (boost && boost.x === x && boost.y === y) continue;
        free.push(pos);
      }
    }
    return free;
  }

  function spawnFood() {
    const free = freeCells();
    if (free.length === 0) return;
    food = free[Math.floor(Math.random() * free.length)];
  }

  function spawnBoost() {
    const free = freeCells();
    if (free.length === 0) return;
    boost = free[Math.floor(Math.random() * free.length)];
  }

  function makeRocks() {
    rocks = [];
    // keep a corridor of empty cells around the snake's starting spot
    const guard = new Set();
    for (let i = -2; i <= 4; i++) {
      guard.add((12 + i) + ",11");
      guard.add("12," + (11 + i));
    }
    let tries = 0;
    while (rocks.length < ROCK_COUNT && tries < 2000) {
      tries++;
      const pos = { x: 1 + Math.floor(Math.random() * (COLS - 2)), y: 1 + Math.floor(Math.random() * (ROWS - 2)) };
      if (guard.has(pos.x + "," + pos.y)) continue;
      if (occupied(pos)) continue;
      rocks.push(pos);
    }
  }

  function baseSpeed() {
    return Math.max(MIN_SPEED, START_SPEED - score * ACCEL);
  }

  function stepDelay() {
    const s = baseSpeed();
    return boostLeft > 0 ? Math.round(s / 2) : s;
  }

  function startLoop() {
    clearInterval(interval);
    loopDelay = stepDelay();
    interval = setInterval(step, loopDelay);
  }

  function syncLoop() {
    const d = stepDelay();
    if (d !== loopDelay) startLoop();
  }

  // ---- Reset & flow -------------------------------------------------------
  function reset() {
    clearInterval(interval);
    interval = null;
    loopDelay = -1;
    snake = [
      { x: 12, y: 11 },
      { x: 11, y: 11 },
      { x: 10, y: 11 },
    ];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    running = false;
    paused = false;
    gameOver = false;
    boostLeft = 0;
    boostInd.hidden = true;
    boostInd.classList.remove("active");
    scoreEl.textContent = score;
    food = null;
    boost = null;
    makeRocks();
    spawnFood();
    if (Math.random() < 0.6) spawnBoost();
    overlay.style.display = "flex";
    overlayTitle.textContent = "Ready?";
    overlayMessage.textContent = "Arrow keys or WASD to steer ·  P pause ·  M mute";
    draw();
  }

  function start(direction) {
    ensureAudio();
    nextDir = direction || dir;
    running = true;
    overlay.style.display = "none";
    sfx.start();
    startLoop();
  }

  function endGame() {
    gameOver = true;
    running = false;
    clearInterval(interval);
    sfx.death();
    if (score > best) {
      best = score;
      localStorage.setItem("snake-best", best);
      bestEl.textContent = best;
    }
    boostInd.hidden = true;
    boostInd.classList.remove("active");
    overlay.style.display = "flex";
    overlayTitle.textContent = "💀 Game over";
    overlayMessage.textContent = `You ate ${score} apples (best ${best}). Press Enter / Space to play again.`;
    draw();
  }

  function showPause(b) {
    paused = b;
    if (b) {
      clearInterval(interval);
      overlay.style.display = "flex";
      overlayTitle.textContent = "Paused";
      overlayMessage.textContent = "Press P to resume";
    } else {
      overlay.style.display = "none";
      startLoop();
    }
  }

  // ---- Game step ----------------------------------------------------------
  function step() {
    dir = nextDir;
    const head = snake[0];
    const newHead = { x: head.x + dir.x, y: head.y + dir.y };

    if (
      isOut(newHead) ||
      snake.some((s) => s.x === newHead.x && s.y === newHead.y) ||
      rocks.some((r) => r.x === newHead.x && r.y === newHead.y)
    ) {
      endGame();
      return;
    }

    snake.unshift(newHead);
    let grew = false;

    if (food && newHead.x === food.x && newHead.y === food.y) {
      score++;
      scoreEl.textContent = score;
      sfx.eat();
      spawnFood();
      if (!boost && Math.random() < 0.3) spawnBoost();
      grew = true;
    }

    if (boost && newHead.x === boost.x && newHead.y === boost.y) {
      boost = null;
      boostLeft = BOOST_TURNS;
      boostInd.hidden = false;
      boostInd.classList.add("active");
      sfx.boost();
      grew = true;
    }

    if (!grew) snake.pop();

    if (boostLeft > 0) {
      boostLeft--;
      if (boostLeft === 0) {
        boostInd.hidden = true;
        boostInd.classList.remove("active");
      }
    }

    if (running) syncLoop();
    draw();
  }

  // ---- Drawing ------------------------------------------------------------
  function draw() {
    // background
    ctx.fillStyle = "#181f33";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // grid
    ctx.strokeStyle = "#232c45";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(canvas.width, y * CELL + 0.5);
      ctx.stroke();
    }

    rocks.forEach((r) => drawRock(r));
    if (boost) drawBoost(boost);
    if (food) drawApple(food);
    drawSnake();
  }

  function drawApple(pos) {
    const cx = pos.x * CELL + CELL / 2;
    const cy = pos.y * CELL + CELL / 2;
    const r = CELL * 0.34;

    // squished body: horizontal ellipse, a fat oval apple
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.ellipse(cx, cy + CELL * 0.06, r, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();

    // shine
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.3, cy - r * 0.35, r * 0.22, r * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // stem
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.2, cy - r * 0.55);
    ctx.lineTo(cx + r * 0.32, cy - r * 0.85);
    ctx.stroke();

    // leaf
    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.5, cy - r * 0.72, r * 0.3, r * 0.16, -0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBoost(pos) {
    const cx = pos.x * CELL + CELL / 2;
    const cy = pos.y * CELL + CELL / 2;
    const R = CELL * 0.4;

    // twinkle behind
    ctx.fillStyle = "rgba(250,204,21,0.25)";
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2);
    ctx.fill();

    // golden star
    ctx.fillStyle = "#facc15";
    ctx.strokeStyle = "#ca8a04";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? R : R * 0.45;
      const px = cx + Math.cos(ang) * rad;
      const py = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawRock(pos) {
    const x = pos.x * CELL;
    const y = pos.y * CELL;
    ctx.fillStyle = "#475569";
    ctx.beginPath();
    ctx.moveTo(x + 5, y + CELL - 6);
    ctx.lineTo(x + 8, y + 5);
    ctx.lineTo(x + CELL - 10, y + 3);
    ctx.lineTo(x + CELL - 4, y + CELL - 8);
    ctx.closePath();
    ctx.fill();

    // facet highlights
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 5);
    ctx.lineTo(x + CELL - 10, y + 3);
    ctx.lineTo(x + CELL - 4, y + CELL - 8);
    ctx.stroke();

    ctx.strokeStyle = "#334155";
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 5);
    ctx.lineTo(x + 12, y + CELL - 8);
    ctx.lineTo(x + CELL - 10, y + 3);
    ctx.stroke();
  }

  function drawSnake() {
    const n = snake.length;
    for (let i = n - 1; i >= 0; i--) {
      const seg = snake[i];
      const cx = seg.x * CELL + CELL / 2;
      const cy = seg.y * CELL + CELL / 2;

      // taper: width shrinks towards the tail
      const t = i / Math.max(1, n - 1);          // 0 at head, 1 at tail
      const w = CELL * (0.82 - 0.4 * t);          // width of the segment

      if (i === 0) {
        // head — rounded, slightly larger
        ctx.fillStyle = boostLeft > 0 ? "#22d3ee" : "#4ade80";
        ctx.strokeStyle = "#052e16";
        ctx.lineWidth = 2;
        // head circle + direction snout
        ctx.beginPath();
        ctx.arc(cx, cy, CELL * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        drawEyes(cx, cy, dir);
      } else {
        // body — tapered ellipses, slightly rounded toward tail
        ctx.fillStyle = i % 2 === 0 ? "#22c55e" : "#16a34a";
        const prev = snake[i - 1];
        const px = prev.x * CELL + CELL / 2;
        const py = prev.y * CELL + CELL / 2;
        // rounded joint between neighbours
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = w;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(cx, cy);
        ctx.stroke();

        // belly highlight on odd segments
        if (i % 2 === 0) {
          ctx.fillStyle = "rgba(255,255,255,0.12)";
          ctx.beginPath();
          ctx.ellipse(cx, cy, w * 0.32, w * 0.22, 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // tail tip
    const tail = snake[n - 1];
    const tx = tail.x * CELL + CELL / 2;
    const ty = tail.y * CELL + CELL / 2;
    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.arc(tx, ty, CELL * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEyes(hx, hy, d) {
    const off = CELL * 0.18;
    const perp = { x: -d.y, y: d.x };
    const e1 = { x: hx + d.x * off + perp.x * off, y: hy + d.y * off + perp.y * off };
    const e2 = { x: hx + d.x * off - perp.x * off, y: hy + d.y * off - perp.y * off };
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(e1.x, e1.y, CELL * 0.11, 0, Math.PI * 2);
    ctx.arc(e2.x, e2.y, CELL * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#052e16";
    ctx.beginPath();
    ctx.arc(e1.x + d.x * 3, e1.y + d.y * 3, CELL * 0.05, 0, Math.PI * 2);
    ctx.arc(e2.x + d.x * 3, e2.y + d.y * 3, CELL * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Input --------------------------------------------------------------
  function keydown(e) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
      e.preventDefault();
    }

    if (e.key === "m" || e.key === "M") {
      toggleMute();
      return;
    }

    if (gameOver) {
      if (e.key === "Enter" || e.key === " " || e.key === "r") {
        reset();
        start();
      }
      return;
    }

    if (e.key === "p" || e.key === "P") {
      if (running) showPause(!paused);
      return;
    }

    if (!running || paused) {
      const d = DIRS[e.key];
      if (d && !running) {
        start(d);
      } else if ((e.key === "Enter" || e.key === " ") && !running) {
        start();
      }
      return;
    }

    const d = DIRS[e.key];
    if (d && (d.x !== -dir.x || d.y !== -dir.y)) {
      nextDir = d;
    }
  }

  muteInd.addEventListener("click", toggleMute);
  document.addEventListener("keydown", keydown);

  reset();
})();
