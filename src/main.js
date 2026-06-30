import * as monaco from "monaco-editor";
import "monaco-editor/min/vs/editor/editor.main.css";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { levels, levelById } from "./config/levels.js";
import { finalBattleSuggestion, finalOpponentPrograms } from "./config/opponentPrograms.js";
import { createSimulation } from "./simulation/engine.js";
import { createDemoTimeline } from "./simulation/demoRunner.js";
import { evaluateAttempt, mergeBestProgress } from "./simulation/evaluation.js";
import {
  createEmptyProgress,
  createProgressStore,
} from "./storage/progressStore.js";
import { createArenaRenderer } from "./ui/canvasRenderer.js";
import { PythonRunner } from "./python/runner.js";

const LINE_FRAME_DELAY_MS = 260;
const ACTION_FRAME_DURATION_MS = 620;
const BATTLE_FRAME_DELAY_MS = 700;
const SUCCESS_EFFECT_DURATION_MS = 1300;
const LESSON_DEMO_FRAME_DURATION_MS = 560;
const LESSON_DEMO_WAIT_FRAME_DURATION_MS = 260;
const LESSON_DEMO_FRAME_PAUSE_MS = 150;
const LESSON_DEMO_RESTART_DELAY_MS = 900;

const MOTIVATIONAL_MESSAGES = [
  "Você observou o resultado, testou uma estratégia e fez o código trabalhar a seu favor. Esse é um passo importante no pensamento computacional.",
  "Programar é transformar uma intenção em instruções claras. Você acabou de fazer isso dentro do território.",
  "Cada fase concluída mostra que tentativa, leitura do erro e ajuste também fazem parte de aprender Python.",
  "Seu raciocínio está ficando mais preciso: você conectou conceito, comando e consequência na simulação.",
  "Continue com calma. Bons programadores não acertam por mágica; eles testam, analisam e melhoram a solução.",
];

self.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};

const app = {
  editor: null,
  lineDecorations: null,
  renderer: null,
  runner: new PythonRunner(),
  store: createProgressStore({
    indexedDB: window.indexedDB,
    localStorage: window.localStorage,
  }),
  progress: new Map(),
  currentLevel: levels[0],
  currentSnapshot: null,
  suggestionPreviousCode: null,
  saveTimer: null,
  suppressSave: false,
  lessonStartHandler: null,
  lessonPreviewRenderer: null,
  lessonPreviewRunId: 0,
  animationRunId: 0,
  confirmResolver: null,
  confirmLastFocused: null,
  completionNextHandler: null,
  arenaFullscreenFallback: false,
  started: false,
};

