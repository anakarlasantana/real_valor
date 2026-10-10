/**
 * As marcas inline do texto do conteúdo — e por que elas são texto.
 * ---------------------------------------------------------------------------
 * O `prose` (doc 14, 14.6.3) guarda o texto longo como **texto**: negrito é
 * `**texto**` dentro da string, e não `<strong>` numa coluna. Não é economia —
 * é o que torna o XSS impossível **por construção**, em vez de por sanitizador:
 *
 *   - quem interpreta a string é este arquivo, e ele devolve **nós React**
 *     (`<strong>`, `<em>`, `<s>`, `<a>`) — nunca uma string de HTML;
 *   - o que é texto, o React escapa: `**<script>alert(1)</script>**` aparece
 *     literalmente na tela;
 *   - não existe `dangerouslySetInnerHTML` em lugar nenhum do storefront.
 *
 * O caminho contrário — HTML gravado no banco — precisaria de um sanitizador
 * rodando no SERVIDOR para adivinhar o que tirar: dependência de runtime no
 * storefront e uma corrida entre o que o sanitizador conhece e o que o
 * navegador aceita.
 *
 * **O subconjunto é fechado, e o que não está nele sai literal.** Não há `##`
 * nem `- item`: a estrutura é dado (o `kind` do item em `blocks`), então não há
 * duas formas de escrever a mesma coisa. Marca desconhecida (`__x__`) e marca
 * aberta e não fechada (`**a`) também saem literais — a diferença entre "não
 * funciona" e "desapareceu sem avisar" é a diferença entre um chamado de
 * suporte e um texto errado no ar.
 *
 * **O `href` é allowlist, não blocklist.** `[clique](javascript:alert(1))` é
 * XSS **sem HTML nenhum**, e é o caso que este arquivo existe para fechar. Só
 * passam `http:`, `https:`, `mailto:`, `tel:` e caminho do próprio site
 * (`/rota`, `#ancora`); o resto — inclusive `//evil.com`, que começa com `/` e
 * sai do site — vira texto.
 *
 * **`INLINE_MARKS` é a fonte única.** No PR3 do doc 14 (o `prose`) a mesma lista
 * é declarada no contrato (`MARKDOWN_MARKS`) para o painel desenhar a barra de
 * marcas — o painel **não** pode importar valor do contrato (ver
 * `admin/tsconfig.json`), então ela chega lá pelo payload do `schema` —, e
 * `markdown.spec.tsx` passa a cobrar as duas listas iguais. Hoje há uma só, e a
 * spec já a percorre inteira: marca declarada e não desenhada falha o teste.
 *
 * Este arquivo é TSX (e não TS) porque devolve JSX: os nós são construídos
 * aqui, no render do servidor, e não há string de HTML em lugar nenhum.
 */
import type { ReactNode } from "react"

/**
 * As marcas do subconjunto, na ordem em que o texto é varrido.
 *
 * `boundary` é a regra do `_` (a mesma do CommonMark): itálico só entre
 * **fronteiras de palavra**, senão todo `snake_case` — e todo `a_b_c` de um
 * texto técnico — viraria itálico dentro da palavra.
 */
export const INLINE_MARKS = [
  { marker: "**", label: "Negrito", element: "strong", boundary: false },
  { marker: "~~", label: "Riscado", element: "s", boundary: false },
  { marker: "_", label: "Itálico", element: "em", boundary: true },
] as const

export type InlineElement = (typeof INLINE_MARKS)[number]["element"]

/** O texto interpretado: pedaço literal, marca, ou link. */
export type InlineNode =
  | { kind: "text"; text: string }
  | { kind: "mark"; element: InlineElement; children: InlineNode[] }
  | { kind: "link"; href: string; children: InlineNode[] }

/** Os esquemas permitidos, sem o `:` (que entra na comparação). */
const ALLOWED_SCHEMES = ["http", "https", "mailto", "tel"]

/**
 * O teto de aninhamento.
 *
 * Não é preciosismo: a marca de dentro é interpretada pela mesma função, e um
 * texto patológico (centenas de delimitadores) chegaria a centenas de chamadas
 * empilhadas. Passando daqui, a marca sai literal — a mesma degradação do resto
 * do arquivo, e não um erro no meio da página.
 */
const MAX_DEPTH = 20

/** Fronteira de palavra — letra ou número, com acento, porque o texto é pt-BR. */
function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[0-9A-Za-zÀ-ÿ]/.test(char)
}

function isSpace(char: string | undefined): boolean {
  return char !== undefined && /\s/.test(char)
}

/**
 * O endereço pode virar `href`?
 *
 * Allowlist e não blocklist porque a lista de esquemas perigosos não tem fim
 * (`javascript:`, `data:`, `vbscript:`, `blob:`…) e porque o que se escreve à
 * mão numa página institucional é quase sempre caminho do próprio site.
 */
export function isAllowedHref(href: string): boolean {
  const value = href.trim()

  // Endereço com espaço ou quebra de linha no meio não é endereço: é o disfarce
  // clássico de `java\nscript:`.
  if (value === "" || /\s/.test(value)) return false

  // `//evil.com` começa com `/` e é outro site — o único caso que engana a
  // regra do "começa com barra".
  if (value.startsWith("//")) return false

  if (value.startsWith("/") || value.startsWith("#")) return true

  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(value)

  if (scheme !== null) return ALLOWED_SCHEMES.includes(scheme[1].toLowerCase())

  // Sem esquema nenhum é caminho relativo (`trocas-e-devolucoes`). Um `:` solto
  // aqui reprova, porque é assim que o esquema se esconde (`%6a` e `&#106;`
  // também não passam: quem os decodifica é o navegador, e o valor que sobra
  // não é um esquema conhecido).
  return !value.includes(":")
}

