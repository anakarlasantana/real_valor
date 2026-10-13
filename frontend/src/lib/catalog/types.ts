// O vocabulário do catálogo que a `lib` compartilha com a UI. A narrativa do
// `SortOptions` — que morava no componente e era importado pelo dado, a inversão
// que a R-A proíbe — está em docs/real-valor/15-arquitetura-modular.md §15.6.

/** As três ordens que a loja sabe aplicar (`sortProducts`). */
export type SortOptions = "price_asc" | "price_desc" | "created_at"

/** A ordem de quem não escolheu nenhuma: uma só, para as cinco telas. */
export const DEFAULT_SORT: SortOptions = "created_at"
