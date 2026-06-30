export const FULL_TURN = 360;

export function normalizeAngle(angle) {
  if (!Number.isFinite(Number(angle))) {
    return NaN;
  }
  return ((Number(angle) % FULL_TURN) + FULL_TURN) % FULL_TURN;
}

export function angleToVector(angle) {
  const radians = (normalizeAngle(angle) * Math.PI) / 180;
  return {
    x: Math.cos(radians),
    y: Math.sin(radians),
  };
}

export function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function angleBetween(a, b) {
  const radians = Math.atan2(b.y - a.y, b.x - a.x);
  return normalizeAngle((radians * 180) / Math.PI);
}

export function angularDifference(a, b) {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(diff, FULL_TURN - diff);
}

export function isPointInBeam(origin, target, angle, range, aperture) {
  const distance = distanceBetween(origin, target);
  if (distance > range) {
    return false;
  }
  const targetAngle = angleBetween(origin, target);
  return angularDifference(angle, targetAngle) <= aperture / 2;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function logicalToCanvas(point, arena, canvas) {
  return {
    x: (point.x / arena.width) * canvas.width,
    y: canvas.height - (point.y / arena.height) * canvas.height,
  };
}

export function canvasToLogical(point, arena, canvas) {
  return {
    x: (point.x / canvas.width) * arena.width,
    y: arena.height - (point.y / canvas.height) * arena.height,
  };
}

export function rectContainsPoint(rect, point, radius = 0) {
  return (
    point.x >= rect.x - radius &&
    point.x <= rect.x + rect.width + radius &&
    point.y >= rect.y - radius &&
    point.y <= rect.y + rect.height + radius
  );
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 1e-9) {
    return 0;
  }
  return value > 0 ? 1 : 2;
}

function pointOnSegment(a, b, c) {
  return (
    b.x <= Math.max(a.x, c.x) + 1e-9 &&
    b.x >= Math.min(a.x, c.x) - 1e-9 &&
    b.y <= Math.max(a.y, c.y) + 1e-9 &&
    b.y >= Math.min(a.y, c.y) - 1e-9
  );
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }
  if (o1 === 0 && pointOnSegment(a, c, b)) {
    return true;
  }
  if (o2 === 0 && pointOnSegment(a, d, b)) {
    return true;
  }
  if (o3 === 0 && pointOnSegment(c, a, d)) {
    return true;
  }
  return o4 === 0 && pointOnSegment(c, b, d);
}

export function segmentIntersectsRect(from, to, rect) {
  if (rectContainsPoint(rect, from) || rectContainsPoint(rect, to)) {
    return true;
  }

  const left = rect.x;
  const right = rect.x + rect.width;
  const bottom = rect.y;
  const top = rect.y + rect.height;
  const edges = [
    [{ x: left, y: bottom }, { x: right, y: bottom }],
    [{ x: right, y: bottom }, { x: right, y: top }],
    [{ x: right, y: top }, { x: left, y: top }],
    [{ x: left, y: top }, { x: left, y: bottom }],
  ];

  return edges.some(([edgeStart, edgeEnd]) => segmentsIntersect(from, to, edgeStart, edgeEnd));
}
