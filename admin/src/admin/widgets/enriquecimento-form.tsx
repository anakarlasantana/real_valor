/**
 * A regra do widget "Informações da peça" — função pura, não componente.
 * -------------------------------------------------------------------------
 * É o que vale testar: **o que a tela grava e o que ela deixa de gravar**.
 * Testar isso por dentro de um `<form>` diria menos e custaria jsdom, que este
 * pacote não tem (ver `admin/jest.config.js`, e a lacuna declarada lá).
 *
 * O `.tsx` no nome NÃO é engano: dentro de `widgets/`, o plugin do admin
 * (`@medusajs/admin-vite-plugin`) só habilita o parser de TypeScript para
 * arquivos `.tsx`. O `getParserOptions` dele empilha `"jsx"` sempre e
 * `"typescript"` só quando o nome termina em `.tsx` — um `.ts` aqui é lido como
 * **JS puro**, e o `] as const` desta regra derruba o parse:
 *
 *     SyntaxError: Missing semicolon. (38:1)
 *
 * MEDIDO no `make build-admin`: o erro sai duas vezes no log (uma na validação do
 * hash do widget, outra na montagem da lista) e o build termina **verde** —
 * `Backend build completed successfully` e `Frontend build completed
 * successfully (119.35s)`, exit 0. O agravante é que a pasta é varrida **sem
 * filtro de nome** (`crawl(source/widgets)`), enquanto as rotas são varridas por
 * `crawl(source/routes, "page")` — é esse filtro, e não a extensão, que deixa os
 * `.ts` auxiliares de `routes/content` em paz. O `make build-admin` reprova o log
 * que trouxer esse erro; ver o alvo.
 *
 * As três chaves de texto são as do contrato de enriquecimento do storefront
 * (`docs/real-valor/12-script-enriquecimento-catalogo.md`, seção 12.4) — o
 * normalizador de lá lê **exatamente** estas e ignora qualquer outra. A quarta
 * chave, `hex`, não é texto do produto: é da **variante** (uma cor por variante,
 * porque a mesma peça tem cor por combinação).
 *
 * Duas regras do Medusa mandam no desenho, e as duas foram lidas no código
 * instalado, não presumidas:
 *
 * 1. **O update SUBSTITUI o objeto `metadata` inteiro** — não mescla. Mandar só
 *    as três chaves apagaria o que o produto já tem ali, inclusive o que o
 *    próprio painel do Medusa deixa o lojista editar no bloco "Metadata" da
 *    página. Por isso todo corpo daqui **nasce do que existe** e sobrescreve
 *    apenas o que mudou.
 * 2. **`variants.metadata` não vem por padrão** na Admin API
 *    (`api/admin/products/query-config.js`: os defaults têm `*variants`, e não
 *    `variants.metadata`) — e a página de produto pede `-variants`. Daí
 *    `CAMPOS_DO_PRODUTO` ser explícito: sem ele o widget abriria sempre vazio, e
 *    o hex salvo nunca voltaria para a tela.
 *
 * A terceira decisão é nossa, e é a que mais importa para quem usa a loja:
 * **campo em branco REMOVE a chave**, não grava `""`. O storefront decide se
 * desenha a seção pela presença da chave; `care: ""` desenharia uma seção vazia
 * na página da peça, que é pior do que não ter seção nenhuma.
 *
 * A quarta é a cor: o lojista escolhe na **paleta** (`<input type="color">`) ou
 * digita o hex, e os dois caminhos escrevem no MESMO lugar — `estado.hexes`.
 * A paleta não é um segundo cadastro de cor; ela é um jeito de preencher o campo
 * que já existia. Duas consequências disso, as duas em função pura e com teste:
 *
 *   - o que sai da paleta é **normalizado** para `#RRGGBB` maiúsculo antes de
 *     gravar, senão o mesmo valor voltaria minúsculo do navegador (a spec manda o
 *     input devolver minúsculo) e a peça ficaria "mudando" sozinha a cada save;
 *   - o campo nativo **não tem estado vazio**: sem hex gravado ele abre no preto.
 *     É por isso que existe um `COR_PADRAO_DO_SELETOR` explícito, e não
 *     `?? "#000000"` perdido dentro do JSX — e por isso a tela diz, embaixo, que
 *     a amostra só existe depois de escolher.
 */

