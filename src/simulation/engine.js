import {
  angleBetween,
  angleToVector,
  angularDifference,
  clamp,
  distanceBetween,
  isPointInBeam,
  normalizeAngle,
  segmentIntersectsRect,
} from "./geometry.js";
import { createRng } from "./random.js";
import { ActionLimitReached, SimulationUserError } from "./errors.js";

const SENSOR_RANGE = 86;
const SENSOR_APERTURE = 26;
const WEAPON_RANGE = 62;
const WEAPON_APERTURE = 18;
const DISTANCE_TOLERANCE = 8;
const PLAYER_DAMAGE = 35;
const OPPONENT_DAMAGE = 12;
const PLAYER_COOLDOWN = 4;
const OPPONENT_COOLDOWN = 8;
const MAX_WAIT_CYCLES = 80;
const MAX_SPEED = 60;
const MIN_DISTANCE = 0;
const MAX_DISTANCE = 160;
const MAX_CYCLES_DEFAULT = 320;

function round1(value) {
  return Math.round(value * 10) / 10;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pickPosition(config, rng) {
  if (Array.isArray(config.positions) && config.positions.length > 0) {
    return rng.pick(config.positions);
  }
  const x = Array.isArray(config.xRange) ? round1(rng.between(config.xRange[0], config.xRange[1])) : config.x;
  const y = Array.isArray(config.yRange) ? round1(rng.between(config.yRange[0], config.yRange[1])) : config.y;
  return { x, y };
}

function makeCharacter(config, rng, role) {
  const position = pickPosition(config, rng);
  const energy = config.energy ?? 100;
  return {
    id: config.id ?? role,
    name: config.name ?? (role === "player" ? "Filho de Maria" : "Adversário"),
    x: position.x,
    y: position.y,
    angle: normalizeAngle(config.angle ?? 0),
    speed: config.speed ?? 0,
    energy,
    maxEnergy: energy,
    alive: config.alive ?? true,
    cooldown: config.cooldown ?? 0,
    radius: config.radius ?? (role === "player" ? 3.4 : 3.2),
    ai: config.ai ?? "static",
    state: "parado",
    aiState: { phase: 0, origin: position },
  };
}

function expandRect(rect, amount = 0) {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

export class SimulationEngine {
  constructor(level, options = {}) {
    this.level = level;
    this.options = {
      maxActions: level.goals?.maxActions ?? 200,
      maxCycles: level.success?.maxCycles ?? MAX_CYCLES_DEFAULT,
      ...options,
    };
    this.rng = createRng(level.seed ?? 1);
    this.arena = {
      width: level.arena.width ?? 100,
      height: level.arena.height ?? 100,
      obstacles: clone(level.arena.obstacles ?? []),
    };
    this.player = makeCharacter(
      { id: "player", name: "Filho de Maria", radius: 3.6, ...level.arena.player },
      this.rng,
      "player"
    );
    this.opponents = (level.arena.opponents ?? []).map((opponent) =>
      makeCharacter(opponent, this.rng, "opponent")
    );
    this.projectiles = [];
    this.impacts = [];
    this.trails = [];
    this.events = [];
    this.cycle = 0;
    this.actionCount = 0;
    this.commands = {};
    this.currentLine = null;
    this.stats = {
      shotsFired: 0,
      hits: 0,
      distanceMoved: 0,
      playerDamageTaken: 0,
    };
  }

  setCurrentLine(line) {
    this.currentLine = Number.isFinite(Number(line)) ? Number(line) : null;
  }

  log(type, message, data = {}) {
    this.events.push({
      cycle: this.cycle,
      type,
      message,
      line: this.currentLine,
      ...data,
    });
    if (this.events.length > 120) {
      this.events.shift();
    }
  }

  recordAction(command) {
    this.actionCount += 1;
    this.commands[command] = (this.commands[command] ?? 0) + 1;
    if (this.actionCount > this.options.maxActions) {
      throw new ActionLimitReached(
        "Seu programa executou ações demais. Verifique se existe uma repetição que nunca chega ao fim."
      );
    }
  }

  advanceFinalTurn() {
    if (this.level.type === "final" || this.level.id === "fase-10") {
      this.tick(1);
    }
  }

  validateAngle(angle) {
    const numeric = Number(angle);
    if (!Number.isFinite(numeric)) {
      throw new SimulationUserError(
        "invalid-angle",
        "O ângulo precisa ser um número entre 0 e 359.",
        this.currentLine
      );
    }
    return normalizeAngle(numeric);
  }

  validateDistance(distance) {
    if (distance === null || distance === undefined) {
      return null;
    }
    const numeric = Number(distance);
    if (!Number.isFinite(numeric) || numeric < MIN_DISTANCE || numeric > MAX_DISTANCE) {
      throw new SimulationUserError(
        "invalid-distance",
        "A distância precisa ser um número positivo dentro do território.",
        this.currentLine
      );
    }
    return numeric;
  }

  validateSpeed(speed) {
    const numeric = Number(speed);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > MAX_SPEED) {
      throw new SimulationUserError(
        "invalid-speed",
        "A velocidade precisa ser um número entre 0 e 60.",
        this.currentLine
      );
    }
    return numeric;
  }

  detectar(angle) {
    this.recordAction("detectar");
    const sensorAngle = this.validateAngle(angle);
    this.player.angle = sensorAngle;
    this.player.state = "mirando";
    const visible = this.opponents
      .filter((opponent) => opponent.alive)
      .filter((opponent) =>
        isPointInBeam(this.player, opponent, sensorAngle, SENSOR_RANGE, SENSOR_APERTURE)
      )
      .filter((opponent) => !this.isLineBlocked(this.player, opponent))
      .sort((a, b) => distanceBetween(this.player, a) - distanceBetween(this.player, b));

    if (visible.length === 0) {
      this.log("sensor", `Sensor em ${sensorAngle} graus não encontrou alvo.`);
      this.advanceFinalTurn();
      return null;
    }

    const target = visible[0];
    const distance = round1(distanceBetween(this.player, target));
    this.log("sensor", `Sensor encontrou ${target.name} a ${distance}.`, {
      targetId: target.id,
      angle: sensorAngle,
      distance,
    });
    this.advanceFinalTurn();
    return distance;
  }

  atirar(angle = this.player.angle, distance = null) {
    this.recordAction("atirar");
    const shotAngle = this.validateAngle(angle);
    const expectedDistance = this.validateDistance(distance);
    this.player.angle = shotAngle;
    this.player.state = "disparando";

    if (this.player.cooldown > 0) {
      this.log("cooldown", "O disparo ainda está recarregando.", { command: "atirar" });
      this.tick(1);
      return false;
    }

    this.stats.shotsFired += 1;
    this.player.cooldown = PLAYER_COOLDOWN;
    const hit = this.hitFromTo(this.player, this.opponents, shotAngle, expectedDistance, PLAYER_DAMAGE);
    this.tick(1);
    return hit;
  }

  mover(angle, speed) {
    this.recordAction("mover");
    this.player.angle = this.validateAngle(angle);
    this.player.speed = this.validateSpeed(speed);
    this.player.state = this.player.speed > 0 ? "andando" : "parado";
    this.log("move", `Filho de Maria começou a mover a ${this.player.speed}.`, {
      angle: this.player.angle,
      speed: this.player.speed,
    });
    this.tick(1);
  }

  esperar(cycles = 1) {
    this.recordAction("esperar");
    const numeric = Number(cycles ?? 1);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > MAX_WAIT_CYCLES) {
      throw new SimulationUserError(
        "invalid-wait",
        "esperar recebe uma quantidade inteira de ciclos entre 1 e 80.",
        this.currentLine
      );
    }
    this.tick(numeric);
  }

  parar() {
    this.recordAction("parar");
    this.player.speed = 0;
    this.player.state = "parado";
    this.log("stop", "Filho de Maria parou.");
    this.tick(1);
  }

  posicao_x() {
    this.recordAction("posicao_x");
    const value = round1(this.player.x);
    this.advanceFinalTurn();
    return value;
  }

  posicao_y() {
    this.recordAction("posicao_y");
    const value = round1(this.player.y);
    this.advanceFinalTurn();
    return value;
  }

  energia() {
    this.recordAction("energia");
    const value = round1(this.player.energy);
    this.advanceFinalTurn();
    return value;
  }

  inimigos_ativos() {
    this.recordAction("inimigos_ativos");
    const value = this.opponents.filter((opponent) => opponent.alive).length;
    this.advanceFinalTurn();
    return value;
  }

  ciclo_atual() {
    this.recordAction("ciclo_atual");
    const value = this.cycle;
    this.advanceFinalTurn();
    return value;
  }

  tick(cycles = 1) {
    for (let index = 0; index < cycles; index += 1) {
      if (this.isFinished()) {
        return;
      }
      this.cycle += 1;
      this.updateCooldowns();
      this.updateMovement(this.player, true);
      this.updateOpponents();
      this.updateVisualEffects();
      if (this.cycle >= this.options.maxCycles) {
        this.log("timeout", "A batalha chegou ao limite de ciclos.");
        return;
      }
    }
  }

  updateCooldowns() {
    for (const character of [this.player, ...this.opponents]) {
      if (character.cooldown > 0) {
        character.cooldown -= 1;
      }
    }
  }

  updateMovement(character, trackDistance = false) {
    if (!character.alive || character.speed <= 0) {
      if (character.alive && character.state === "andando") {
        character.state = "parado";
      }
      return;
    }

    const vector = angleToVector(character.angle);
    const step = character.speed / 10;
    const previous = { x: character.x, y: character.y };
    const next = {
      x: clamp(character.x + vector.x * step, character.radius, this.arena.width - character.radius),
      y: clamp(character.y + vector.y * step, character.radius, this.arena.height - character.radius),
    };

    const blocked = this.arena.obstacles.some((obstacle) =>
      segmentIntersectsRect(previous, next, expandRect(obstacle, character.radius))
    );

    if (blocked) {
      character.speed = 0;
      character.state = "parado";
      this.log("collision", `${character.name} encontrou um obstáculo.`, { characterId: character.id });
      return;
    }

    character.x = next.x;
    character.y = next.y;
    character.state = "andando";
    const moved = distanceBetween(previous, next);
    if (trackDistance) {
      this.stats.distanceMoved += moved;
    }
    this.trails.push({ from: previous, to: next, life: 18, ownerId: character.id });
  }

  updateOpponents() {
    for (const opponent of this.opponents) {
      if (!opponent.alive) {
        opponent.speed = 0;
        opponent.state = "desativado";
        continue;
      }

      if (opponent.ai === "static") {
        opponent.state = "parado";
      }
      if (opponent.ai === "guard") {
        opponent.angle = normalizeAngle(opponent.angle + 18);
        opponent.state = "mirando";
        this.opponentTryFire(opponent);
      }
      if (opponent.ai === "sentinel") {
        this.updateSentinel(opponent);
      }
      if (opponent.ai === "patrol") {
        this.updatePatrol(opponent);
      }
      if (opponent.ai === "evasive") {
        this.updateEvasive(opponent);
      }
    }
  }

  updateSentinel(opponent) {
    const state = opponent.aiState;
    state.scanAngle ??= opponent.angle;
    state.lastEnergy ??= opponent.energy;

    if (opponent.energy < state.lastEnergy) {
      state.lastEnergy = opponent.energy;
      state.scanAngle = normalizeAngle(state.scanAngle + 90);
    }

    opponent.speed = 0;

    const playerDistance = this.player.alive ? distanceBetween(opponent, this.player) : Infinity;
    if (playerDistance <= SENSOR_RANGE && !this.isLineBlocked(opponent, this.player)) {
      opponent.angle = angleBetween(opponent, this.player);
      opponent.state = "mirando";
      this.opponentTryFire(opponent);
      state.scanAngle = normalizeAngle(opponent.angle + 5);
      return;
    }

    opponent.angle = normalizeAngle(state.scanAngle);
    opponent.state = "mirando";
    this.opponentTryFire(opponent);
    state.scanAngle = normalizeAngle(state.scanAngle + 5);
  }

  updatePatrol(opponent) {
    const state = opponent.aiState;
    state.course ??= 180;
    state.boundary ??= 24;

    for (const angle of [0, 90, 180, 270]) {
      opponent.angle = angle;
      opponent.state = "mirando";
      if (this.opponentTryFire(opponent)) {
        opponent.speed = 0;
        return;
      }
    }

    if (state.course === 0 && opponent.x >= state.boundary) {
      state.course = 180;
      state.boundary = 24;
    } else if (state.course === 180 && opponent.x <= state.boundary) {
      state.course = 0;
      state.boundary = 90;
    }

    opponent.angle = state.course;
    opponent.speed = 22;
    opponent.state = "andando";
    const previousSpeed = opponent.speed;
    this.updateMovement(opponent);
    if (previousSpeed > 0 && opponent.speed === 0) {
      state.course = state.course === 0 ? 180 : 0;
      state.boundary = state.course === 0 ? 90 : 24;
    }
  }

  updateEvasive(opponent) {
    const state = opponent.aiState;
    state.scanAngle ??= opponent.angle;
    state.lastEnergy ??= opponent.energy;
    state.lastRunDirection ??= 90;

    const wasHit = opponent.energy < state.lastEnergy;
    if (wasHit) {
      state.lastEnergy = opponent.energy;
      state.lastRunDirection = normalizeAngle(state.lastRunDirection + 90);
      opponent.angle = state.lastRunDirection;
      opponent.speed = 32;
      opponent.state = "andando";
      this.updateMovement(opponent);
      return;
    }

    const scanAngle = normalizeAngle(state.scanAngle);
    state.scanAngle = normalizeAngle(state.scanAngle + 5);
    opponent.angle = scanAngle;
    opponent.state = "mirando";

    const distance = this.opponentScanDistance(opponent, scanAngle);
    if (distance !== null && distance <= WEAPON_RANGE) {
      opponent.speed = 0;
      this.opponentTryFire(opponent);
      return;
    }

    if (distance !== null) {
      opponent.speed = 20;
      this.updateMovement(opponent);
      return;
    }

    const playerDistance = distanceBetween(opponent, this.player);
    if (playerDistance < 34 && !this.isLineBlocked(opponent, this.player)) {
      opponent.angle = angleBetween(this.player, opponent);
      opponent.speed = 30;
    } else {
      opponent.angle = normalizeAngle(opponent.angle + 18);
      opponent.speed = 8;
    }
    opponent.state = "andando";
    this.updateMovement(opponent);
  }

  opponentScanDistance(opponent, angle) {
    if (!this.player.alive) {
      return null;
    }
    if (!isPointInBeam(opponent, this.player, angle, SENSOR_RANGE, SENSOR_APERTURE + 12)) {
      return null;
    }
    if (this.isLineBlocked(opponent, this.player)) {
      return null;
    }
    return round1(distanceBetween(opponent, this.player));
  }

  opponentTryFire(opponent) {
    if (!this.player.alive || opponent.cooldown > 0) {
      return false;
    }
    const angle = angleBetween(opponent, this.player);
    if (!isPointInBeam(opponent, this.player, opponent.angle, WEAPON_RANGE, WEAPON_APERTURE + 8)) {
      return false;
    }
    if (this.isShotBlocked(opponent, this.player)) {
      this.log("blocked-shot", "A parede bloqueou o disparo adversário.", { shooterId: opponent.id });
      return false;
    }
    opponent.angle = angle;
    opponent.state = "disparando";
    opponent.cooldown = OPPONENT_COOLDOWN;
    this.projectiles.push({
      from: { x: opponent.x, y: opponent.y },
      to: { x: this.player.x, y: this.player.y },
      ownerId: opponent.id,
      life: 12,
      hit: true,
    });
    this.player.energy = Math.max(0, this.player.energy - OPPONENT_DAMAGE);
    this.stats.playerDamageTaken += OPPONENT_DAMAGE;
    this.player.state = this.player.energy <= 0 ? "desativado" : "atingido";
    this.log("hit", `${opponent.name} acertou Filho de Maria.`, {
      targetId: "player",
      shooterId: opponent.id,
    });
    if (this.player.energy <= 0) {
      this.player.alive = false;
      this.log("defeat", "Filho de Maria foi desativado.");
    }
    return true;
  }

  isLineBlocked(from, to) {
    return this.arena.obstacles.some((obstacle) => segmentIntersectsRect(from, to, obstacle));
  }

  isShotBlocked(from, to) {
    return this.isLineBlocked(from, to);
  }

  hitFromTo(shooter, targets, angle, expectedDistance, damage) {
    const candidates = targets
      .filter((target) => target.alive)
      .map((target) => {
        const realDistance = distanceBetween(shooter, target);
        return {
          target,
          realDistance,
          realAngle: angleBetween(shooter, target),
        };
      })
      .filter(({ realDistance, realAngle }) => {
        const angleOk = angularDifference(angle, realAngle) <= WEAPON_APERTURE / 2;
        const rangeOk = realDistance <= WEAPON_RANGE;
        const distanceOk =
          expectedDistance === null || Math.abs(expectedDistance - realDistance) <= DISTANCE_TOLERANCE;
        return angleOk && rangeOk && distanceOk;
      })
      .filter(({ target }) => {
        const blocked = this.isShotBlocked(shooter, target);
        if (blocked) {
          this.log("blocked-shot", "A parede bloqueou o disparo.", { targetId: target.id });
        }
        return !blocked;
      })
      .sort((a, b) => a.realDistance - b.realDistance);

    const end = angleToVector(angle);
    const shotEnd =
      candidates[0]?.target ?? {
        x: shooter.x + end.x * Math.min(expectedDistance ?? WEAPON_RANGE, WEAPON_RANGE),
        y: shooter.y + end.y * Math.min(expectedDistance ?? WEAPON_RANGE, WEAPON_RANGE),
      };

    this.projectiles.push({
      from: { x: shooter.x, y: shooter.y },
      to: { x: shotEnd.x, y: shotEnd.y },
      ownerId: shooter.id,
      life: 12,
      hit: Boolean(candidates[0]),
    });

    if (!candidates[0]) {
      this.log("miss", `Disparo em ${round1(angle)} graus não acertou.`, {
        angle,
        distance: expectedDistance,
      });
      return false;
    }

    const target = candidates[0].target;
    target.energy = Math.max(0, target.energy - damage);
    target.state = target.energy <= 0 ? "desativado" : "atingido";
    this.stats.hits += 1;
    this.impacts.push({ x: target.x, y: target.y, life: 14 });
    this.log("hit", `Disparo acertou ${target.name}.`, {
      targetId: target.id,
      distance: round1(candidates[0].realDistance),
    });
    if (target.energy <= 0) {
      target.alive = false;
      target.speed = 0;
      this.log("disabled", `${target.name} foi desativado.`, { targetId: target.id });
    }
    return true;
  }

  updateVisualEffects() {
    this.projectiles = this.projectiles
      .map((projectile) => ({ ...projectile, life: projectile.life - 1 }))
      .filter((projectile) => projectile.life > 0);
    this.impacts = this.impacts
      .map((impact) => ({ ...impact, life: impact.life - 1 }))
      .filter((impact) => impact.life > 0);
    this.trails = this.trails
      .map((trail) => ({ ...trail, life: trail.life - 1 }))
      .filter((trail) => trail.life > 0);
  }

  isFinished() {
    return this.getOutcome().status !== "running";
  }

  getOutcome() {
    const aliveOpponents = this.opponents.filter((opponent) => opponent.alive).length;
    if (!this.player.alive || this.player.energy <= 0) {
      return { status: "defeat", reason: "player-disabled" };
    }
    if (aliveOpponents === 0) {
      return { status: "victory", reason: "all-opponents-disabled" };
    }
    if (this.cycle >= this.options.maxCycles) {
      return { status: "defeat", reason: "cycle-limit" };
    }
    return { status: "running", reason: "in-progress" };
  }

  getFinalClassification() {
    const outcome = this.getOutcome();
    if (outcome.status !== "victory") {
      return "Tentativa incompleta";
    }
    const energyRatio = this.player.energy / this.player.maxEnergy;
    if (energyRatio >= 0.75 && this.stats.shotsFired <= this.opponents.length * 3) {
      return "Excelente";
    }
    if (energyRatio >= 0.4) {
      return "Boa estratégia";
    }
    return "Vitória apertada";
  }

  snapshot() {
    return {
      arena: clone(this.arena),
      player: clone(this.player),
      opponents: clone(this.opponents),
      projectiles: clone(this.projectiles),
      impacts: clone(this.impacts),
      trails: clone(this.trails),
      cycle: this.cycle,
      actionCount: this.actionCount,
      commands: clone(this.commands),
      events: clone(this.events),
      stats: {
        shotsFired: this.stats.shotsFired,
        hits: this.stats.hits,
        distanceMoved: round1(this.stats.distanceMoved),
        playerDamageTaken: this.stats.playerDamageTaken,
        energyRemaining: round1(this.player.energy),
        simulatedTime: round1(this.cycle / 10),
        classification: this.getFinalClassification(),
      },
      outcome: this.getOutcome(),
    };
  }
}

export function createSimulation(level, options = {}) {
  return new SimulationEngine(level, options);
}
