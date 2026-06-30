export const finalOpponentPrograms = [
  {
    id: "evasivo",
    title: "Evasivo",
    description:
      "Varre o território em pequenos passos, atira quando encontra o Filho de Maria e muda de rota quando é atingido.",
    code:
      "# Evasivo: varre em sentido anti-horário e foge quando é atingido.\n" +
      "angulo = 0\n" +
      "passo = 2\n" +
      "energia_anterior = energia()\n\n" +
      "while True:\n" +
      "    distancia = detectar(angulo)\n\n" +
      "    if distancia is not None:\n" +
      "        if distancia <= 62:\n" +
      "            atirar(angulo, distancia)\n" +
      "        else:\n" +
      "            mover(angulo, 50)\n" +
      "            esperar(5)\n" +
      "            parar()\n\n" +
      "    if energia() < energia_anterior:\n" +
      "        energia_anterior = energia()\n" +
      "        mover((angulo + 90) % 360, 60)\n" +
      "        esperar(4)\n" +
      "        parar()\n\n" +
      "    angulo = (angulo + passo) % 360\n",
  },
  {
    id: "sentinela",
    title: "Sentinela",
    description:
      "Fica em posição defensiva, observa um arco de noventa graus e reposiciona a varredura quando sofre dano.",
    code:
      "# Sentinela: guarda uma região e escaneia um arco curto.\n" +
      "inicio_varredura = 180\n" +
      "energia_anterior = energia()\n\n" +
      "while True:\n" +
      "    for passo in range(0, 91, 3):\n" +
      "        angulo = (inicio_varredura + passo) % 360\n" +
      "        distancia = detectar(angulo)\n\n" +
      "        if distancia is not None and distancia <= 62:\n" +
      "            atirar(angulo, distancia)\n\n" +
      "        if energia() < energia_anterior:\n" +
      "            energia_anterior = energia()\n" +
      "            inicio_varredura = (inicio_varredura + 90) % 360\n" +
      "            break\n",
  },
  {
    id: "patrulheiro",
    title: "Patrulheiro",
    description:
      "Move-se como uma torre: patrulha na horizontal e verifica as quatro direções principais antes de continuar.",
    code:
      "# Patrulheiro: anda na horizontal e olha nos eixos principais.\n" +
      "curso = 180\n" +
      "limite = 24\n\n" +
      "while True:\n" +
      "    for angulo in [0, 90, 180, 270]:\n" +
      "        distancia = detectar(angulo)\n" +
      "        while distancia is not None and distancia <= 62:\n" +
      "            parar()\n" +
      "            atirar(angulo, distancia)\n" +
      "            distancia = detectar(angulo)\n\n" +
      "    if curso == 0 and posicao_x() > 90:\n" +
      "        curso = 180\n" +
      "        limite = 24\n" +
      "    elif curso == 180 and posicao_x() < limite:\n" +
      "        curso = 0\n" +
      "        limite = 90\n\n" +
      "    mover(curso, 30)\n" +
      "    esperar(2)\n",
  },
];

export const finalBattleSuggestion =
  "Use as paredes para quebrar a linha de visão. Faça varreduras curtas, pare antes de atirar e detecte de novo depois de qualquer movimento.";
