// Contagem de comentário de fonte — a medida da catraca de `check-comments.mjs`.
// Um lexer de linha, sem dependência: Node puro, para o `make check` rodar sem
// `node_modules`. Política e calibração: `docs/real-valor/15-arquitetura-modular.md`.

/** Linha de comentário: a própria (`// x`, ` * y`) ou o fim de linha (`f() // x`). */
export function commentStats(source) {
  const lines = source.split("\n")
  const state = { block: false, quote: null, escaped: false }
  const perLine = []
  let sawCode = false
  let header = null
  let headerOver = false

  for (const line of lines) {
    const flags = scanLine(line, state)
    perLine.push(flags)

    if (!sawCode) {
      if (flags.code) {
        sawCode = true
      } else if (flags.comment && !headerOver) {
        // O cabeçalho é o PRIMEIRO bloco contíguo de comentário, antes da
        // primeira linha de código. Uma linha em branco dentro dele já não é
        // cabeçalho: é o começo da narrativa que a política quer fora do arquivo.
        header = (header ?? 0) + 1
        continue
      } else if (header !== null && !flags.comment) {
        headerOver = true
      }
    }
  }

  return {
    lines: lines.length,
    comments: perLine.filter((flags) => flags.comment).length,
    header,
  }
}

/** Estado do bloco `/* … *\/` e das strings atravessa a chamada. Ver doc 15. */
function scanLine(line, state) {
  let code = false
  let comment = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]

    if (state.block) {
      comment = true

      if (char === "*" && next === "/") {
        state.block = false
        i += 1
      }

      continue
    }

    // A string atravessa a linha de propósito: template literal de várias linhas
    // com `//` dentro é código, não comentário.
    if (state.quote) {
      code = true

      if (state.escaped) state.escaped = false
      else if (char === "\\") state.escaped = true
      else if (char === state.quote) state.quote = null

      continue
    }

    if (char === '"' || char === "'" || char === "`") {
      state.quote = char
      code = true
      continue
    }

    if (char === "/" && next === "*") {
      state.block = true
      comment = true
      i += 1
      continue
    }

    if (char === "/" && next === "/" && line[i - 1] !== ":") {
      comment = true
      break
    }

    if (!/\s/.test(char)) code = true
  }

  return { code, comment }
}
