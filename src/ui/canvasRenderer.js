import { angleToVector, logicalToCanvas } from "../simulation/geometry.js";

const CANVAS_SIZE = { width: 760, height: 520 };
const SPRITE_ROLES = ["son", "enemy"];
const SPRITE_STATES = ["idle", "walking", "shooting", "dying"];
const SPRITE_RENDER_INTERVAL_MS = 80;
const SPRITE_MIN_HEIGHT = 52;
const SPRITE_MAX_HEIGHT = 96;
const SPRITE_HEIGHT_UNITS = 13;
const spriteCache = new Map();

function assetPath(path) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.endsWith("/") ? base : `${base}/`}${path}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function configureImageSmoothing(ctx) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}

function normalizeSpriteFrames(frames) {
  const values = Array.isArray(frames)
    ? frames.map((frame, index) => [`frame_${String(index).padStart(3, "0")}`, frame])
    : Object.entries(frames).sort(([first], [second]) => first.localeCompare(second));

  return values.map(([name, item]) => ({
    name,
    ...item.frame,
    duration: Number(item.duration) || 80,
  }));
}

function loadSprite(role, state) {
  const key = `${role}-${state}`;
  if (spriteCache.has(key)) {
    return spriteCache.get(key);
  }

  const entry = {
    status: "loading",
    sprite: null,
    promise: null,
  };
  spriteCache.set(key, entry);

  entry.promise = Promise.all([
    fetch(assetPath(`sprites/${key}.json`)).then((response) => {
      if (!response.ok) {
        throw new Error(`Sprite metadata missing: ${key}`);
      }
      return response.json();
    }),
    loadImage(assetPath(`sprites/${key}.png`)),
  ])
    .then(([metadata, image]) => {
      const frames = normalizeSpriteFrames(metadata.frames);
      entry.status = "ready";
      entry.sprite = {
        key,
        image,
        frames,
        totalDuration: frames.reduce((total, frame) => total + frame.duration, 0),
      };
    })
    .catch(() => {
      entry.status = "error";
      entry.sprite = null;
    });

  return entry;
}

function preloadSprites() {
  return Promise.allSettled(
    SPRITE_ROLES.flatMap((role) => SPRITE_STATES.map((state) => loadSprite(role, state).promise))
  );
}

function getSpriteState(character) {
  if (!character.alive || character.state === "desativado") {
    return "dying";
  }
  if (character.state === "andando") {
    return "walking";
  }
  if (character.state === "disparando") {
    return "shooting";
  }
  return "idle";
}

function isCharacterDefeated(character) {
  return !character.alive || character.energy <= 0 || character.state === "desativado";
}

function getSpriteFrame(sprite, now, options = {}) {
  if (!sprite || sprite.frames.length === 0) {
    return null;
  }

  if (options.freezeAtLastFrame) {
    return sprite.frames.at(-1);
  }

  let cursor = now % sprite.totalDuration;
  for (const frame of sprite.frames) {
    if (cursor <= frame.duration) {
      return frame;
    }
    cursor -= frame.duration;
  }
  return sprite.frames.at(-1);
}

function getSpriteBounds(character, arena, viewport, isPlayer, now) {
  const point = logicalToCanvas(character, arena, viewport);
  const role = isPlayer ? "son" : "enemy";
  const state = getSpriteState(character);
  const entry = loadSprite(role, state);
  const sprite = entry.status === "ready" ? entry.sprite : null;
  const frame = getSpriteFrame(sprite, now, {
    freezeAtLastFrame: state === "dying" && isCharacterDefeated(character),
  });
  const scale = viewport.width / arena.width;
  const height = Math.max(SPRITE_MIN_HEIGHT, Math.min(SPRITE_MAX_HEIGHT, scale * SPRITE_HEIGHT_UNITS));
  const width = frame ? height * (frame.w / frame.h) : height * 0.58;
  const pixelRatio = window.devicePixelRatio || 1;
  const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
  const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
  const drawWidth = pixelWidth / pixelRatio;
  const drawHeight = pixelHeight / pixelRatio;

  return {
    character,
    entry,
    frame,
    sprite,
    point,
    x: Math.round((point.x - drawWidth / 2) * pixelRatio) / pixelRatio,
    y: Math.round((point.y - drawHeight / 2) * pixelRatio) / pixelRatio,
    width: drawWidth,
    height: drawHeight,
    pixelWidth,
    pixelHeight,
    labelY: point.y + drawHeight / 2 + 12,
  };
}

