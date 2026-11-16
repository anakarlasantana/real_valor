/**
 * As regras da limpeza do seed antigo — puras, para serem testadas sem banco.
 *
 * O que elas selecionam é **resíduo**, não conteúdo: o catálogo de demonstração
 * que o seed criava até 08/10/2026, os locais de estoque que o seed duplicava
 * antes da checagem de idempotência e as opções de frete `manual/flat` que
 * foram substituídas pelo SuperFrete.
 */

/** Os handles do catálogo de demonstração. Título muda; handle é a chave. */
export const PRODUTOS_DO_SEED_ANTIGO = [
  "vestido-midi-linho-floral",
  "camisa-alfaiataria-seda-pura",
  "calca-pantalona-cintura-alta",
] as const

export type ProdutoResumo = { id: string; handle?: string | null }
export type LocalResumo = { id: string; created_at?: string | Date }
export type NiveisPorLocal = Record<string, number>
export type OpcaoResumo = {
  id: string
  provider_id?: string | null
  price_type?: string | null
  data?: { servico?: string } | null
}

/** Os ids dos produtos de demonstração que ainda existirem. */
export function produtosDoSeedAntigo(produtos: ProdutoResumo[]): string[] {
  const alvos = new Set<string>(PRODUTOS_DO_SEED_ANTIGO)

  return produtos
    .filter((produto) => produto.handle && alvos.has(produto.handle))
    .map((produto) => produto.id)
}

/**
 * Qual local de estoque fica: o primeiro **com** estoque (é nele que as peças
 * do lojista estão) e, se nenhum tiver, o mais antigo.
 */
export function localQueFica(
  locais: LocalResumo[],
  niveis: NiveisPorLocal
): string | undefined {
  const ordenados = [...locais].sort(
    (a, b) => tempoDe(a.created_at) - tempoDe(b.created_at)
  )

  return (
    ordenados.find((local) => (niveis[local.id] ?? 0) > 0)?.id ??
    ordenados[0]?.id
  )
}

/** Os locais que podem sair: todos menos o que fica, e só os **sem** estoque. */
export function locaisExcedentes(
  locais: LocalResumo[],
  niveis: NiveisPorLocal
): string[] {
  const fica = localQueFica(locais, niveis)

  return locais
    .filter((local) => local.id !== fica)
    .filter((local) => (niveis[local.id] ?? 0) === 0)
    .map((local) => local.id)
}

/** As opções de preço fixo do provider manual — o SuperFrete tomou o lugar. */
export function opcoesLegadas(opcoes: OpcaoResumo[]): string[] {
  return opcoes
    .filter(
      (opcao) =>
        opcao.provider_id === "manual_manual" && opcao.price_type === "flat"
    )
    .map((opcao) => opcao.id)
}

/**
 * Os serviços do SuperFrete que o seed antigo criava **desligados** (Jadlog,
 * J&T, Loggi): não estão no mínimo, e nascer desligado é sujeira na tela.
 */
export function opcoesForaDoMinimo(
  opcoes: OpcaoResumo[],
  servicosQueFicam: readonly string[]
): string[] {
  const ficam = new Set(servicosQueFicam)

  return opcoes
    .filter((opcao) => opcao.provider_id === "superfrete_superfrete")
    .filter((opcao) => !ficam.has(String(opcao.data?.servico ?? "")))
    .map((opcao) => opcao.id)
}

function tempoDe(valor: string | Date | undefined): number {
  if (!valor) {
    return Number.MAX_SAFE_INTEGER
  }

  const tempo = new Date(valor).getTime()

  return Number.isFinite(tempo) ? tempo : Number.MAX_SAFE_INTEGER
}
