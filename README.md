# Maria Fire

Maria Fire é um jogo educativo de programação em Python. O estudante escreve código para controlar o Filho de Maria em um território 2D, usando funções como `detectar`, `mover`, `parar` e `atirar` para resolver dez fases progressivas.

O objetivo pedagógico é ensinar pensamento computacional com prática imediata: chamadas de função, parâmetros, variáveis, retornos, condicionais, repetições, sensores, movimento e estratégia.

## Tecnologias

- Vite
- Monaco Editor
- Pyodide executado em Web Worker
- Canvas 2D
- IndexedDB com fallback para `localStorage`
- Vitest
- ESLint

## Instalação

```bash
npm ci
```

## Execução

```bash
npm run dev
```

Depois abra o endereço mostrado pelo Vite. Em desenvolvimento a aplicação usa base `/`.

## Testes

```bash
npm run test
```

Os testes cobrem geometria, disparos, movimento, fases e progresso. A simulação é testada sem Canvas e sem DOM.

## Build

```bash
npm run build
```

O build publica a aplicação em `dist` e copia os recursos do Pyodide para `dist/pyodide`.

## GitHub Pages

O workflow fica em `.github/workflows/deploy.yml`. Em push para `main`, ele executa:

1. `npm ci`
2. `npm run test`
3. `npm run build`
4. publicação de `dist` com as actions oficiais do GitHub Pages

O workflow usa Node.js 24 e as versões atuais das actions oficiais de Pages. Antes do primeiro deploy, configure o repositório em `Settings > Pages > Source > GitHub Actions`. Como alternativa, crie um secret chamado `PAGES_TOKEN` com permissão administrativa/Pages para permitir que `actions/configure-pages` habilite o Pages automaticamente.

O `base` do Vite é calculado dinamicamente a partir de `GITHUB_REPOSITORY`, então o projeto funciona tanto em desenvolvimento com `/` quanto no GitHub Pages em `/<nome-do-repositório>/`.

## Arquitetura

- `src/config/levels.js`: dez fases declarativas, com território, metas, lições e `hintCode`.
- `src/config/levelDemos.js`: roteiros internos das prévias animadas das fases.
- `src/simulation`: motor determinístico, geometria, movimento, sensores, disparos, adversários e avaliação.
- `src/python`: worker com Pyodide e runner usado pela interface.
- `src/storage`: persistência em IndexedDB ou `localStorage`.
- `src/ui`: renderização Canvas.
- `src/tests`: testes automatizados.

A simulação, a renderização, a interface e a execução Python ficam separadas para facilitar testes e evolução.

## API Python

Comandos principais:

```python
atirar(angulo, distancia)
detectar(angulo)
mover(angulo, velocidade)
esperar(ciclos=1)
parar()
posicao_x()
posicao_y()
energia()
inimigos_ativos()
ciclo_atual()
```

`detectar(angulo)` devolve a distância até o alvo mais próximo dentro do feixe do sensor, ou `None` quando não encontra alvo. `atirar(angulo, distancia)` avalia o estado do território, não compara o texto do código com uma solução pronta.

## Sistema de coordenadas

O território usa coordenadas lógicas de `0` a `100`.

- `x` cresce para a direita.
- `y` cresce para cima.
- `0` graus aponta para a direita.
- `90` graus aponta para cima.
- `180` graus aponta para a esquerda.
- `270` graus aponta para baixo.

O Canvas converte esse sistema para coordenadas de tela, onde o eixo vertical cresce para baixo.

## Como criar uma fase

Adicione um objeto em `src/config/levels.js` com:

```javascript
{
  id: "fase-11",
  number: 11,
  title: "Nova fase",
  objective: "Objetivo do estudante",
  concepts: ["conceito"],
  lesson: {
    programming: "Conceito de programação",
    python: "Explicação da API",
    strategy: "Estratégia sugerida",
    exampleCode: "print('exemplo')",
    video: {
      type: "none",
      src: "",
      poster: "",
      captions: "",
      transcript: "Descrição textual."
    }
  },
  arena: {
    width: 100,
    height: 100,
    player: { x: 20, y: 50, angle: 0, energy: 100 },
    opponents: [],
    obstacles: []
  },
  starterCode: "",
  hintCode: "angulo = 0  # CORRIGIR: ajuste o ângulo\n",
  goals: {
    maxLines: 8,
    maxActions: 40,
    requiredCommands: ["detectar"]
  },
  success: {
    type: "defeat-target"
  }
}
```

Cada `hintCode` deve conter entre um e três comentários no formato exato `# CORRIGIR:`.

Para que a tela inicial da fase mostre uma prévia animada, adicione também um roteiro em `src/config/levelDemos.js`. Esse roteiro usa comandos da simulação, mas não aparece no editor nem revela o gabarito ao estudante.

## Como adicionar um adversário

Inclua um item em `arena.opponents`, que representa os adversários do território:

```javascript
{
  id: "sentinela",
  name: "Sentinela",
  x: 78,
  y: 78,
  angle: 180,
  energy: 45,
  ai: "sentinel"
}
```

Comportamentos existentes: `static`, `guard`, `sentinel`, `patrol` e `evasive`.

## Como ajustar a prévia das fases

A tela inicial de cada fase exibe uma breve descrição e uma simulação em loop. Para alterar essa prévia, edite `src/config/levelDemos.js` com uma sequência de comandos como `detectar`, `mover`, `esperar`, `parar` e `atirar`.

Use `$last` quando um comando precisar reaproveitar o último valor devolvido por `detectar`, por exemplo:

```javascript
{ command: "detectar", args: [0] },
{ command: "atirar", args: [0, "$last"] }
```

## Como substituir personagens

Os personagens usam sprites locais em `public/sprites`. Cada personagem precisa de atlas `.png` e metadados `.json` para os estados:

- `idle`
- `walking`
- `shooting`
- `dying`

Os arquivos atuais seguem os nomes `son-idle.png`, `son-idle.json`, `enemy-idle.png`, `enemy-idle.json` e assim por diante. O jogo não depende de imagens externas.

## Como alterar o nome do jogo

Altere:

- `<title>` em `index.html`
- cabeçalho em `index.html`
- textos do `README.md`
- opcionalmente o nome do pacote em `package.json`

## Limitações de segurança do Pyodide

O código Python roda no navegador, dentro de um Web Worker. Isso evita travar a interface principal, mas não transforma o ambiente em uma sandbox de segurança completa para código não confiável. Laços infinitos são interrompidos encerrando o worker por timeout; ainda assim, não exponha segredos, tokens ou APIs privadas ao código do estudante.

## Licença e referências

A licença MIT do repositório foi preservada em `LICENSE`.

Pond Tutor e Pond Duck foram usados apenas como referências conceituais de mecânica e progressão pedagógica. Este projeto não copia personagens, sprites, sons, textos integrais, layout, identidade visual ou código desnecessário. Os recursos visuais são próprios e carregados localmente.