const dom = {
  appShell: document.querySelector("#app"),
  startScreen: document.querySelector("#startScreen"),
  startButton: document.querySelector("#startButton"),
  progressSummary: document.querySelector("#progressSummary"),
  levelNav: document.querySelector("#levelNav"),
  levelKicker: document.querySelector("#levelKicker"),
  levelTitle: document.querySelector("#levelTitle"),
  lineGoal: document.querySelector("#lineGoal"),
  exampleCode: document.querySelector("#exampleCode"),
  editor: document.querySelector("#editor"),
  runButton: document.querySelector("#runButton"),
  hintButton: document.querySelector("#hintButton"),
  lessonButton: document.querySelector("#lessonButton"),
  messages: document.querySelector("#messages"),
  opponentPrograms: document.querySelector("#opponentPrograms"),
  opponentProgramsSuggestion: document.querySelector("#opponentProgramsSuggestion"),
  opponentProgramsList: document.querySelector("#opponentProgramsList"),
  arenaCanvas: document.querySelector("#arenaCanvas"),
  arenaFullscreenButton: document.querySelector("#arenaFullscreenButton"),
  statusBadge: document.querySelector("#statusBadge"),
  hud: document.querySelector("#hud"),
  objectiveText: document.querySelector("#objectiveText"),
  conceptText: document.querySelector("#conceptText"),
  functionText: document.querySelector("#functionText"),
  commandsList: document.querySelector("#commandsList"),
  strategyText: document.querySelector("#strategyText"),
  descriptionText: document.querySelector("#descriptionText"),
  lessonDialog: document.querySelector("#lessonDialog"),
  lessonDialogKicker: document.querySelector("#lessonDialogKicker"),
  lessonDialogTitle: document.querySelector("#lessonDialogTitle"),
  lessonBody: document.querySelector("#lessonBody"),
  closeLessonButton: document.querySelector("#closeLessonButton"),
  startExerciseButton: document.querySelector("#startExerciseButton"),
  errorModal: document.querySelector("#errorModal"),
  errorModalMessage: document.querySelector("#errorModalMessage"),
  closeErrorModal: document.querySelector("#closeErrorModal"),
  confirmModal: document.querySelector("#confirmModal"),
  confirmModalTitle: document.querySelector("#confirmModalTitle"),
  confirmModalMessage: document.querySelector("#confirmModalMessage"),
  cancelConfirmModal: document.querySelector("#cancelConfirmModal"),
  acceptConfirmModal: document.querySelector("#acceptConfirmModal"),
  arenaPanel: document.querySelector(".arena-panel"),
  completionModal: document.querySelector("#completionModal"),
  completionModalKicker: document.querySelector("#completionModalKicker"),
  completionModalTitle: document.querySelector("#completionModalTitle"),
  completionModalMessage: document.querySelector("#completionModalMessage"),
  completionConcepts: document.querySelector("#completionConcepts"),
  completionMotivation: document.querySelector("#completionMotivation"),
  continueCompletionModal: document.querySelector("#continueCompletionModal"),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatList(items = []) {
  const values = items.filter(Boolean);
  if (values.length === 0) {
    return "os conceitos da fase";
  }
  if (values.length === 1) {
    return values[0];
  }
  if (values.length === 2) {
    return `${values[0]} e ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")} e ${values.at(-1)}`;
}

function defaultProgressFor(level) {
  return {
    ...createEmptyProgress(level.id),
    code: level.starterCode,
  };
}

async function loadStoredProgress() {
  const entries = await app.store.getAll();
  for (const entry of entries) {
    app.progress.set(entry.levelId, {
      ...createEmptyProgress(entry.levelId),
      ...entry,
    });
  }
}

function getProgress(levelId = app.currentLevel.id) {
  const level = levelById.get(levelId);
  if (!app.progress.has(levelId)) {
    app.progress.set(levelId, defaultProgressFor(level));
  }
  return app.progress.get(levelId);
}

async function saveProgress(levelId, patch) {
  const level = levelById.get(levelId);
  const current = {
    ...defaultProgressFor(level),
    ...getProgress(levelId),
  };
  const saved = await app.store.save({ ...current, ...patch });
  app.progress.set(levelId, saved);
  renderLevelNav();
  renderProgressSummary();
  return saved;
}

function setEditorValue(code) {
  app.suppressSave = true;
  app.editor.setValue(code);
  app.suppressSave = false;
}

function scheduleCodeSave() {
  if (app.suppressSave) {
    return;
  }
  window.clearTimeout(app.saveTimer);
  app.saveTimer = window.setTimeout(() => {
    saveProgress(app.currentLevel.id, { code: app.editor.getValue() });
  }, 450);
}

function renderProgressSummary() {
  const completed = levels.filter((level) => {
    const status = getProgress(level.id).status;
    return status === "success" || status === "warning";
  }).length;
  dom.progressSummary.textContent = `${completed}/${levels.length} fases concluídas`;
}

function renderLevelNav() {
  dom.levelNav.innerHTML = "";
  for (const level of levels) {
    const progress = getProgress(level.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `level-button ${progress.status ?? "blank"}`;
    button.classList.toggle("active", level.id === app.currentLevel.id);
    button.setAttribute("aria-label", `Abrir fase ${level.number}: ${level.title}`);
    button.title = `${level.number}. ${level.title}`;
    button.textContent = String(level.number);
    if (progress.hintUsed) {
      const lamp = document.createElement("span");
      lamp.className = "lamp-icon";
      lamp.title = "Sugestão usada";
      lamp.setAttribute("aria-label", "Sugestão usada");
      button.append(lamp);
    }
    button.addEventListener("click", () => setCurrentLevel(level));
    dom.levelNav.append(button);
  }
}

function renderHud(snapshot) {
  const stats = snapshot?.stats ?? {};
  const outcome = snapshot?.outcome?.status ?? "running";
  dom.hud.innerHTML = `
    <div><strong>Energia</strong><span>${Math.round(stats.energyRemaining ?? 0)}</span></div>
    <div><strong>Acertos</strong><span>${stats.hits ?? 0}</span></div>
    <div><strong>Disparos</strong><span>${stats.shotsFired ?? 0}</span></div>
    <div><strong>Distância</strong><span>${stats.distanceMoved ?? 0}</span></div>
    <div><strong>Tempo</strong><span>${stats.simulatedTime ?? 0}s</span></div>
    <div><strong>Classe</strong><span>${escapeHtml(stats.classification ?? "Tentativa incompleta")}</span></div>
  `;
  dom.statusBadge.textContent = outcome === "victory" ? "Vitória" : outcome === "defeat" ? "Derrota" : "Em andamento";
  dom.statusBadge.dataset.status = outcome;
}

function renderCommands(level) {
  const commands = [
    "atirar(angulo, distancia)",
    "detectar(angulo)",
    "mover(angulo, velocidade)",
    "esperar(ciclos=1)",
    "parar()",
    "posicao_x()",
    "posicao_y()",
    "energia()",
    "inimigos_ativos()",
  ];
  const required = new Set(level.goals?.requiredCommands ?? []);
  dom.commandsList.innerHTML = commands
    .map((command) => {
      const name = command.split("(")[0];
      const badge = required.has(name) ? '<span class="required-command">meta</span>' : "";
      return `<li><code>${command}</code>${badge}</li>`;
    })
    .join("");
}

function renderOpponentPrograms(level) {
  if (level.id !== "fase-10") {
    dom.opponentPrograms.classList.add("hidden");
    dom.opponentProgramsList.innerHTML = "";
    dom.opponentProgramsSuggestion.textContent = "";
    return;
  }

  dom.opponentPrograms.classList.remove("hidden");
  dom.opponentProgramsSuggestion.textContent = finalBattleSuggestion;
  dom.opponentProgramsList.innerHTML = finalOpponentPrograms
    .map(
      (program) => `
        <article class="opponent-program">
          <h4>${escapeHtml(program.title)}</h4>
          <p>${escapeHtml(program.description)}</p>
          <pre aria-label="Código do adversário ${escapeHtml(program.title)}"><code>${escapeHtml(
            program.code
          )}</code></pre>
        </article>
      `
    )
    .join("");
}

function showMessage(text, type = "info") {
  dom.messages.innerHTML = "";
  const message = document.createElement("div");
  message.className = `message ${type}`;
  message.textContent = text;
  dom.messages.append(message);
}

function clearMessages() {
  dom.messages.innerHTML = "";
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function openErrorModal(message) {
  dom.errorModalMessage.textContent = message || "O programa encontrou um erro.";
  dom.errorModal.classList.remove("hidden");
  dom.closeErrorModal.focus();
}

function closeErrorModal() {
  dom.errorModal.classList.add("hidden");
}

function closeConfirmModal(accepted = false) {
  const resolver = app.confirmResolver;
  app.confirmResolver = null;
  dom.confirmModal.classList.add("hidden");
  if (app.confirmLastFocused && typeof app.confirmLastFocused.focus === "function") {
    app.confirmLastFocused.focus();
  }
  app.confirmLastFocused = null;
  if (resolver) {
    resolver(accepted);
  }
}

function openConfirmModal({
  title = "Confirmar ação",
  message = "Deseja continuar?",
  acceptLabel = "Confirmar",
  cancelLabel = "Cancelar",
} = {}) {
  if (app.confirmResolver) {
    closeConfirmModal(false);
  }

  app.confirmLastFocused = document.activeElement;
  dom.confirmModalTitle.textContent = title;
  dom.confirmModalMessage.textContent = message;
  dom.acceptConfirmModal.textContent = acceptLabel;
  dom.cancelConfirmModal.textContent = cancelLabel;
  dom.confirmModal.classList.remove("hidden");
  dom.cancelConfirmModal.focus();

  return new Promise((resolve) => {
    app.confirmResolver = resolve;
  });
}

function closeCompletionModal() {
  dom.completionModal.classList.add("hidden");
}

function startGame() {
  app.started = true;
  dom.startScreen.classList.add("hidden");
  dom.appShell.classList.remove("hidden");
  dom.appShell.removeAttribute("aria-hidden");

  window.requestAnimationFrame(() => {
    app.editor.layout();
    if (app.currentSnapshot) {
      renderSnapshot(app.currentSnapshot);
    }
    if (!getProgress(app.currentLevel.id).lessonViewed) {
      openLesson(app.currentLevel);
    }
  });
}

function openCompletionModal({ level, nextLevel, evaluation }) {
  const concepts = level.concepts ?? [];
  const conceptText = formatList(concepts);
  const linePart =
    evaluation.status === "warning"
      ? "Você concluiu a fase, mesmo passando da meta. Agora observe onde dá para simplificar."
      : "Você concluiu dentro das metas e mostrou um bom controle da estratégia.";
  const nextText = nextLevel
    ? "Antes do próximo exercício, vamos ver a prévia da nova fase."
    : "Você chegou ao fim da sequência. Revise as fases para fortalecer sua estratégia completa.";

  app.completionNextHandler = () => {
    closeCompletionModal();
    if (!nextLevel) {
      return;
    }
    if (getProgress(nextLevel.id).lessonViewed) {
      setCurrentLevel(nextLevel, { showLesson: false });
      return;
    }
    openLesson(nextLevel, {
      onStart: () => setCurrentLevel(nextLevel, { showLesson: false }),
    });
  };

  dom.completionModalKicker.textContent = `Fase ${level.number} concluída`;
  dom.completionModalTitle.textContent = "Parabéns!";
  dom.completionModalMessage.textContent = `Você entendeu ${conceptText} e aplicou esses conceitos para resolver "${level.title}". ${linePart} ${nextText}`;
  dom.completionConcepts.innerHTML = "";
  for (const concept of concepts) {
    const chip = document.createElement("span");
    chip.textContent = concept;
    dom.completionConcepts.append(chip);
  }
  dom.completionMotivation.textContent =
    MOTIVATIONAL_MESSAGES[(level.number - 1) % MOTIVATIONAL_MESSAGES.length];
  dom.continueCompletionModal.textContent = nextLevel
    ? getProgress(nextLevel.id).lessonViewed
      ? "Ir para próxima fase"
      : "Ver prévia da próxima fase"
    : "Continuar praticando";
  dom.completionModal.classList.remove("hidden");
  dom.continueCompletionModal.focus();
}

function clearEditorMarkers() {
  monaco.editor.setModelMarkers(app.editor.getModel(), "student", []);
  app.lineDecorations.set([]);
}

function highlightLine(line, isError = false, message = "") {
  clearEditorMarkers();
  if (!line) {
    return;
  }
  const model = app.editor.getModel();
  if (isError) {
    monaco.editor.setModelMarkers(model, "student", [
      {
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: model.getLineMaxColumn(line),
        severity: monaco.MarkerSeverity.Error,
        message,
      },
    ]);
  }
  app.lineDecorations.set([
    {
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        className: isError ? "editor-error-line" : "editor-current-line",
      },
    },
  ]);
  app.editor.revealLineInCenterIfOutsideViewport(line);
}

function setBusy(isBusy) {
  for (const button of [dom.runButton, dom.hintButton, dom.lessonButton]) {
    button.disabled = isBusy;
  }
  dom.runButton.textContent = isBusy ? "Executando..." : "Executar";
}

function renderSnapshot(snapshot, { replay = false, duration = ACTION_FRAME_DURATION_MS } = {}) {
  app.currentSnapshot = snapshot;
  let playback = null;
  if (replay && typeof app.renderer.play === "function") {
    playback = app.renderer.play(snapshot, { duration });
  } else {
    app.renderer.render(snapshot);
  }
  renderHud(snapshot);
  return playback ?? Promise.resolve();
}

async function playSuccessEffect(snapshot) {
  dom.arenaPanel.classList.remove("success-effect");
  void dom.arenaPanel.offsetWidth;
  dom.arenaPanel.classList.add("success-effect");
  try {
    if (snapshot && typeof app.renderer.success === "function") {
      await app.renderer.success(snapshot, { duration: SUCCESS_EFFECT_DURATION_MS });
    } else {
      await wait(SUCCESS_EFFECT_DURATION_MS);
    }
  } finally {
    dom.arenaPanel.classList.remove("success-effect");
  }
}

function compactTimeline(frames = []) {
  return frames.filter((frame, index) => {
    const next = frames[index + 1];
    return !(frame.type === "line" && next?.type === "action" && next.line === frame.line);
  });
}

function commandLabel(command) {
  const labels = {
    atirar: "disparo",
    detectar: "sensor",
    mover: "movimento",
    esperar: "espera",
    parar: "parada",
    batalha: "batalha",
    posicao_x: "posição X",
    posicao_y: "posição Y",
    energia: "energia",
    inimigos_ativos: "inimigos ativos",
    ciclo_atual: "tempo",
  };
  return labels[command] ?? command;
}

async function animateExecutionTimeline(result) {
  const frames = compactTimeline(result.timeline);
  if (frames.length === 0) {
    return false;
  }

  const runId = app.animationRunId + 1;
  app.animationRunId = runId;

  await renderSnapshot(result.initialSnapshot ?? createSimulation(app.currentLevel).snapshot());

  for (const [index, frame] of frames.entries()) {
    if (runId !== app.animationRunId) {
      return true;
    }

    const stepText = `${index + 1}/${frames.length}`;
    highlightLine(frame.line, false);

    if (frame.type === "battle") {
      showMessage(`Passo ${stepText}: os adversários executam seus códigos.`, "info");
      await renderSnapshot(frame.snapshot, { replay: true, duration: BATTLE_FRAME_DELAY_MS });
    } else if (frame.type === "action") {
      showMessage(`Passo ${stepText}: linha ${frame.line}, ${commandLabel(frame.command)} executado.`, "info");
      await renderSnapshot(frame.snapshot, { replay: true, duration: ACTION_FRAME_DURATION_MS });
    } else {
      showMessage(`Passo ${stepText}: lendo a linha ${frame.line}.`, "info");
      await renderSnapshot(frame.snapshot);
      await wait(LINE_FRAME_DELAY_MS);
    }
  }

  if (result.snapshot) {
    await renderSnapshot(result.snapshot);
  }

  return true;
}

async function setCurrentLevel(level, options = {}) {
  app.currentLevel = level;
  await app.store.setCurrentLevel(level.id);

  const progress = getProgress(level.id);
  dom.levelKicker.textContent = `Fase ${level.number}`;
  dom.levelTitle.textContent = level.title;
  dom.lineGoal.textContent = `Meta: ${level.goals.maxLines} linhas, ${level.goals.maxActions} ações`;
  dom.objectiveText.textContent = level.objective;
  dom.conceptText.textContent = level.lesson?.programming ?? "";
  dom.functionText.textContent = level.lesson?.python ?? "";
  dom.exampleCode.textContent = level.lesson?.exampleCode ?? level.starterCode;
  dom.strategyText.textContent = level.lesson?.strategy ?? "";
  dom.descriptionText.textContent = level.lesson?.video?.transcript ?? "";
  renderCommands(level);
  renderOpponentPrograms(level);
  clearMessages();
  clearEditorMarkers();
  setEditorValue(progress.code);

  const initialSnapshot = createSimulation(level).snapshot();
  renderSnapshot(progress.lastResult?.snapshot ?? initialSnapshot);
  renderLevelNav();
  renderProgressSummary();

  if (options.showLesson !== false && !progress.lessonViewed) {
    openLesson(level);
  }
}

async function applySuggestion() {
  const level = app.currentLevel;
  const currentCode = app.editor.getValue();
  const containsChanges = currentCode !== getProgress(level.id).code || currentCode.trim().length > 0;

  if (containsChanges) {
    const confirmed = await openConfirmModal({
      title: "Aplicar sugestão?",
      message: "A sugestão vai substituir o código atual. Deseja continuar?",
      acceptLabel: "Aplicar sugestão",
      cancelLabel: "Cancelar",
    });
    if (!confirmed) {
      return;
    }
  }

  app.suggestionPreviousCode = currentCode;
  setEditorValue(level.hintCode);
  await saveProgress(level.id, {
    code: level.hintCode,
    hintUsed: true,
  });
  showMessage("Sugestão aplicada. Corrija os pontos marcados antes de executar.", "info");
}

async function handleRunnerResult(result, code, shouldEvaluate) {
  const level = app.currentLevel;
  const animated = result.timeline?.length ? await animateExecutionTimeline(result) : false;

  if (!animated && result.snapshot) {
    renderSnapshot(result.snapshot, { replay: result.ok });
  }

  if (!result.ok) {
    const error = result.error;
    highlightLine(error?.line, true, error?.message ?? "Erro");
    showMessage(error?.message ?? "O programa encontrou um erro.", "error");
    openErrorModal(error?.message);
    await saveProgress(level.id, {
      code,
      status: "error",
      attempts: getProgress(level.id).attempts + (shouldEvaluate ? 1 : 0),
      lastResult: { error, snapshot: result.snapshot },
    });
    return;
  }

  highlightLine(result.currentLine, false);

  if (!shouldEvaluate) {
    showMessage(
      result.stepped ? "Linha executada. Continue para observar o próximo passo." : "Programa chegou ao fim.",
      "info"
    );
    await saveProgress(level.id, {
      code,
      lastResult: { snapshot: result.snapshot },
    });
    return;
  }

  const evaluation = evaluateAttempt(level, result.snapshot, code);
  const previous = getProgress(level.id);
  const best = evaluation.victory ? mergeBestProgress(previous, evaluation) : {};
  await saveProgress(level.id, {
    code,
    status: evaluation.status,
    attempts: previous.attempts + 1,
    ...best,
    lastResult: {
      evaluation,
      snapshot: result.snapshot,
    },
  });
  showMessage(evaluation.message, evaluation.status === "error" ? "error" : "success");

  if (evaluation.victory) {
    await playSuccessEffect(result.snapshot);
    const index = levels.findIndex((candidate) => candidate.id === level.id);
    const next = levels[index + 1];
    openCompletionModal({ level, nextLevel: next, evaluation });
  }
}

async function runAll() {
  setBusy(true);
  clearMessages();
  clearEditorMarkers();
  const code = app.editor.getValue();
  showMessage("Carregando executor Python e simulando o território...", "info");
  try {
    const result = await app.runner.run({
      code,
      level: app.currentLevel,
      mode: "run",
    });
    await handleRunnerResult(result, code, true);
  } catch (error) {
    const message = "O executor Python encontrou um problema inesperado. Recarregue a página e tente novamente.";
    showMessage(message, "error");
    openErrorModal(message);
    console.error(error);
  } finally {
    setBusy(false);
  }
}

function renderLessonText(level) {
  return `
    <section class="lesson-preview" aria-label="Prévia da fase">
      <p class="lesson-description">${escapeHtml(level.objective)}</p>
      <div class="lesson-demo-shell">
        <canvas
          id="lessonDemoCanvas"
          aria-label="Demonstração animada da ${escapeHtml(level.title)}"
        ></canvas>
      </div>
    </section>
  `;
}

function stopLessonPreview() {
  app.lessonPreviewRunId += 1;
  if (app.lessonPreviewRenderer) {
    app.lessonPreviewRenderer.destroy?.();
    app.lessonPreviewRenderer.stop?.();
  }
  app.lessonPreviewRenderer = null;
}

async function runLessonPreview(level, renderer, runId) {
  while (app.lessonPreviewRunId === runId && dom.lessonDialog.open) {
    let demo;
    try {
      demo = createDemoTimeline(level);
    } catch (error) {
      console.error(error);
      renderer.render(createSimulation(level).snapshot());
      return;
    }

    renderer.render(demo.initialSnapshot);
    await wait(LESSON_DEMO_RESTART_DELAY_MS);

    for (const frame of demo.frames) {
      if (app.lessonPreviewRunId !== runId || !dom.lessonDialog.open) {
        return;
      }
      const duration =
        frame.command === "esperar" ? LESSON_DEMO_WAIT_FRAME_DURATION_MS : LESSON_DEMO_FRAME_DURATION_MS;
      await renderer.play(frame.snapshot, { duration });
      await wait(LESSON_DEMO_FRAME_PAUSE_MS);
    }

    await wait(LESSON_DEMO_RESTART_DELAY_MS);
  }
}

function startLessonPreview(level) {
  stopLessonPreview();
  const canvas = document.querySelector("#lessonDemoCanvas");
  if (!canvas) {
    return;
  }

  const renderer = createArenaRenderer(canvas);
  app.lessonPreviewRenderer = renderer;
  const runId = app.lessonPreviewRunId + 1;
  app.lessonPreviewRunId = runId;

  window.requestAnimationFrame(() => {
    void runLessonPreview(level, renderer, runId);
  });
}

function openLesson(level, options = {}) {
  app.lessonStartHandler = options.onStart ?? null;
  dom.lessonDialogKicker.textContent = `Fase ${level.number}`;
  dom.lessonDialogTitle.textContent = level.title;
  dom.lessonBody.innerHTML = renderLessonText(level);
  if (!dom.lessonDialog.open) {
    dom.lessonDialog.showModal();
  }
  window.requestAnimationFrame(() => startLessonPreview(level));
}

async function startExerciseFromLesson() {
  const currentDialogLevel =
    levels.find((candidate) => `Fase ${candidate.number}` === dom.lessonDialogKicker.textContent) ??
    app.currentLevel;
  await saveProgress(currentDialogLevel.id, { lessonViewed: true });
  dom.lessonDialog.close();
  if (app.lessonStartHandler) {
    const handler = app.lessonStartHandler;
    app.lessonStartHandler = null;
    await handler();
  }
}

function isArenaFullscreen() {
  return document.fullscreenElement === dom.arenaPanel || app.arenaFullscreenFallback;
}

function rerenderArenaSoon() {
  if (!app.currentSnapshot) {
    return;
  }
  window.requestAnimationFrame(() => {
    app.renderer.render(app.currentSnapshot);
  });
}

function updateArenaFullscreenControls() {
  const isFullscreen = isArenaFullscreen();
  dom.arenaFullscreenButton.textContent = isFullscreen ? "Voltar ao normal" : "Tela cheia";
  dom.arenaFullscreenButton.setAttribute(
    "aria-label",
    isFullscreen ? "Voltar simulação ao tamanho normal" : "Expandir simulação para tela cheia"
  );
  dom.arenaPanel.classList.toggle("fullscreen-fallback", app.arenaFullscreenFallback);
  document.body.classList.toggle("arena-is-fullscreen", isFullscreen);
  rerenderArenaSoon();
}

function enterArenaFullscreenFallback() {
  app.arenaFullscreenFallback = true;
  updateArenaFullscreenControls();
}

async function enterArenaFullscreen() {
  if (!dom.arenaPanel.requestFullscreen) {
    enterArenaFullscreenFallback();
    return;
  }

  try {
    app.arenaFullscreenFallback = false;
    await dom.arenaPanel.requestFullscreen();
  } catch {
    enterArenaFullscreenFallback();
  }
  updateArenaFullscreenControls();
}

async function exitArenaFullscreen() {
  app.arenaFullscreenFallback = false;
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      // O navegador já pode ter encerrado a tela cheia pelo Esc.
    }
  }
  updateArenaFullscreenControls();
}

async function toggleArenaFullscreen() {
  if (isArenaFullscreen()) {
    await exitArenaFullscreen();
    return;
  }
  await enterArenaFullscreen();
}

function bindEvents() {
  dom.startButton.addEventListener("click", startGame);
  dom.runButton.addEventListener("click", runAll);
  dom.hintButton.addEventListener("click", applySuggestion);
  dom.lessonButton.addEventListener("click", () => openLesson(app.currentLevel));
  dom.arenaFullscreenButton.addEventListener("click", toggleArenaFullscreen);
  dom.closeLessonButton.addEventListener("click", () => dom.lessonDialog.close());
  dom.startExerciseButton.addEventListener("click", startExerciseFromLesson);
  dom.closeErrorModal.addEventListener("click", closeErrorModal);
  dom.cancelConfirmModal.addEventListener("click", () => closeConfirmModal(false));
  dom.acceptConfirmModal.addEventListener("click", () => closeConfirmModal(true));
  dom.continueCompletionModal.addEventListener("click", () => {
    const handler = app.completionNextHandler;
    app.completionNextHandler = null;
    if (handler) {
      handler();
    } else {
      closeCompletionModal();
    }
  });
  dom.errorModal.addEventListener("click", (event) => {
    if (event.target === dom.errorModal) {
      closeErrorModal();
    }
  });
  dom.confirmModal.addEventListener("click", (event) => {
    if (event.target === dom.confirmModal) {
      closeConfirmModal(false);
    }
  });
  dom.lessonDialog.addEventListener("close", stopLessonPreview);
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement !== dom.arenaPanel) {
      app.arenaFullscreenFallback = false;
    }
    updateArenaFullscreenControls();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && app.arenaFullscreenFallback) {
      void exitArenaFullscreen();
      return;
    }
    if (event.key === "Escape" && !dom.confirmModal.classList.contains("hidden")) {
      closeConfirmModal(false);
      return;
    }
    if (event.key === "Escape" && !dom.errorModal.classList.contains("hidden")) {
      closeErrorModal();
    }
  });
}

async function init() {
  app.renderer = createArenaRenderer(dom.arenaCanvas);
  app.editor = monaco.editor.create(dom.editor, {
    value: levels[0].starterCode,
    language: "python",
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 15,
    lineNumbers: "on",
    tabSize: 4,
    insertSpaces: true,
    wordWrap: "on",
    accessibilitySupport: "on",
    theme: "vs-dark",
  });
  app.lineDecorations = app.editor.createDecorationsCollection();
  app.editor.onDidChangeModelContent(scheduleCodeSave);
  bindEvents();
  await loadStoredProgress();
  const savedLevelId = await app.store.getCurrentLevel();
  const initialLevel = levelById.get(savedLevelId) ?? levels[0];
  await setCurrentLevel(initialLevel, { showLesson: false });
}

init();
