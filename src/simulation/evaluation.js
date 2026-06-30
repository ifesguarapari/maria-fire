export function countCodeLines(code) {
  return code
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#")).length;
}

export function evaluateAttempt(level, snapshot, code) {
  const lineCount = countCodeLines(code);
  const actionCount = snapshot.actionCount ?? 0;
  const requiredCommands = level.goals?.requiredCommands ?? [];
  const missingCommands = requiredCommands.filter((command) => !snapshot.commands?.[command]);
  const victory = snapshot.outcome?.status === "victory";
  const withinLines = lineCount <= (level.goals?.maxLines ?? Infinity);
  const withinActions = actionCount <= (level.goals?.maxActions ?? Infinity);

  if (!victory) {
    return {
      status: "error",
      victory: false,
      lineCount,
      actionCount,
      missingCommands,
      message: "O território ainda não chegou ao objetivo. Revise a estratégia e tente novamente.",
    };
  }

  if (missingCommands.length > 0) {
    return {
      status: "error",
      victory: false,
      lineCount,
      actionCount,
      missingCommands,
      message: `A solução venceu o território, mas ainda precisa usar: ${missingCommands.join(", ")}.`,
    };
  }

  const status = withinLines && withinActions ? "success" : "warning";
  return {
    status,
    victory: true,
    lineCount,
    actionCount,
    missingCommands,
    message:
      status === "success"
        ? "Fase concluída dentro das metas."
        : "Fase concluída, mas acima de uma das metas.",
  };
}

export function mergeBestProgress(previous, evaluation) {
  const bestLineCount =
    previous?.bestLineCount === null || previous?.bestLineCount === undefined
      ? evaluation.lineCount
      : Math.min(previous.bestLineCount, evaluation.lineCount);
  const bestActionCount =
    previous?.bestActionCount === null || previous?.bestActionCount === undefined
      ? evaluation.actionCount
      : Math.min(previous.bestActionCount, evaluation.actionCount);
  return { bestLineCount, bestActionCount };
}
