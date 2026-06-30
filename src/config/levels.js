const video = (number, name, transcript) => ({
  type: "local",
  src: `videos/fase-${String(number).padStart(2, "0")}-${name}.mp4`,
  poster: "",
  captions: "",
  transcript,
});

export const levels = [
  {
    id: "fase-01",
    number: 1,
    title: "Primeiro disparo",
    type: "tutorial",
    seed: 101,
    objective: "Use uma chamada de função para acertar o alvo parado a leste.",
    concepts: ["funções", "parênteses", "parâmetros"],
    lesson: {
      programming:
        "Uma função é um comando nomeado. Quando você escreve o nome com parênteses, o Python executa aquela ação.",
      python:
        "A função atirar recebe o ângulo primeiro e a distância depois. A ordem é importante: atirar(angulo, distancia).",
      strategy:
        "Observe a direção do alvo, estime a distância e faça um único disparo com os dois valores.",
      exampleCode: "atirar(0, 60)",
      video: video(
        1,
        "funcoes",
        "Nesta fase você aprende que uma chamada de função é formada pelo nome, pelos parênteses e pelos parâmetros. O disparo usa primeiro o ângulo e depois a distância."
      ),
    },
    arena: {
      width: 100,
      height: 100,
      player: { x: 20, y: 50, angle: 0, energy: 100 },
      opponents: [
        { id: "alvo-1", name: "Assassino de Maria", x: 80, y: 50, angle: 180, energy: 30, ai: "static" },
      ],
      obstacles: [],
    },
    starterCode:
      "# Acerte o alvo parado.\n# Use atirar(angulo, distancia).\n\n",
    hintCode:
      "angulo = 0\n" +
      "distancia = 50  # CORRIGIR: use a distância correta até o alvo\n" +
      "atirar(angulo, distancia)\n",
    goals: {
      maxLines: 3,
      maxActions: 5,
      requiredCommands: ["atirar"],
    },
    success: {
      type: "defeat-target",
    },
  },
  {
    id: "fase-02",
    number: 2,
    title: "Entendendo os ângulos",
    type: "lesson",
    seed: 202,
    objective: "Descubra o ângulo correto para acertar um alvo em outra direção.",
    concepts: ["ângulos", "orientação", "coordenadas"],
    lesson: {
      programming:
        "Números podem representar direções. Aqui, 0 aponta para a direita, 90 para cima, 180 para a esquerda e 270 para baixo.",
      python:
        "Você continua usando atirar(angulo, distancia), mas agora precisa escolher o ângulo adequado.",
      strategy:
        "Compare a posição do jogador com a do alvo. Se o alvo está acima, o ângulo precisa apontar para cima.",
      exampleCode: "atirar(90, 40)",
      video: video(
        2,
        "angulos",
        "A fase apresenta o sistema de ângulos do jogo e mostra como relacionar a posição do alvo com um valor numérico."
      ),
    },
    arena: {
      width: 100,
      height: 100,
      player: { x: 50, y: 20, angle: 0, energy: 100 },
      opponents: [
        { id: "alvo-2", name: "Assassino de Maria", x: 50, y: 75, angle: 270, energy: 30, ai: "static" },
      ],
      obstacles: [],
    },
    starterCode:
      "# O alvo não está mais à direita.\n# Escolha o ângulo antes de atirar.\n\n",
    hintCode:
      "angulo = 0  # CORRIGIR: escolha o ângulo que aponta para o alvo\n" +
      "distancia = 55\n" +
      "atirar(angulo, distancia)\n",
    goals: {
      maxLines: 3,
      maxActions: 5,
      requiredCommands: ["atirar"],
    },
    success: {
      type: "defeat-target",
    },
  },
  {
    id: "fase-03",
    number: 3,
    title: "Contornando a parede",
    type: "lesson",
    seed: 303,
    objective: "Use variáveis para fazer um único movimento em diagonal e deixar o disparo alinhado.",
    concepts: ["variáveis", "sequência", "reutilização"],
    lesson: {
      programming:
        "Variáveis ajudam a nomear decisões do plano: direção, velocidade, ângulo e distância.",
      python:
        "Você pode guardar valores e reutilizá-los em comandos diferentes, como mover(direcao, velocidade) e atirar(angulo, distancia).",
      strategy:
        "A parede bloqueia o tiro direto. Faça um movimento em 45 graus para sair da frente da parede, pare e atire para cima.",
      exampleCode:
        "direcao = 0\n" +
        "velocidade = 60\n" +
        "mover(direcao, velocidade)\n" +
        "parar()",
      video: video(
        3,
        "variaveis",
        "A explicação mostra como criar variáveis para organizar uma sequência curta: mover uma vez, parar e reutilizar valores no disparo."
      ),
    },
    arena: {
      width: 100,
      height: 100,
      player: { x: 36, y: 20, angle: 0, energy: 100 },
      opponents: [
        { id: "alvo-3", name: "Assassino de Maria", x: 40.24, y: 78, angle: 270, energy: 30, ai: "static" },
      ],
      obstacles: [
        { x: 0, y: 46, width: 39.5, height: 6 },
      ],
    },
    starterCode:
      "# A parede bloqueia o disparo direto.\n" +
      "# Mova uma vez em 45 graus para alinhar o tiro.\n\n" +
      "angulo_movimento = 45\n" +
      "velocidade = 0\n" +
      "angulo_disparo = 90\n" +
      "distancia_disparo = 54\n\n",
    hintCode:
      "angulo_movimento = 45\n" +
      "velocidade = 40  # CORRIGIR: use velocidade suficiente para sair da frente da parede\n" +
      "angulo_disparo = 90\n" +
      "distancia_disparo = 54\n\n" +
      "mover(angulo_movimento, velocidade)\n" +
      "parar()\n" +
      "atirar(angulo_disparo, distancia_disparo)\n",
    goals: {
      maxLines: 7,
      maxActions: 5,
      requiredCommands: ["mover", "parar", "atirar"],
    },
    success: {
      type: "defeat-target",
    },
  },
  {
    id: "fase-04",
    number: 4,
    title: "Usando o sensor",
    type: "lesson",
    seed: 404,
    objective: "Use o retorno de detectar para descobrir a distância antes de atirar.",
    concepts: ["retorno", "expressão", "sensor"],
    lesson: {
      programming:
        "Algumas funções devolvem uma resposta. Esse retorno pode ser guardado em uma variável.",
      python:
        "detectar(angulo) retorna a distância até o alvo quando encontra alguém, ou None quando não encontra.",
      strategy:
        "Escolha o ângulo correto, guarde o retorno do sensor e use o valor retornado no disparo.",
      exampleCode: "distancia = detectar(0)\natirar(0, distancia)",
      video: video(
        4,
        "sensor",
        "A fase diferencia comandos que apenas fazem algo de expressões que devolvem um valor para o programa."
      ),
    },
    arena: {
      width: 100,
      height: 100,
      player: { x: 15, y: 52, angle: 0, energy: 100 },
      opponents: [
        {
          id: "alvo-4",
          name: "Assassino de Maria",
          xRange: [60, 74],
          y: 52,
          angle: 180,
          energy: 30,
          ai: "static",
        },
      ],
      obstacles: [],
    },
    starterCode:
      "# O alvo pode mudar de distância quando a fase reinicia.\n# Use detectar(angulo).\n\nangulo = 0\n\n",
    hintCode:
      "angulo = 0\n" +
      "distancia = detectar(angulo)\n" +
      "atirar(angulo, 35)  # CORRIGIR: use a distância devolvida pelo sensor\n",
    goals: {
      maxLines: 4,
      maxActions: 8,
      requiredCommands: ["detectar", "atirar"],
    },
    success: {
      type: "defeat-target",
    },
  },
  {
    id: "fase-05",
    number: 5,
    title: "Decisões com if",
    type: "lesson",
    seed: 505,
    objective: "Atire somente quando o sensor encontrar um alvo.",
    concepts: ["if", "None", "indentação"],
    lesson: {
      programming:
        "Um if permite que o programa escolha executar uma parte do código apenas quando uma condição é verdadeira.",
      python:
        "Use distancia is not None para verificar se detectar encontrou alguma coisa. A linha dentro do if precisa ser indentada.",
      strategy:
        "Guarde a distância, confira se ela existe e só então chame atirar.",
      exampleCode: "distancia = detectar(90)\n\nif distancia is not None:\n    atirar(90, distancia)",
      video: video(
        5,
        "if",
        "A explicação mostra como uma condição evita disparos sem alvo e por que a indentação faz parte da estrutura do Python."
      ),
    },
    arena: {
      width: 100,
      height: 100,
      player: { x: 50, y: 25, angle: 0, energy: 100 },
      opponents: [
        { id: "alvo-5", name: "Assassino de Maria", x: 50, y: 78, angle: 270, energy: 30, ai: "static" },
      ],
      obstacles: [],
    },
    starterCode:
      "# Use if para decidir quando atirar.\n\nangulo = 90\ndistancia = detectar(angulo)\n\n",
    hintCode:
      "angulo = 90\n" +
      "distancia = detectar(angulo)\n\n" +
      "if distancia is None:  # CORRIGIR: a condição deve confirmar que existe distância\n" +
      "    atirar(angulo, distancia)\n",
    goals: {
      maxLines: 5,
      maxActions: 8,
      requiredCommands: ["detectar", "atirar"],
    },
    success: {
      type: "defeat-target",
    },
  },
  {
    id: "fase-06",
    number: 6,
    title: "Procurando em várias direções",
    type: "lesson",
    seed: 606,
    objective: "Use for e range para procurar o alvo em direções possíveis.",
    concepts: ["for", "range", "busca sistemática"],
    lesson: {
      programming:
        "Uma repetição for percorre uma sequência de valores. range cria essa sequência numérica.",
      python:
        "for angulo in range(0, 360, 45): testa ângulos de 45 em 45 graus. As linhas repetidas ficam indentadas.",
      strategy:
        "Percorra os ângulos principais, use detectar em cada um e atire quando a distância não for None.",
      exampleCode:
        "for angulo in range(0, 180, 90):\n" +
        "    distancia = detectar(angulo)\n" +
        "    if distancia is not None:\n" +
        "        atirar(angulo, distancia)",
      video: video(
        6,
        "busca",
        "A fase apresenta uma busca por várias direções usando for e range, em vez de tentar um valor fixo."
      ),
    },
    arena: {
      width: 100,
      height: 100,
      player: { x: 50, y: 50, angle: 0, energy: 100 },
      opponents: [
        {
          id: "alvo-6",
          name: "Assassino de Maria",
          positions: [
            { x: 50, y: 82 },
            { x: 82, y: 50 },
            { x: 50, y: 18 },
            { x: 18, y: 50 },
          ],
          angle: 180,
          energy: 30,
          ai: "static",
        },
      ],
      obstacles: [],
    },
    starterCode:
      "# O alvo pode estar em uma das direções principais.\n# Use for, range, detectar e if.\n\n",
    hintCode:
      "for angulo in range(0, 270, 90):  # CORRIGIR: inclua todas as direções principais\n" +
      "    distancia = detectar(angulo)\n" +
      "    if distancia is not None:\n" +
      "        atirar(angulo, 20)  # CORRIGIR: use a distância detectada\n",
    goals: {
      maxLines: 5,
      maxActions: 20,
      requiredCommands: ["detectar", "atirar"],
    },
    success: {
      type: "defeat-target",
    },
  },
  {
    id: "fase-07",
    number: 7,
    title: "Movimento",
    type: "lesson",
    seed: 707,
    objective: "Aproxime-se, pare e dispare dentro do alcance.",
    concepts: ["movimento", "velocidade", "sequência"],
    lesson: {
      programming:
        "Alguns comandos mudam o estado do personagem ao longo do tempo. Mover inicia o movimento; esperar deixa o tempo passar; parar interrompe.",
      python:
        "mover(angulo, velocidade) define direção e velocidade. esperar(ciclos) atualiza a simulação por alguns ciclos.",
      strategy:
        "Avance na direção do alvo, espere o suficiente para entrar no alcance, pare e então atire.",
      exampleCode: "mover(0, 30)\nesperar(4)\nparar()",
      video: video(
        7,
        "movimento",
        "A explicação mostra a diferença entre iniciar um movimento, deixar o tempo passar e parar antes do disparo."
      ),
    },
    arena: {
      width: 100,
      height: 100,
      player: { x: 10, y: 50, angle: 0, energy: 100 },
      opponents: [
        { id: "alvo-7", name: "Assassino de Maria", x: 90, y: 50, angle: 180, energy: 30, ai: "static" },
      ],
      obstacles: [],
    },
    starterCode:
      "# O alvo está fora do alcance inicial.\n# Aproxime-se antes de atirar.\n\n",
    hintCode:
      "mover(0, 40)\n" +
      "esperar(8)  # CORRIGIR: ajuste o tempo para entrar no alcance sem ultrapassar demais\n" +
      "atirar(0, 55)  # CORRIGIR: pare antes de disparar e use a distância atual\n",
    goals: {
      maxLines: 6,
      maxActions: 18,
      requiredCommands: ["mover", "esperar", "parar", "atirar"],
    },
    success: {
      type: "defeat-target",
    },
  },
  {
    id: "fase-08",
    number: 8,
    title: "Repetição com while",
    type: "lesson",
    seed: 808,
    objective: "Use while para andar até uma posição segura e depois atacar.",
    concepts: ["while", "posição", "condição de parada"],
    lesson: {
      programming:
        "while repete enquanto a condição for verdadeira. A condição precisa mudar para a repetição terminar.",
      python:
        "posicao_x() e posicao_y() devolvem a posição atual do jogador. Use esses valores para controlar o movimento.",
      strategy:
        "Comece a mover, espere dentro do while até passar do ponto desejado, pare e use o sensor antes do disparo.",
      exampleCode:
        "mover(0, 30)\nwhile posicao_x() < 40:\n    esperar()\nparar()",
      video: video(
        8,
        "while",
        "A fase mostra uma repetição que acompanha a posição do personagem e termina quando a meta de deslocamento é atingida."
      ),
    },
    arena: {
      width: 100,
      height: 100,
      player: { x: 15, y: 35, angle: 0, energy: 100 },
      opponents: [
        { id: "alvo-8", name: "Assassino de Maria", x: 84, y: 35, angle: 180, energy: 30, ai: "static" },
      ],
      obstacles: [],
    },
    starterCode:
      "# Use while para controlar a aproximação.\n# Evite repetições que nunca terminam.\n\n",
    hintCode:
      "mover(0, 35)\n" +
      "while posicao_x() < 20:  # CORRIGIR: aproxime mais antes de parar\n" +
      "    esperar()\n" +
      "parar()\n" +
      "distancia = detectar(0)\n" +
      "atirar(0, distancia)\n",
    goals: {
      maxLines: 8,
      maxActions: 35,
      requiredCommands: ["mover", "esperar", "parar", "detectar", "atirar"],
    },
    success: {
      type: "defeat-target",
    },
  },
  {
    id: "fase-09",
    number: 9,
    title: "Estratégia combinada",
    type: "challenge",
    seed: 909,
    objective: "Localize um adversário ativo, aproxime-se se necessário e ataque.",
    concepts: ["sensores", "condicionais", "movimento", "energia"],
    lesson: {
      programming:
        "Programas maiores combinam ideias pequenas: procurar, decidir, mover, esperar e agir.",
      python:
        "Você pode usar for, if, while, detectar, mover, parar e atirar no mesmo programa.",
      strategy:
        "Procure em vários ângulos. Quando encontrar, use a distância para decidir se precisa se aproximar antes do disparo.",
      exampleCode:
        "for angulo in range(0, 360, 45):\n" +
        "    distancia = detectar(angulo)\n" +
        "    if distancia is not None:\n" +
        "        if distancia > 45:\n" +
        "            mover(angulo, 25)\n" +
        "            parar()\n" +
        "        atirar(angulo, distancia)",
      video: video(
        9,
        "estrategia-combinada",
        "A explicação organiza uma estratégia em etapas: localizar, avaliar distância, mover com segurança e atacar."
      ),
    },
    arena: {
      width: 100,
      height: 100,
      player: { x: 20, y: 20, angle: 0, energy: 100 },
      opponents: [
        {
          id: "rival-9",
          name: "Assassino de Maria",
          positions: [
            { x: 74, y: 72 },
            { x: 78, y: 28 },
            { x: 62, y: 82 },
          ],
          angle: 180,
          energy: 45,
          ai: "guard",
        },
      ],
      obstacles: [],
    },
    starterCode:
      "# Combine busca, decisão e movimento.\n# Uma solução fixa não deve ser confiável aqui.\n\n",
    hintCode:
      "for angulo in range(0, 360, 45):\n" +
      "    distancia = detectar(angulo)\n" +
      "    if distancia is not None:\n" +
      "        if distancia > 45:\n" +
      "            mover(angulo, 35)\n" +
      "            esperar(3)  # CORRIGIR: ajuste a aproximação antes de parar\n" +
      "            parar()\n" +
      "        atirar(angulo, distancia)  # CORRIGIR: recalcule a distância após mover\n",
    goals: {
      maxLines: 12,
      maxActions: 80,
      requiredCommands: ["detectar", "mover", "parar", "atirar"],
    },
    success: {
      type: "defeat-target",
    },
  },
  {
    id: "fase-10",
    number: 10,
    title: "Território final",
    type: "final",
    seed: 1010,
    objective: "Derrote Sentinela, Patrulheiro e Evasivo com uma estratégia completa.",
    concepts: ["estratégia", "adversários", "energia", "simulação"],
    lesson: {
      programming:
        "A fase final pede um plano adaptável. O código precisa reagir ao estado do território, não apenas repetir uma sequência fixa.",
      python:
        "Use sensores em vários ângulos, while com limite de ciclos, energia(), inimigos_ativos() e os comandos de movimento e disparo.",
      strategy:
        "Procure alvos, aproxime-se apenas quando estiver fora do alcance, pare para atirar e repita enquanto houver adversários ativos.",
      exampleCode:
        "ciclos = 0\n" +
        "while inimigos_ativos() > 0 and ciclos < 5:\n" +
        "    for angulo in range(0, 360, 45):\n" +
        "        distancia = detectar(angulo)\n" +
        "        if distancia is not None:\n" +
        "            atirar(angulo, distancia)\n" +
        "    ciclos = ciclos + 1",
      video: video(
        10,
        "estrategia-final",
        "A explicação final revisa como criar uma estratégia completa para três comportamentos de adversários."
      ),
    },
    arena: {
      width: 100,
      height: 100,
      player: { x: 16, y: 18, angle: 0, energy: 120 },
      opponents: [
        { id: "sentinela", name: "Sentinela", x: 78, y: 78, angle: 180, energy: 45, ai: "sentinel" },
        { id: "patrulheiro", name: "Patrulheiro", x: 76, y: 24, angle: 180, energy: 45, ai: "patrol" },
        { id: "evasivo", name: "Evasivo", x: 28, y: 78, angle: 270, energy: 45, ai: "evasive" },
      ],
      obstacles: [
        { x: 46, y: 46, width: 10, height: 12 },
        { x: 58, y: 28, width: 8, height: 12 },
      ],
    },
    starterCode:
      "# Crie uma estratégia completa.\n# Dica: limite seus while para evitar laços infinitos.\n\n",
    hintCode:
      "ciclos = 0\n" +
      "while inimigos_ativos() > 0 and energia() > 0 and ciclos < 30:\n" +
      "    for angulo in range(0, 360, 45):\n" +
      "        distancia = detectar(angulo)\n" +
      "        if distancia is not None:\n" +
      "            if distancia > 55:\n" +
      "                mover(angulo, 25)  # CORRIGIR: use movimentos curtos e as paredes como proteção\n" +
      "                esperar(1)\n" +
      "                parar()\n" +
      "            atirar(angulo, distancia)  # CORRIGIR: detecte de novo depois de mover\n" +
      "    ciclos = ciclos + 1\n",
    goals: {
      maxLines: 18,
      maxActions: 180,
      requiredCommands: ["detectar", "mover", "esperar", "parar", "atirar"],
    },
    success: {
      type: "survive-and-defeat",
      maxCycles: 240,
    },
  },
];

export const levelById = new Map(levels.map((level) => [level.id, level]));
