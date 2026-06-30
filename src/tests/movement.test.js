import { describe, expect, it } from "vitest";
import { createSimulation } from "../simulation/engine.js";

function makeLevel(player = { x: 20, y: 50, angle: 0, energy: 100 }) {
  return {
    id: "move-test",
    seed: 2,
    goals: { maxActions: 100, requiredCommands: [] },
    success: { type: "defeat-target" },
    arena: {
      width: 100,
      height: 100,
      player,
      opponents: [
        { id: "target", name: "Alvo", x: 90, y: 90, angle: 180, energy: 30, ai: "static" },
      ],
      obstacles: [],
    },
  };
}

describe("movimento", () => {
  it("move na direcao informada pela velocidade", () => {
    const engine = createSimulation(makeLevel());
    engine.mover(0, 40);
    expect(engine.snapshot().player.x).toBeCloseTo(24);
    engine.esperar(2);
    expect(engine.snapshot().player.x).toBeCloseTo(32);
  });

  it("move no eixo vertical usando angulos", () => {
    const engine = createSimulation(makeLevel());
    engine.mover(90, 30);
    expect(engine.snapshot().player.y).toBeCloseTo(53);
  });

  it("para o personagem", () => {
    const engine = createSimulation(makeLevel());
    engine.mover(0, 40);
    engine.parar();
    const x = engine.snapshot().player.x;
    engine.esperar(3);
    expect(engine.snapshot().player.x).toBeCloseTo(x);
  });

  it("respeita os limites do território", () => {
    const engine = createSimulation(makeLevel({ x: 98, y: 50, angle: 0, energy: 100 }));
    engine.mover(0, 60);
    expect(engine.snapshot().player.x).toBeLessThanOrEqual(96.4);
  });

  it("não atravessa paredes entre um ciclo e outro", () => {
    const level = makeLevel({ x: 20, y: 50, angle: 0, energy: 100 });
    level.arena.obstacles = [{ x: 24, y: 45, width: 2, height: 10 }];
    const engine = createSimulation(level);
    engine.mover(0, 60);
    const snapshot = engine.snapshot();
    expect(snapshot.player.x).toBeCloseTo(20);
    expect(snapshot.player.speed).toBe(0);
  });

  it("atualiza a simulação por ciclos", () => {
    const engine = createSimulation(makeLevel());
    engine.esperar(5);
    expect(engine.snapshot().cycle).toBe(5);
  });
});