export const CHAVES_DE_TEXTO = [
  "care",
  "contraindications",
  "size_guide",
] as const

export type ChaveDeTexto = (typeof CHAVES_DE_TEXTO)[number]

/** O que o widget pede à Admin API. O `+` é obrigatório só no último (nota 2). */
export const CAMPOS_DO_PRODUTO = "id,title,metadata,*variants,+variants.metadata"

/**
 * Os rótulos da tela. O `Record<ChaveDeTexto, …>` é declaração de propósito: uma
 * chave nova em `CHAVES_DE_TEXTO` sem rótulo aqui é erro de compilação, não um
 * campo que some da tela em silêncio.
 */
export type Rotulos = Record<
  ChaveDeTexto,
  { label: string; placeholder: string; ajuda: string }
>

/** O produto como a Admin API o devolve nos campos acima — só o que se usa. */
export type ProdutoDoPainel = {
  id: string
  title?: string | null
  metadata?: Record<string, unknown> | null
  variants?:
    | {
        id: string
        title?: string | null
        metadata?: Record<string, unknown> | null
      }[]
    | null
}

export type EstadoEnriquecimento = {
  textos: Record<ChaveDeTexto, string>
  /** O hex por variante, chaveado pelo id dela. */
  hexes: Record<string, string>
}

/** O corpo do `POST /admin/products/:id`: só o que mudou, já mesclado. */
export type CorpoDoEnriquecimento = {
  metadata?: Record<string, unknown>
  variants?: { id: string; metadata: Record<string, unknown> }[]
}


/** O valor de uma chave de `metadata` como texto. Não-string (ou ausente) → `""`. */
export function textoDe(
  metadata: Record<string, unknown> | null | undefined,
  chave: string
): string {
  const valor = metadata?.[chave]

  return typeof valor === "string" ? valor : ""
}

/** `#RRGGBB` é o único formato aceito (seção 12.4, regra 2). */
export function hexValido(valor: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(valor.trim())
}

/**
 * O que a paleta do navegador mostra quando a variante **não tem** hex.
 *
 * O `<input type="color">` não tem estado vazio: o valor dele é sempre uma cor.
 * Preto é o padrão da própria plataforma, e é o que menos mente — não é "o
 * lojista escolheu preto", é "a paleta abre aqui". Quem grava é o `onChange`, não
 * o `value`: abrir a paleta e fechar sem mexer não escreve nada.
 */
export const COR_PADRAO_DO_SELETOR = "#000000"

/**
 * O `value` da paleta para um hex do estado.
 *
 * Hex válido entra em minúsculo porque é o que a spec do input devolve e devolve
 * de novo — assim o `value` que a tela manda é igual ao que ela recebe de volta,
 * e o React não fica reescrevendo o campo. O que é gravado é a forma maiúscula
 * (`normalizarHex`), que é a do contrato (12.4).
 */
export function corDoSeletor(valor: string): string {
  const texto = valor.trim()

  return hexValido(texto)
    ? `#${texto.slice(1).toLowerCase()}`
    : COR_PADRAO_DO_SELETOR
}

/**
 * O hex na forma que **sai** da tela: `#RRGGBB` maiúsculo quando é válido, e o
 * que foi digitado (aparado) quando não é.
 *
 * Texto inválido passa intacto de propósito: quem reprova o salvar é
 * `hexesInvalidos`, e apagar a linha de quem está no meio da digitação (ou
 * corrigindo `"preto"`) seria a tela brigando com o lojista.
 *
 * Com isto, digitar `#b97872` sobre um `#B97872` já gravado **não é mudança** —
 * sem a normalização, o mesmo valor minúsculo viraria um `POST` a cada save.
 */
