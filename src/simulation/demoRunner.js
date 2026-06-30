import { levelDemos } from "../config/levelDemos.js";
import { createSimulation } from "./engine.js";

const LAST_RESULT = "$last";
const DEMO_ACTION_LIMIT = 1000;
const DEMO_CYCLE_LIMIT = 1000;

function resolveArgs(args, lastResult) {
  return (args ?? []).map((arg) => (arg === LAST_RESULT ? lastResult : arg));
}

function pushFrame(frames, command, engine) {
  frames.push({
    command,
    snapshot: engine.snapshot(),
  });
}

function runAction(engine, action, frames, lastResult) {
  const command = action.command;
  const args = resolveArgs(action.args, lastResult);
  const callback = engine[command];

  if (typeof callback !== "function") {
    throw new Error(`Comando de demonstração desconhecido: ${command}`);
  }

  if (command === "esperar") {
    const cycles = Number(args[0] ?? 1);
    for (let cycle = 0; cycle < cycles; cycle += 1) {
      callback.call(engine, 1);
      pushFrame(frames, command, engine);
      if (engine.isFinished()) {
        break;
      }
    }
    return lastResult;
  }

  const result = callback.apply(engine, args);
  pushFrame(frames, command, engine);
  return result === undefined ? lastResult : result;
}

export function getDemoActions(level) {
  return levelDemos[level.id] ?? [];
}

export function createDemoTimeline(level) {
  const actions = getDemoActions(level);
  const engine = createSimulation(level, {
    maxActions: DEMO_ACTION_LIMIT,
    maxCycles: DEMO_CYCLE_LIMIT,
  });
  const initialSnapshot = engine.snapshot();
  const frames = [];
  let lastResult = null;

  for (const action of actions) {
    lastResult = runAction(engine, action, frames, lastResult);
    if (engine.isFinished()) {
      break;
    }
  }

  return {
    actions,
    initialSnapshot,
    frames,
    finalSnapshot: engine.snapshot(),
  };
}