function ensureStage(canvas) {
  if (canvas.parentElement?.classList.contains("arena-stage")) {
    return {
      stage: canvas.parentElement,
      spriteLayer: canvas.parentElement.querySelector(".arena-sprite-layer"),
    };
  }

  const stage = document.createElement("div");
  stage.className = "arena-stage";
  const spriteLayer = document.createElement("div");
  spriteLayer.className = "arena-sprite-layer";
  canvas.before(stage);
  stage.append(canvas);
  stage.append(spriteLayer);
  return { stage, spriteLayer };
}

function setupCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width || CANVAS_SIZE.width));
  const height = Math.max(260, Math.floor(rect.height || CANVAS_SIZE.height));
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  configureImageSmoothing(ctx);
  return { ctx, viewport: { width, height } };
}

function drawSensor(ctx, character, arena, viewport, options = {}) {
  if (!character.alive) {
    return;
  }
  const center = logicalToCanvas(character, arena, viewport);
  const scale = viewport.width / arena.width;
  const radius = (options.range ?? 86) * scale;
  const angle = (-character.angle * Math.PI) / 180;
  const aperture = ((options.aperture ?? 26) * Math.PI) / 180;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  ctx.arc(center.x, center.y, radius, angle - aperture / 2, angle + aperture / 2);
  ctx.closePath();
  ctx.fillStyle = options.fillStyle ?? "rgba(49, 130, 206, 0.12)";
  ctx.fill();
  ctx.strokeStyle = options.strokeStyle ?? "rgba(49, 130, 206, 0.28)";
  ctx.stroke();
  ctx.restore();
}

function shouldDrawOpponentSensor(opponent) {
  return opponent.alive && ["mirando", "disparando"].includes(opponent.state);
}