export function normalizarHex(valor: string): string {
  const texto = valor.trim()

  return hexValido(texto) ? `#${texto.slice(1).toUpperCase()}` : texto
}

export function estadoVazio(): EstadoEnriquecimento {
  return {
    textos: { care: "", contraindications: "", size_guide: "" },
    hexes: {},
  }
}

/** O formulário preenchido a partir do que a Admin API devolveu. */
export function estadoDoProduto(produto: ProdutoDoPainel): EstadoEnriquecimento {
  const estado = estadoVazio()

  for (const chave of CHAVES_DE_TEXTO) {
    estado.textos[chave] = textoDe(produto.metadata, chave)
  }

  for (const variante of produto.variants ?? []) {
    estado.hexes[variante.id] = textoDe(variante.metadata, "hex")
  }

  return estado
}

/**
 * As variantes cujo hex digitado não é `#RRGGBB`.
 *
 * O salvar **para** enquanto esta lista não estiver vazia: gravar texto solto
 * numa chave que o storefront lê como cor deixaria a bolinha do card sem cor e
 * sem explicação. Apagar o campo é o jeito de tirar a chave (ausência não é
 * "inválido").
 */
export function hexesInvalidos(estado: EstadoEnriquecimento): string[] {
  return Object.entries(estado.hexes)
    .filter(([, hex]) => hex.trim() !== "" && !hexValido(hex))
    .map(([id]) => id)
}

/**
 * O corpo do `POST /admin/products/:id`: **só o que mudou**, mesclado sobre o
 * que já existe.
 *
 * | o lojista… | o campo… | o `metadata`… |
 * | :--- | :--- | :--- |
 * | não tocou | (não vai no corpo) | intacto — inclusive as chaves de fora do widget |
 * | escreveu | texto novo | ganha a chave |
 * | apagou | em branco | **perde** a chave (não vira `""`) |
 *
 * Sem nenhuma mudança devolve `{}`, e o widget não faz requisição nenhuma.
 */
export function corpoDoEnriquecimento(
  produto: ProdutoDoPainel,
  estado: EstadoEnriquecimento
): CorpoDoEnriquecimento {
  const corpo: CorpoDoEnriquecimento = {}
  const original = produto.metadata ?? {}
  const metadata: Record<string, unknown> = { ...original }
  let mudouTexto = false

  for (const chave of CHAVES_DE_TEXTO) {
    const digitado = estado.textos[chave].trim()
    const atual = textoDe(original, chave)

    if (digitado === atual) {
      continue
    }

    mudouTexto = true

    if (digitado === "") {
      delete metadata[chave]
    } else {
      metadata[chave] = digitado
    }
  }

  if (mudouTexto) {
    corpo.metadata = metadata
  }

  const variantes: NonNullable<CorpoDoEnriquecimento["variants"]> = []

  for (const variante of produto.variants ?? []) {
    // Variante que o estado não conhece não é apagada por omissão: entre a
    // leitura e a gravação alguém pode ter criado uma variante nova no painel do
    // Medusa, e "não carregada" não é "sem cor".
    if (!(variante.id in estado.hexes)) {
      continue
    }

    const originalDaVariante = variante.metadata ?? {}
    // Normalizado ANTES de comparar: `#b97872` digitado sobre um `#B97872` já
    // gravado é o mesmo valor, e não um motivo para escrever de novo.
    const digitado = normalizarHex(estado.hexes[variante.id])

    if (digitado === textoDe(originalDaVariante, "hex")) {
      continue
    }

    const metadataDaVariante: Record<string, unknown> = {
      ...originalDaVariante,
    }

    if (digitado === "") {
      delete metadataDaVariante.hex
    } else {
      metadataDaVariante.hex = digitado
    }

    variantes.push({ id: variante.id, metadata: metadataDaVariante })
  }

  if (variantes.length) {
    corpo.variants = variantes
  }

  return corpo
}
