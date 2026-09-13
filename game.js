(() => {
  "use strict";

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMessage = document.getElementById("overlay-message");
  const restartBtn = document.getElementById("restart-btn");

  const GRID = 20;
  const COLS = canvas.width / GRID;
  const ROWS = canvas.height / GRID;
  const BASE_SPEED = 100; // ms per step
  const MIN_SPEED = 40;
  const MAX_SPEED = 400;

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
  const OPPOSITE = {
    "0,1": "0,-1",
    "0,-1": "0,1",
    "1,0": "-1,0",
    "-1,0": "1,0",
  };

  let snake, dir, nextDir, food, score, best, running, paused, gameOver, interval, speed;

  best = Number(localStorage.getItem("snake-best") || 0);
  bestEl.textContent = best;

  function randomFood() {
    const free = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!snake.some((seg) => seg.x === x && seg.y === y)) {
          free.push({ x, y });
        }
      }
    }
    return free[Math.floor(Math.random() * free.length)];
  }

  function setSpeed(ms) {
    speed = ms;
    if (running) {
      clearInterval(interval);
      interval = setInterval(step, speed);
    }
  }

  function reset() {
    snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    running = false;
    paused = false;
    gameOver = false;
    speed = BASE_SPEED;
    scoreEl.textContent = score;
    food = randomFood();
    overlay.style.display = "flex";
    overlayTitle.textContent = "Press any arrow key to start";
    overlayMessage.textContent = "";
    restartBtn.hidden = true;
  }

  function draw() {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = "#263449";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * GRID + 0.5, 0);
      ctx.lineTo(x * GRID + 0.5, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * GRID + 0.5);
      ctx.lineTo(canvas.width, y * GRID + 0.5);
      ctx.stroke();
    }

    // Food
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(food.x * GRID + GRID / 2, food.y * GRID + GRID / 2, GRID / 2 - 3, 0, Math.PI * 2);
    ctx.fill();

    // Snake
    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? "#4ade80" : "#22c55e";
      const pad = 1.5;
      ctx.fillRect(
        seg.x * GRID + pad,
        seg.y * GRID + pad,
        GRID - pad * 2,
        GRID - pad * 2
      );
    });
  }

  function step() {
    dir = nextDir;
    const head = snake[0];
    const newHead = { x: head.x + dir.x, y: head.y + dir.y };

    if (
      newHead.x < 0 || newHead.x >= COLS ||
      newHead.y < 0 || newHead.y >= ROWS ||
      snake.some((seg) => seg.x === newHead.x && seg.y === newHead.y)
    ) {
      endGame();
      return;
    }

    snake.unshift(newHead);
    const ate = newHead.x === food.x && newHead.y === food.y;
    if (ate) {
      score++;
      scoreEl.textContent = score;
      food = randomFood();
    } else {
      snake.pop();
    }

    draw();
  }

  function endGame() {
    gameOver = true;
    running = false;
    clearInterval(interval);
    if (score > best) {
      best = score;
      localStorage.setItem("snake-best", best);
      bestEl.textContent = best;
    }
    overlay.style.display = "flex";
    overlayTitle.textContent = "Game over";
    overlayMessage.textContent = `You scored ${score}. Press Enter or click to play again.`;
    restartBtn.hidden = false;
    restartBtn.focus();
  }

  function start() {
    running = true;
    overlay.style.display = "none";
    interval = setInterval(step, speed);
  }

  function showPause(b) {
    paused = b;
    if (b) {
      clearInterval(interval);
      overlay.style.display = "flex";
      overlayTitle.textContent = "Paused";
      overlayMessage.textContent = "Press P to resume";
      restartBtn.hidden = true;
    } else {
      overlay.style.display = "none";
      interval = setInterval(step, speed);
    }
  }

  function keydown(e) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
      e.preventDefault();
    }

    if (gameOver) {
      if (e.key === "Enter" || e.key === " " || e.key === "r") reset();
      return;
    }

    if (e.key === "p" || e.key === "P") {
      if (running) showPause(!paused);
      return;
    }

    if (!running || paused) {
      const d = DIRS[e.key];
      if (d && !running) {
        nextDir = d;
        start();
      }
      return;
    }

    if (e.key === "-" || e.key === "_") {
      setSpeed(Math.min(speed + 50, MAX_SPEED));
      return;
    }
    if (e.key === "=" || e.key === "+") {
      setSpeed(Math.max(speed - 50, MIN_SPEED));
      return;
    }

    const d = DIRS[e.key];
    if (d && OPPOSITE[`${d.x},${d.y}`] !== `${dir.x},${dir.y}`) {
      nextDir = d;
    }
  }

  document.addEventListener("keydown", keydown);
  restartBtn.addEventListener("click", reset);

  reset();
  draw();
})();