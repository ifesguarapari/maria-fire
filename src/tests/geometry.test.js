import { describe, expect, it } from "vitest";
import {
  angleBetween,
  angleToVector,
  angularDifference,
  canvasToLogical,
  distanceBetween,
  isPointInBeam,
  logicalToCanvas,
  normalizeAngle,
  segmentIntersectsRect,
} from "../simulation/geometry.js";

describe("geometria", () => {
  it("normaliza ângulos e converte para vetor", () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(450)).toBe(90);
    expect(angleToVector(0).x).toBeCloseTo(1);
    expect(angleToVector(90).y).toBeCloseTo(1);
  });

  it("calcula distância entre personagens", () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("calcula diferenca angular pelo menor caminho", () => {
    expect(angularDifference(350, 10)).toBe(20);
    expect(angleBetween({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(90);
  });

  it("detecta pontos dentro e fora do feixe", () => {
    const origin = { x: 0, y: 0 };
    expect(isPointInBeam(origin, { x: 10, y: 0 }, 0, 20, 20)).toBe(true);
    expect(isPointInBeam(origin, { x: 0, y: 10 }, 0, 20, 20)).toBe(false);
    expect(isPointInBeam(origin, { x: 40, y: 0 }, 0, 20, 20)).toBe(false);
  });

  it("converte entre coordenadas logicas e Canvas", () => {
    const arena = { width: 100, height: 100 };
    const canvas = { width: 500, height: 300 };
    const logical = { x: 20, y: 70 };
    const point = logicalToCanvas(logical, arena, canvas);
    expect(point).toEqual({ x: 100, y: 90 });
    expect(canvasToLogical(point, arena, canvas)).toEqual(logical);
  });

  it("detecta interseção entre segmento e retângulo", () => {
    const rect = { x: 40, y: 40, width: 10, height: 10 };
    expect(segmentIntersectsRect({ x: 10, y: 45 }, { x: 80, y: 45 }, rect)).toBe(true);
    expect(segmentIntersectsRect({ x: 10, y: 20 }, { x: 80, y: 20 }, rect)).toBe(false);
  });
});
