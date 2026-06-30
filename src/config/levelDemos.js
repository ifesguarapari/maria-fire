const LAST_RESULT = "$last";

export const levelDemos = {
  "fase-01": [
    { command: "atirar", args: [0, 60] },
  ],
  "fase-02": [
    { command: "atirar", args: [90, 55] },
  ],
  "fase-03": [
    { command: "mover", args: [45, 60] },
    { command: "parar", args: [] },
    { command: "atirar", args: [90, 54] },
  ],
  "fase-04": [
    { command: "detectar", args: [0] },
    { command: "atirar", args: [0, LAST_RESULT] },
  ],
  "fase-05": [
    { command: "detectar", args: [90] },
    { command: "atirar", args: [90, LAST_RESULT] },
  ],
  "fase-06": [
    { command: "detectar", args: [0] },
    { command: "atirar", args: [0, LAST_RESULT] },
  ],
  "fase-07": [
    { command: "mover", args: [0, 40] },
    { command: "esperar", args: [5] },
    { command: "parar", args: [] },
    { command: "atirar", args: [0, 56] },
  ],
  "fase-08": [
    { command: "mover", args: [0, 35] },
    { command: "esperar", args: [2] },
    { command: "parar", args: [] },
    { command: "detectar", args: [0] },
    { command: "atirar", args: [0, LAST_RESULT] },
  ],
  "fase-09": [
    { command: "detectar", args: [0] },
    { command: "atirar", args: [0, LAST_RESULT] },
    { command: "esperar", args: [4] },
    { command: "detectar", args: [0] },
    { command: "atirar", args: [0, LAST_RESULT] },
  ],
  "fase-10": [
    { command: "detectar", args: [0] },
    { command: "atirar", args: [0, LAST_RESULT] },
    { command: "esperar", args: [4] },
    { command: "detectar", args: [0] },
    { command: "atirar", args: [0, LAST_RESULT] },
    { command: "esperar", args: [4] },
    { command: "detectar", args: [75] },
    { command: "atirar", args: [75, LAST_RESULT] },
    { command: "esperar", args: [4] },
    { command: "detectar", args: [75] },
    { command: "atirar", args: [75, LAST_RESULT] },
    { command: "esperar", args: [4] },
    { command: "mover", args: [0, 40] },
    { command: "esperar", args: [13] },
    { command: "parar", args: [] },
    { command: "mover", args: [90, 40] },
    { command: "esperar", args: [9] },
    { command: "parar", args: [] },
    { command: "detectar", args: [75] },
    { command: "atirar", args: [75, LAST_RESULT] },
    { command: "esperar", args: [4] },
    { command: "detectar", args: [75] },
    { command: "atirar", args: [75, LAST_RESULT] },
  ],
};
