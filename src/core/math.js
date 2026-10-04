// @ts-check

/** @typedef {{x:number,y:number}} Point */

/** @param {number} value @param {number} min @param {number} max */
export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

/** @param {number} ax @param {number} ay @param {number} bx @param {number} by */
export function distance(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }

/** @param {number} x @param {number} y */
export function normalize(x, y) {
  const length = Math.hypot(x, y);
  if (length < 1e-6) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}

/** @param {number} a @param {number} b @param {number} t */
export function lerp(a, b, t) { return a + (b - a) * t; }

/** @param {number} a @param {number} b @param {number} t */
export function lerpAngle(a, b, t) {
  let delta = (b - a + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  return a + delta * t;
}

/** @param {Point} point @param {Point[]} polygon */
export function pointInPolygon(point, polygon) {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersects = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

/** @param {Point[]} points */
export function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distance(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
  return total;
}

/** @param {Point[]} polygon */
export function polygonArea(polygon) {
  let area = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    area += polygon[j].x * polygon[i].y - polygon[i].x * polygon[j].y;
  }
  return Math.abs(area) * 0.5;
}

/** @param {number} x @param {number} y @param {number} radius @param {number} px @param {number} py */
export function circleHit(x, y, radius, px, py) { return distance(x, y, px, py) <= radius; }