function drawArenaBackground(ctx, arena, viewport) {
  ctx.clearRect(0, 0, viewport.width, viewport.height);
  const gradient = ctx.createLinearGradient(0, 0, viewport.width, viewport.height);
  gradient.addColorStop(0, "#f7fafc");
  gradient.addColorStop(1, "#eef2ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  ctx.strokeStyle = "rgba(31, 41, 55, 0.12)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= arena.width; x += 10) {
    const point = logicalToCanvas({ x, y: 0 }, arena, viewport);
    ctx.beginPath();
    ctx.moveTo(point.x, 0);
    ctx.lineTo(point.x, viewport.height);
    ctx.stroke();
  }
  for (let y = 0; y <= arena.height; y += 10) {
    const point = logicalToCanvas({ x: 0, y }, arena, viewport);
    ctx.beginPath();
    ctx.moveTo(0, point.y);
    ctx.lineTo(viewport.width, point.y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, viewport.width - 2, viewport.height - 2);
}

function drawObstacles(ctx, snapshot, viewport) {
  ctx.save();
  ctx.fillStyle = "#475569";
  ctx.strokeStyle = "#1f2937";
  for (const obstacle of snapshot.arena.obstacles) {
    const topLeft = logicalToCanvas(
      { x: obstacle.x, y: obstacle.y + obstacle.height },
      snapshot.arena,
      viewport
    );
    const bottomRight = logicalToCanvas(
      { x: obstacle.x + obstacle.width, y: obstacle.y },
      snapshot.arena,
      viewport
    );
    ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  }
  ctx.restore();
}

function drawEffects(ctx, snapshot, viewport) {
  ctx.save();
  for (const trail of snapshot.trails ?? []) {
    const from = logicalToCanvas(trail.from, snapshot.arena, viewport);
    const to = logicalToCanvas(trail.to, snapshot.arena, viewport);
    ctx.strokeStyle = `rgba(15, 118, 110, ${Math.min(0.35, trail.life / 50)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
  for (const projectile of snapshot.projectiles ?? []) {
    const from = logicalToCanvas(projectile.from, snapshot.arena, viewport);
    const to = logicalToCanvas(projectile.to, snapshot.arena, viewport);
    const alpha = Math.max(0.22, Math.min(1, (projectile.life ?? 12) / 12));
    ctx.strokeStyle = projectile.hit ? `rgba(220, 38, 38, ${alpha})` : `rgba(245, 158, 11, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
  for (const impact of snapshot.impacts ?? []) {
    const point = logicalToCanvas(impact, snapshot.arena, viewport);
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 20 - impact.life, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function cloneSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot));
}

function buildReplayEffects(snapshot, progress) {
  const recentEvents = (snapshot.events ?? []).slice(-8);
  const projectiles = [];
  const impacts = [];
  const life = Math.max(1, Math.round(12 * (1 - progress)));

  for (const event of recentEvents) {
    if (event.type === "hit" && event.targetId && event.targetId !== "player") {
      const target = snapshot.opponents.find((opponent) => opponent.id === event.targetId);
      if (!target) {
        continue;
      }
      projectiles.push({
        from: { x: snapshot.player.x, y: snapshot.player.y },
        to: { x: target.x, y: target.y },
        ownerId: "player",
        hit: true,
        life,
      });
      impacts.push({ x: target.x, y: target.y, life: Math.max(2, life) });
    }

    if (event.type === "miss") {
      const vector = angleToVector(event.angle ?? snapshot.player.angle);
      const distance = Math.min(Number(event.distance) || 56, 62);
      projectiles.push({
        from: { x: snapshot.player.x, y: snapshot.player.y },
        to: {
          x: snapshot.player.x + vector.x * distance,
          y: snapshot.player.y + vector.y * distance,
        },
        ownerId: "player",
        hit: false,
        life,
      });
    }
  }

  return { projectiles, impacts };
}

function makeReplayFrame(snapshot, progress) {
  const frame = cloneSnapshot(snapshot);
  const effects = buildReplayEffects(snapshot, progress);
  frame.projectiles = [...effects.projectiles, ...(frame.projectiles ?? [])];
  frame.impacts = [...effects.impacts, ...(frame.impacts ?? [])];
  if (effects.projectiles.length > 0 && frame.player.alive) {
    frame.player.state = "disparando";
  }
  return frame;
}

function drawSuccessOverlay(ctx, snapshot, viewport, progress) {
  const alpha = 1 - progress;
  const points = [
    snapshot.player,
    ...(snapshot.opponents ?? []).filter((opponent) => !opponent.alive || opponent.energy <= 0),
  ];
  const targets = points.length > 0 ? points.slice(-4) : [{ x: snapshot.arena.width / 2, y: snapshot.arena.height / 2 }];

  ctx.save();
  ctx.fillStyle = `rgba(47, 133, 90, ${0.16 * alpha})`;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  for (const target of targets) {
    const point = logicalToCanvas(target, snapshot.arena, viewport);
    ctx.strokeStyle = `rgba(47, 133, 90, ${alpha})`;
    ctx.lineWidth = 9 * alpha + 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 18 + progress * 130, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(34, 197, 94, ${0.22 * alpha})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 10 + progress * 36, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function getEnergyClass(character) {
  const ratio = Math.max(0, character.energy / character.maxEnergy);
  if (ratio > 0.55) {
    return "high";
  }
  if (ratio > 0.25) {
    return "medium";
  }
  return "low";
}

function updateSpriteElement(bounds, spriteLayer) {
  const { character, frame, sprite } = bounds;
  const characterId = String(character.id);
  let element = [...spriteLayer.children].find((node) => node.dataset.characterId === characterId);
  if (!element) {
    element = document.createElement("figure");
    element.className = "arena-character";
    element.dataset.characterId = characterId;
    element.innerHTML = `
      <div class="arena-character-sprite" aria-hidden="true"></div>
      <figcaption class="arena-character-caption">
        <span class="arena-character-name"></span>
        <span class="arena-character-energy" aria-hidden="true"><span></span></span>
      </figcaption>
    `;
    spriteLayer.append(element);
  }

  element.dataset.alive = character.alive ? "true" : "false";
  element.style.width = `${bounds.width}px`;
  element.style.height = `${bounds.height + 22}px`;
  element.style.transform = `translate3d(${bounds.x}px, ${bounds.y}px, 0)`;
  element.style.zIndex = String(Math.round(bounds.point.y));

  const spriteNode = element.querySelector(".arena-character-sprite");
  spriteNode.style.width = `${bounds.width}px`;
  spriteNode.style.height = `${bounds.height}px`;

  if (sprite && frame) {
    const scale = bounds.height / frame.h;
    spriteNode.style.backgroundImage = `url("${assetPath(`sprites/${sprite.key}.png`)}")`;
    spriteNode.style.backgroundSize = `${sprite.image.naturalWidth * scale}px ${
      sprite.image.naturalHeight * scale
    }px`;
    spriteNode.style.backgroundPosition = `${-frame.x * scale}px ${-frame.y * scale}px`;
  } else {
    spriteNode.style.backgroundImage = "";
    spriteNode.style.backgroundSize = "";
    spriteNode.style.backgroundPosition = "";
  }

  element.querySelector(".arena-character-name").textContent = character.name;
  const energy = element.querySelector(".arena-character-energy");
  energy.dataset.level = getEnergyClass(character);
  energy.querySelector("span").style.width = `${Math.max(0, character.energy / character.maxEnergy) * 100}%`;
}

function updateCharacterLayer(spriteLayer, characterBounds) {
  const activeIds = new Set(characterBounds.map((bounds) => String(bounds.character.id)));
  for (const element of [...spriteLayer.querySelectorAll(".arena-character")]) {
    if (!activeIds.has(element.dataset.characterId)) {
      element.remove();
    }
  }
  for (const bounds of characterBounds) {
    updateSpriteElement(bounds, spriteLayer);
  }
}

export function createArenaRenderer(canvas) {
  const { spriteLayer } = ensureStage(canvas);
  let lastSnapshot = null;
  let animationFrame = null;
  let animationResolve = null;
  let spriteAnimationFrame = null;
  let lastSpritePaint = 0;

  function stopSpriteLoop() {
    if (spriteAnimationFrame) {
      window.cancelAnimationFrame(spriteAnimationFrame);
      spriteAnimationFrame = null;
    }
  }

  function startSpriteLoop() {
    if (spriteAnimationFrame || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    function tick(now) {
      if (!lastSnapshot) {
        spriteAnimationFrame = null;
        return;
      }
      if (!animationFrame && now - lastSpritePaint >= SPRITE_RENDER_INTERVAL_MS) {
        paint(lastSnapshot, now);
        lastSpritePaint = now;
      }
      spriteAnimationFrame = window.requestAnimationFrame(tick);
    }

    spriteAnimationFrame = window.requestAnimationFrame(tick);
  }

  function cancelAnimation() {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    if (animationResolve) {
      animationResolve();
      animationResolve = null;
    }
  }

  function render(snapshot) {
    if (!snapshot) {
      return;
    }
    cancelAnimation();
    paint(snapshot);
    startSpriteLoop();
  }

  function paint(snapshot, now = performance.now()) {
    lastSnapshot = snapshot;
    const { ctx, viewport } = setupCanvas(canvas);
    const characterBounds = [
      ...snapshot.opponents.map((opponent) => getSpriteBounds(opponent, snapshot.arena, viewport, false, now)),
      getSpriteBounds(snapshot.player, snapshot.arena, viewport, true, now),
    ];
    drawArenaBackground(ctx, snapshot.arena, viewport);
    drawObstacles(ctx, snapshot, viewport);
    drawSensor(ctx, snapshot.player, snapshot.arena, viewport);
    for (const opponent of snapshot.opponents.filter(shouldDrawOpponentSensor)) {
      drawSensor(ctx, opponent, snapshot.arena, viewport, {
        fillStyle: "rgba(220, 38, 38, 0.10)",
        strokeStyle: "rgba(220, 38, 38, 0.26)",
      });
    }
    drawEffects(ctx, snapshot, viewport);
    updateCharacterLayer(spriteLayer, characterBounds);
    return { ctx, viewport };
  }

  function play(snapshot, options = {}) {
    if (!snapshot) {
      return Promise.resolve();
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      render(snapshot);
      return Promise.resolve();
    }

    cancelAnimation();
    stopSpriteLoop();

    const duration = options.duration ?? 850;

    return new Promise((resolve) => {
      animationResolve = resolve;
      const start = performance.now();

      function animate(now) {
        const progress = Math.min(1, (now - start) / duration);
        paint(progress < 1 ? makeReplayFrame(snapshot, progress) : snapshot);
        if (progress < 1) {
          animationFrame = window.requestAnimationFrame(animate);
        } else {
          animationFrame = null;
          animationResolve = null;
          startSpriteLoop();
          resolve();
        }
      }

      animationFrame = window.requestAnimationFrame(animate);
    });
  }

  function success(snapshot, options = {}) {
    if (!snapshot) {
      return Promise.resolve();
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      render(snapshot);
      return Promise.resolve();
    }

    cancelAnimation();
    stopSpriteLoop();

    const duration = options.duration ?? 1300;

    return new Promise((resolve) => {
      animationResolve = resolve;
      const start = performance.now();

      function animate(now) {
        const progress = Math.min(1, (now - start) / duration);
        const { ctx, viewport } = paint(snapshot);
        drawSuccessOverlay(ctx, snapshot, viewport, progress);
        if (progress < 1) {
          animationFrame = window.requestAnimationFrame(animate);
        } else {
          animationFrame = null;
          animationResolve = null;
          paint(snapshot);
          startSpriteLoop();
          resolve();
        }
      }

      animationFrame = window.requestAnimationFrame(animate);
    });
  }

  function handleResize() {
    render(lastSnapshot);
  }

  function destroy() {
    cancelAnimation();
    stopSpriteLoop();
    window.removeEventListener("resize", handleResize);
    spriteLayer.innerHTML = "";
    lastSnapshot = null;
  }

  void preloadSprites().then(() => {
    if (lastSnapshot) {
      render(lastSnapshot);
    }
  });
  window.addEventListener("resize", handleResize);
  return { render, play, success, stop: cancelAnimation, destroy };
}
