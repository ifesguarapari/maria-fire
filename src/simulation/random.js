export function createRng(seed) {
  let state = Number(seed) >>> 0;
  return {
    next() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    },
    between(min, max) {
      return min + (max - min) * this.next();
    },
    pick(items) {
      return items[Math.floor(this.next() * items.length)];
    },
  };
}
