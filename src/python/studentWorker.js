import { createSimulation } from "../simulation/engine.js";
import {
  advanceAutonomousBattle,
  shouldAdvanceAutonomousBattle,
} from "../simulation/autonomousBattle.js";

const MAX_TIMELINE_FRAMES = 360;

let pyodidePromise = null;

function getPyodide() {
  if (!pyodidePromise) {
    const indexURL = new URL(`${import.meta.env.BASE_URL}pyodide/`, self.location.origin).href;
    pyodidePromise = import(/* @vite-ignore */ `${indexURL}pyodide.mjs`).then(({ loadPyodide }) =>
      loadPyodide({ indexURL })
    );
  }
  return pyodidePromise;
}

function instrumentPythonLines(code) {
  const continuationKeywords = /^(elif|else|except|finally)\b/;
  const generated = [];
  const lineMap = new Map();
  const lines = code.replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const originalLine = index + 1;
    const line = lines[index];
    const trimmed = line.trim();
    const indent = line.match(/^\s*/)?.[0] ?? "";
    const shouldMark =
      trimmed &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("@") &&
      !continuationKeywords.test(trimmed);

    if (shouldMark) {
      generated.push(`${indent}__marcar_linha__(${originalLine})`);
      lineMap.set(generated.length, originalLine);
    }
    generated.push(line);
    lineMap.set(generated.length, originalLine);
  }

  return { code: generated.join("\n"), lineMap };
}

function apiEnvelope(callback) {
  try {
    return JSON.stringify({ ok: true, value: callback() ?? null });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      name: error.name ?? "Error",
      kind: error.kind ?? error.name ?? "runtime",
      line: error.line ?? null,
      message: error.message ?? String(error),
    });
  }
}

function createPythonApiSource() {
  return `
import json
from js import _maria_api, _maria_line

def _maria_raise(data):
    raise Exception("MARIA_API_ERROR|" + str(data.get("kind")) + "|" + str(data.get("line")) + "|" + data.get("message", "Erro na simulação."))

def _maria_call(command, *args):
    data = json.loads(str(_maria_api(command, *args)))
    if not data.get("ok"):
        _maria_raise(data)
    return data.get("value")

def __marcar_linha__(linha):
    data = json.loads(str(_maria_line(linha)))
    if not data.get("ok"):
        kind = str(data.get("kind"))
        if kind == "step-limit":
            raise Exception("MARIA_STEP_LIMIT|" + str(linha))
        if kind == "line-limit":
            raise Exception("MARIA_LINE_LIMIT|" + str(linha))
        _maria_raise(data)

def atirar(angulo=0, distancia=None):
    return _maria_call("atirar", angulo, distancia)

def detectar(angulo):
    return _maria_call("detectar", angulo)

def mover(angulo, velocidade):
    return _maria_call("mover", angulo, velocidade)

def esperar(ciclos=1):
    return _maria_call("esperar", ciclos)

def parar():
    return _maria_call("parar")

def posicao_x():
    return _maria_call("posicao_x")

def posicao_y():
    return _maria_call("posicao_y")

def energia():
    return _maria_call("energia")

def inimigos_ativos():
    return _maria_call("inimigos_ativos")

def ciclo_atual():
    return _maria_call("ciclo_atual")
`;
}

function parseLineFromText(text) {
  const match = String(text).match(/File "<student>", line (\d+)/);
  return match ? Number(match[1]) : null;
}

function beginnerMessage(error, mappedLine = null) {
  const text = String(error?.message ?? error);
  const technical = text;
  const normalized = text.includes("Exception: ") ? text.split("Exception: ").at(-1) : text;

  if (normalized.includes("MARIA_API_ERROR|")) {
    const [, kind, line, ...messageParts] = normalized.split("|");
    return {
      kind,
      line: line === "null" ? mappedLine : Number(line),
      message: messageParts.join("|"),
      technical,
    };
  }

  if (
    text.includes("Failed to fetch") ||
    text.includes("NetworkError") ||
    text.includes("pyodide") ||
    text.includes("pyodide.mjs")
  ) {
    return {
      kind: "pyodide-load",
      line: null,
      message:
        "Não consegui carregar o executor Python. Recarregue a página; se continuar, verifique se os arquivos do Pyodide estão na pasta pyodide.",
      technical,
    };
  }

  if (text.includes("SyntaxError")) {
    return {
      kind: "SyntaxError",
      line: mappedLine,
      message:
        "O Python encontrou um problema na organização desta linha. Verifique parênteses, dois-pontos e a forma do comando.",
      technical,
    };
  }

  if (text.includes("IndentationError")) {
    return {
      kind: "IndentationError",
      line: mappedLine,
      message:
        "O Python encontrou um problema na organização desta linha. Verifique os dois-pontos e a indentação.",
      technical,
    };
  }

  if (text.includes("NameError")) {
    const name = text.match(/name '([^']+)' is not defined/)?.[1];
    return {
      kind: "NameError",
      line: mappedLine,
      message: name
        ? `O nome "${name}" ainda não foi criado. Confira se o nome da variável foi escrito da mesma forma.`
        : "O Python encontrou um nome que ainda não foi criado.",
      technical,
    };
  }

  if (text.includes("TypeError")) {
    return {
      kind: "TypeError",
      line: mappedLine,
      message:
        "Algum comando recebeu parâmetros de um tipo inesperado. Confira números, textos e valores vazios.",
      technical,
    };
  }

  if (text.includes("ValueError")) {
    return {
      kind: "ValueError",
      line: mappedLine,
      message: "Algum valor não pôde ser convertido corretamente. Confira números, ângulos e distâncias.",
      technical,
    };
  }

  if (text.includes("ZeroDivisionError")) {
    return {
      kind: "ZeroDivisionError",
      line: mappedLine,
      message: "Não é possível dividir por zero. Revise o cálculo antes de executar novamente.",
      technical,
    };
  }

  if (normalized.includes("MARIA_STEP_LIMIT|")) {
    return {
      kind: "step-limit",
      line: Number(normalized.split("|")[1]),
      message: "Execução pausada para o próximo passo.",
      technical,
    };
  }

  if (normalized.includes("MARIA_LINE_LIMIT|")) {
    return {
      kind: "line-limit",
      line: Number(normalized.split("|")[1]),
      message:
        "Seu programa executou linhas demais. Verifique se existe uma repetição que nunca chega ao fim.",
      technical,
    };
  }

  return {
    kind: "RuntimeError",
    line: mappedLine,
    message: "O programa parou antes do fim. Revise a linha destacada e tente novamente.",
    technical,
  };
}

