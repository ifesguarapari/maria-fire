const BATTLE_FRAME_INTERVAL = 3;

export function shouldAdvanceAutonomousBattle(level, mode = "run") {
  return mode === "run" && (level.type === "final" || level.id === "fase-10");
}

export function advanceAutonomousBattle(engine, level, options = {}) {
  const maxCycles = options.maxCycles ?? level.success?.maxCycles ?? 240;
  let cycles = 0;

  while (!engine.isFinished() && engine.snapshot().cycle < maxCycles) {
    engine.tick(1);
    cycles += 1;
    const snapshot = engine.snapshot();

    if (cycles % BATTLE_FRAME_INTERVAL === 0 || snapshot.outcome.status !== "running") {
      options.onFrame?.({
        type: "battle",
        command: "batalha",
        line: null,
      });
    }
  }

  return {
    cycles,
    snapshot: engine.snapshot(),
  };
}
