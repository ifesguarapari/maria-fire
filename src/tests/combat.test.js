import { describe, expect, it } from "vitest";
import { createSimulation } from "../simulation/engine.js";

function makeLevel(overrides = {}) {
  return {
    id: "test",
    seed: 1,
    goals: { maxActions: 100, requiredCommands: [] },
    success: { type: "defeat-target" },
    arena: {
      width: 100,
      height: 100,
      player: { x: 20, y: 50, angle: 0, energy: 100 },
      opponents: [
        { id: "target", name: "Alvo", x: 50, y: 50, angle: 180, energy: 30, ai: "static" },
      ],
      obstacles: [],
    },
    ...overrides,
  };
}

describe("disparos", () => {
  it("atinge alvo dentro do alcance", () => {
    const engine = createSimulation(makeLevel());
    expect(engine.atirar(0, 30)).toBe(true);
    const snapshot = engine.snapshot();
    expect(snapshot.outcome.status).toBe("victory");
    expect(snapshot.stats.hits).toBe(1);
  });

  it("não atinge alvo fora do alcance", () => {
    const engine = createSimulation(
      makeLevel({
        arena: {
          width: 100,
          height: 100,
          player: { x: 5, y: 50, angle: 0, energy: 100 },
          opponents: [
            { id: "target", name: "Alvo", x: 95, y: 50, angle: 180, energy: 30, ai: "static" },
          ],
          obstacles: [],
        },
      })
    );
    expect(engine.atirar(0, 90)).toBe(false);
    expect(engine.snapshot().outcome.status).toBe("running");
  });

  it("não atinge alvo atrás de obstáculo", () => {
    const engine = createSimulation(
      makeLevel({
        arena: {
          width: 100,
          height: 100,
          player: { x: 20, y: 50, angle: 0, energy: 100 },
          opponents: [
            { id: "target", name: "Alvo", x: 50, y: 50, angle: 180, energy: 30, ai: "static" },
          ],
          obstacles: [{ x: 32, y: 45, width: 6, height: 10 }],
        },
      })
    );
    expect(engine.atirar(0, 30)).toBe(false);
    expect(engine.snapshot().outcome.status).toBe("running");
  });

  it("atinge alvo quando a linha de tiro não cruza obstáculo", () => {
    const engine = createSimulation(
      makeLevel({
        arena: {
          width: 100,
          height: 100,
          player: { x: 20, y: 50, angle: 0, energy: 100 },
          opponents: [
            { id: "target", name: "Alvo", x: 50, y: 50, angle: 180, energy: 30, ai: "static" },
          ],
          obstacles: [{ x: 32, y: 60, width: 6, height: 10 }],
        },
      })
    );
    expect(engine.atirar(0, 30)).toBe(true);
    expect(engine.snapshot().outcome.status).toBe("victory");
  });

  it("não detecta alvo atrás de obstáculo", () => {
    const engine = createSimulation(
      makeLevel({
        arena: {
          width: 100,
          height: 100,
          player: { x: 20, y: 50, angle: 0, energy: 100 },
          opponents: [
            { id: "target", name: "Alvo", x: 50, y: 50, angle: 180, energy: 30, ai: "static" },
          ],
          obstacles: [{ x: 32, y: 45, width: 6, height: 10 }],
        },
      })
    );
    expect(engine.detectar(0)).toBeNull();
  });

  it("recusa ângulo inválido com erro apropriado", () => {
    const engine = createSimulation(makeLevel());
    expect(() => engine.atirar("leste", 30)).toThrow(/ângulo/);
  });

  it("exige distância dentro da tolerância", () => {
    const engine = createSimulation(makeLevel());
    expect(engine.atirar(0, 45)).toBe(false);
    expect(engine.snapshot().opponents[0].energy).toBe(30);
  });

  it("respeita recarga entre disparos", () => {
    const engine = createSimulation(
      makeLevel({
        arena: {
          width: 100,
          height: 100,
          player: { x: 20, y: 50, angle: 0, energy: 100 },
          opponents: [
            { id: "target", name: "Alvo", x: 50, y: 50, angle: 180, energy: 100, ai: "static" },
          ],
          obstacles: [],
        },
      })
    );
    expect(engine.atirar(0, 30)).toBe(true);
    const afterFirst = engine.snapshot().opponents[0].energy;
    expect(engine.atirar(0, 30)).toBe(false);
    expect(engine.snapshot().opponents[0].energy).toBe(afterFirst);
  });

  it("aplica dano e desativa quando a energia chega a zero", () => {
    const engine = createSimulation(makeLevel());
    engine.atirar(0, 30);
    const target = engine.snapshot().opponents[0];
    expect(target.energy).toBe(0);
    expect(target.alive).toBe(false);
  });
});
