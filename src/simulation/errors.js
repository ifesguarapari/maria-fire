export class SimulationUserError extends Error {
  constructor(kind, message, line = null) {
    super(message);
    this.name = "SimulationUserError";
    this.kind = kind;
    this.line = line;
  }
}

export class ActionLimitReached extends Error {
  constructor(message = "Limite de ações atingido.") {
    super(message);
    this.name = "ActionLimitReached";
  }
}

export class StepLimitReached extends Error {
  constructor(line = null) {
    super("Pausa da execução passo a passo.");
    this.name = "StepLimitReached";
    this.line = line;
  }
}
