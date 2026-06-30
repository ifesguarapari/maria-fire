import StudentWorker from "./studentWorker.js?worker";

const DEFAULT_TIMEOUT_MS = 15000;

export class PythonRunner {
  constructor({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.timeoutMs = timeoutMs;
    this.worker = null;
    this.sequence = 0;
    this.pending = new Map();
  }

  ensureWorker() {
    if (this.worker) {
      return this.worker;
    }
    this.worker = new StudentWorker();
    this.worker.onmessage = (event) => {
      const { id, result } = event.data;
      const request = this.pending.get(id);
      if (!request) {
        return;
      }
      clearTimeout(request.timer);
      this.pending.delete(id);
      request.resolve(result);
    };
    this.worker.onerror = (error) => {
      for (const [id, request] of this.pending) {
        clearTimeout(request.timer);
        request.resolve({
          ok: false,
          output: [],
          currentLine: null,
          snapshot: null,
          error: {
            kind: "worker-error",
            line: null,
            message: "O executor Python encontrou um problema e precisou reiniciar.",
            technical: error.message,
          },
        });
        this.pending.delete(id);
      }
      this.terminate();
    };
    return this.worker;
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  run(payload) {
    const id = this.sequence + 1;
    this.sequence = id;
    const worker = this.ensureWorker();

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.terminate();
        resolve({
          ok: false,
          output: [],
          currentLine: null,
          snapshot: null,
          error: {
            kind: "timeout",
            line: null,
            message:
              "Seu programa demorou demais para responder. Verifique se existe um while infinito ou uma repetição sem esperar().",
            technical: "Worker execution timeout",
          },
        });
      }, this.timeoutMs);

      this.pending.set(id, { resolve, timer });
      worker.postMessage({ id, payload });
    });
  }
}