async function executeStudentCode({ code, level, mode = "run", lineBudget = Infinity }) {
  const pyodide = await getPyodide();
  const output = [];
  const engine = createSimulation(level, {
    maxActions: Math.max((level.goals?.maxActions ?? 80) * 3, 80),
    maxCycles: level.success?.maxCycles ?? 320,
  });
  const maxLineSteps = Math.max((level.goals?.maxActions ?? 80) * 60, 600);
  const initialSnapshot = engine.snapshot();
  const timeline = [];
  let executedLines = 0;
  let currentLine = null;

  function pushTimelineFrame(frame) {
    if (timeline.length >= MAX_TIMELINE_FRAMES) {
      return;
    }
    timeline.push({
      ...frame,
      snapshot: engine.snapshot(),
    });
  }

  pyodide.setStdout({ batched: (text) => output.push(text) });
  pyodide.setStderr({ batched: (text) => output.push(text) });

  self._maria_api = (command, ...args) =>
    apiEnvelope(() => {
      engine.setCurrentLine(currentLine);
      const value = engine[command](...args);
      pushTimelineFrame({
        type: "action",
        command,
        line: currentLine,
      });
      return value;
    });

  self._maria_line = (line) =>
    apiEnvelope(() => {
      currentLine = Number(line);
      engine.setCurrentLine(currentLine);
      executedLines += 1;
      if (mode === "step" && executedLines > lineBudget) {
        const error = new Error(`MARIA_STEP_LIMIT|${line}`);
        error.kind = "step-limit";
        error.line = Number(line);
        throw error;
      }
      if (executedLines > maxLineSteps) {
        const error = new Error("MARIA_LINE_LIMIT|" + line);
        error.kind = "line-limit";
        error.line = Number(line);
        throw error;
      }
      pushTimelineFrame({
        type: "line",
        line: currentLine,
      });
      return true;
    });

  pyodide.runPython(createPythonApiSource());

  pyodide.globals.set("_raw_student_code", code);
  try {
    pyodide.runPython('compile(_raw_student_code, "<student>", "exec")');
  } catch (error) {
    const line = parseLineFromText(error?.message ?? error);
    return {
      ok: false,
      output,
      currentLine: line,
      initialSnapshot,
      timeline,
      snapshot: engine.snapshot(),
      error: beginnerMessage(error, line),
    };
  }

  const instrumented = instrumentPythonLines(code);
  pyodide.globals.set("_student_code", instrumented.code);

  try {
    await pyodide.runPythonAsync('exec(compile(_student_code, "<student>", "exec"))');
    if (shouldAdvanceAutonomousBattle(level, mode)) {
      advanceAutonomousBattle(engine, level, {
        onFrame: (frame) => pushTimelineFrame(frame),
      });
    }
    return {
      ok: true,
      output,
      currentLine,
      stepped: false,
      initialSnapshot,
      timeline,
      snapshot: engine.snapshot(),
    };
  } catch (error) {
    const rawLine = parseLineFromText(error?.message ?? error);
    const mappedLine = rawLine ? instrumented.lineMap.get(rawLine) ?? rawLine : currentLine;
    const mappedError = beginnerMessage(error, mappedLine);

    if (mappedError.kind === "step-limit") {
      return {
        ok: true,
        output,
        currentLine: mappedError.line,
        stepped: true,
        initialSnapshot,
        timeline,
        snapshot: engine.snapshot(),
      };
    }

    return {
      ok: false,
      output,
      currentLine: mappedError.line,
      initialSnapshot,
      timeline,
      snapshot: engine.snapshot(),
      error: mappedError,
    };
  }
}

self.onmessage = async (event) => {
  const { id, payload } = event.data;
  try {
    const result = await executeStudentCode(payload);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({
      id,
      result: {
        ok: false,
        output: [],
        currentLine: null,
        snapshot: null,
        error: beginnerMessage(error),
      },
    });
  }
};