/** Uma marca simétrica reconhecida em `at`. */
type MarkMatch = { element: InlineElement; inner: string; end: number }

/** Um link reconhecido em `at`. */
type LinkMatch = { href: string; label: string; end: number }

/**
 * O fechamento da marca que abre em `from`, ou `-1`.
 *
 * As recusas são o que mantém a promessa do "sai literal": delimitador colado
 * em delimitador (`**b***`), conteúdo que **termina** em espaço (`**a **`) e —
 * no `_` — fechamento no meio da palavra.
 *
 * Espaço **depois** do fechamento é o caso normal (`_dados_ aqui`) e não é
 * recusa: o que não pode ter espaço colado é o conteúdo, por dentro.
 */
function findClose(
  text: string,
  from: number,
  marker: string,
  boundary: boolean
): number {
  for (let i = from; i <= text.length - marker.length; i += 1) {
    if (!text.startsWith(marker, i)) continue
    if (text[i - 1] === marker[0]) continue
    if (text[i + marker.length] === marker[0]) continue
    if (isSpace(text[i - 1])) continue
    if (boundary && isWordChar(text[i + marker.length])) continue

    return i
  }

  return -1
}

function findMark(text: string, at: number): MarkMatch | null {
  for (const { marker, element, boundary } of INLINE_MARKS) {
    if (!text.startsWith(marker, at)) continue

    // O delimitador tem de ser exatamente a sequência da tabela: `***` não é
    // `**`, e `__` não é `_` — é o que deixa `__negrito__` literal.
    if (text[at - 1] === marker[0]) continue
    if (text[at + marker.length] === marker[0]) continue
    if (boundary && isWordChar(text[at - 1])) continue

    // Espaço colado por dentro do delimitador não é marca: `2 ** 3 ** 4`.
    if (isSpace(text[at + marker.length])) continue

    const close = findClose(text, at + marker.length, marker, boundary)
    if (close === -1) continue

    const inner = text.slice(at + marker.length, close)
    if (inner === "") continue

    return { element, inner, end: close + marker.length }
  }

  return null
}

/**
 * O link que abre em `at`, ou `null`.
 *
 * Sem colchete dentro do rótulo e sem parêntese dentro do endereço: o primeiro
 * `]` e o primeiro `)` fecham. Quando a forma não fecha, ou o esquema não passa
 * no allowlist, o trecho inteiro volta como texto — a marca sai literal, não
 * meio link.
 */
function findLink(text: string, at: number): LinkMatch | null {
  if (text[at] !== "[") return null

  const close = text.indexOf("]", at + 1)
  if (close === -1) return null
  if (text[close + 1] !== "(") return null

  const paren = text.indexOf(")", close + 2)
  if (paren === -1) return null

  const label = text.slice(at + 1, close)
  const href = text.slice(close + 2, paren)

  if (label === "" || !isAllowedHref(href)) return null

  return { href: href.trim(), label, end: paren + 1 }
}

/**
 * O texto em pedaços: literal, marca e link.
 *
 * Pura e sem React — é o que a spec percorre para prender a forma, e é o que
 * permite o aninhamento sem estado nenhum: a marca de dentro chama a mesma
 * função.
 */
export function parseInline(text: string, depth = 0): InlineNode[] {
  if (depth > MAX_DEPTH) return [{ kind: "text", text }]

  const nodes: InlineNode[] = []
  let literal = ""
  let i = 0

  const flush = () => {
    if (literal === "") return
    nodes.push({ kind: "text", text: literal })
    literal = ""
  }

  while (i < text.length) {
    const mark = findMark(text, i)

    if (mark !== null) {
      flush()
      nodes.push({
        kind: "mark",
        element: mark.element,
        children: parseInline(mark.inner, depth + 1),
      })
      i = mark.end
      continue
    }

    const link = findLink(text, i)

    if (link !== null) {
      flush()
      nodes.push({
        kind: "link",
        href: link.href,
        children: parseInline(link.label, depth + 1),
      })
      i = link.end
      continue
    }

    literal += text[i]
    i += 1
  }

  flush()

  return nodes
}

function renderNodes(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    // `text` volta como string: o React escapa sozinho, e uma string numa lista
    // não precisa de `key`.
    if (node.kind === "text") return node.text

    const key = `${index}-${node.kind}`

    if (node.kind === "link") {
      return (
        <a key={key} href={node.href}>
          {renderNodes(node.children)}
        </a>
      )
    }

    const Tag = node.element

    return <Tag key={key}>{renderNodes(node.children)}</Tag>
  })
}

/**
 * O texto do conteúdo pronto para o JSX: `<p>{renderInline(bloco.text)}</p>`.
 *
 * É a única porta de entrada do texto no render — e por isso não existe
 * `dangerouslySetInnerHTML` em lugar nenhum do storefront.
 */
export function renderInline(text: string): ReactNode[] {
  return renderNodes(parseInline(text))
}
