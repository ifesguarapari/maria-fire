import { describe, expect, it } from "vitest";
import { levels } from "../config/levels.js";
import {
  advanceAutonomousBattle,
  shouldAdvanceAutonomousBattle,
} from "../simulation/autonomousBattle.js";
import { createDemoTimeline, getDemoActions } from "../simulation/demoRunner.js";
import { createSimulation } from "../simulation/engine.js";
import { evaluateAttempt } from "../simulation/evaluation.js";

describe("fases", () => {
  it("define dez fases com lições, demonstrações e sugestões imperfeitas", () => {
    expect(levels).toHaveLength(10);
    for (const level of levels) {
      expect(level.lesson).toBeTruthy();
      expect(level.lesson.video?.transcript).toEqual(expect.any(String));
      expect(level.lesson.exampleCode).not.toMatch(/\bprint\s*\(/);
      expect(getDemoActions(level).length).toBeGreaterThan(0);
      const corrections = level.hintCode.match(/# CORRIGIR:/g) ?? [];
      expect(corrections.length).toBeGreaterThanOrEqual(1);
      expect(corrections.length).toBeLessThanOrEqual(3);
    }
  });

  it("executa as demonstrações das fases até a vitória", () => {
    for (const level of levels) {
      const demo = createDemoTimeline(level);
      expect(demo.frames.length).toBeGreaterThan(0);
      expect(demo.finalSnapshot.outcome.status).toBe("victory");
    }
  });

  it("inclui três adversários no território final", () => {
    const finalLevel = levels.at(-1);
    expect(finalLevel.id).toBe("fase-10");
    expect(finalLevel.arena.opponents).toHaveLength(3);
    expect(finalLevel.arena.opponents.map((opponent) => opponent.name)).toEqual([
      "Sentinela",
      "Patrulheiro",
      "Evasivo",
    ]);
  });

  it("avalia vitória pelo estado final da simulação", () => {
    const level = levels[0];
    const engine = createSimulation(level);
    engine.atirar(0, 60);
    const evaluation = evaluateAttempt(level, engine.snapshot(), "angulo = 0\ndistancia = 60\natirar(angulo, distancia)");
    expect(evaluation.status).toBe("success");
    expect(evaluation.victory).toBe(true);
  });

  it("não aceita estado sem vitória", () => {
    const level = levels[0];
    const engine = createSimulation(level);
    const evaluation = evaluateAttempt(level, engine.snapshot(), "atirar(0, 60)");
    expect(evaluation.status).toBe("error");
    expect(evaluation.victory).toBe(false);
  });

  it("aplica metas de linhas e ações sem exigir código de referência", () => {
    const level = levels[0];
    const engine = createSimulation(level);
    engine.atirar(0, 60);
    const code = "a = 1\nb = 2\nc = 3\nd = 4\natirar(0, 60)";
    const evaluation = evaluateAttempt(level, engine.snapshot(), code);
    expect(evaluation.status).toBe("warning");
    expect(evaluation.victory).toBe(true);
  });

  it("verifica comandos obrigatorios", () => {
    const level = levels[3];
    const engine = createSimulation(level);
    const distance = engine.detectar(0);
    engine.atirar(0, distance);
    const snapshot = engine.snapshot();
    snapshot.commands = { atirar: 1 };
    const evaluation = evaluateAttempt(level, snapshot, "distancia = 50\natirar(0, distancia)");
    expect(evaluation.status).toBe("error");
    expect(evaluation.missingCommands).toEqual(["detectar"]);
  });

  it("fase 3 exige um movimento diagonal antes de atirar", () => {
    const level = levels[2];

    const direct = createSimulation(level);
    direct.atirar(90, 54);
    expect(direct.snapshot().outcome.status).toBe("running");

    const hint = createSimulation(level);
    hint.mover(45, 40);
    hint.parar();
    hint.atirar(90, 54);
    expect(hint.snapshot().outcome.status).toBe("running");

    const solution = createSimulation(level);
    solution.mover(45, 60);
    solution.parar();
    solution.atirar(90, 54);
    const evaluation = evaluateAttempt(
      level,
      solution.snapshot(),
      "angulo_movimento = 45\n" +
        "velocidade = 60\n" +
        "angulo_disparo = 90\n" +
        "distancia_disparo = 54\n" +
        "mover(angulo_movimento, velocidade)\n" +
        "parar()\n" +
        "atirar(angulo_disparo, distancia_disparo)"
    );
    expect(evaluation.status).toBe("success");
  });

  it("fase 10 avança a batalha dos adversários mesmo sem comandos do aluno", () => {
    const level = levels.find((candidate) => candidate.id === "fase-10");
    const engine = createSimulation(level, {
      maxActions: 1000,
      maxCycles: level.success.maxCycles,
    });

    expect(shouldAdvanceAutonomousBattle(level, "run")).toBe(true);

    const result = advanceAutonomousBattle(engine, level);

    expect(result.cycles).toBeGreaterThan(0);
    expect(result.snapshot.cycle).toBeGreaterThan(0);
    expect(result.snapshot.outcome.status).not.toBe("running");
    expect(result.snapshot.stats.playerDamageTaken).toBeGreaterThan(0);
  });

  it("fase 10 permite que adversários ataquem durante comandos de sensor e estado", () => {
    const level = levels.find((candidate) => candidate.id === "fase-10");
    const engine = createSimulation(level, {
      maxActions: 1000,
      maxCycles: level.success.maxCycles,
    });

    engine.detectar(0);

    const snapshot = engine.snapshot();
    expect(snapshot.cycle).toBe(1);
    expect(snapshot.stats.playerDamageTaken).toBeGreaterThan(0);
  });

  it("sentinela varre todos os quadrantes em vez de ficar presa em um arco", () => {
    const level = {
      ...levels.find((candidate) => candidate.id === "fase-10"),
      arena: {
        width: 100,
        height: 100,
        player: { x: 8, y: 8, angle: 0, energy: 300 },
        opponents: [
          { id: "sentinela", name: "Sentinela", x: 92, y: 92, angle: 180, energy: 45, ai: "sentinel" },
        ],
        obstacles: [],
      },
      success: { type: "survive-and-defeat", maxCycles: 120 },
    };
    const engine = createSimulation(level, {
      maxActions: 1000,
      maxCycles: 120,
    });

    engine.tick(25);

    const sentry = engine.snapshot().opponents[0];
    expect(sentry.angle).toBeGreaterThan(270);
  });

  it("sentinela trava a mira e ataca quando o jogador entra em linha de visão", () => {
    const level = {
      ...levels.find((candidate) => candidate.id === "fase-10"),
      arena: {
        width: 100,
        height: 100,
        player: { x: 30, y: 50, angle: 0, energy: 100 },
        opponents: [
          { id: "sentinela", name: "Sentinela", x: 70, y: 50, angle: 90, energy: 45, ai: "sentinel" },
        ],
        obstacles: [],
      },
      success: { type: "survive-and-defeat", maxCycles: 80 },
    };
    const engine = createSimulation(level, {
      maxActions: 1000,
      maxCycles: 80,
    });

    engine.tick(1);

    const snapshot = engine.snapshot();
    expect(snapshot.opponents[0].angle).toBe(180);
    expect(snapshot.stats.playerDamageTaken).toBeGreaterThan(0);
    expect(snapshot.events.at(-1).shooterId).toBe("sentinela");
  });
});
