export type AbaDeCategoria = {
  label: string
  href: string
  handle?: string
}

/** O mínimo que uma aba precisa saber de uma categoria. */
export type CategoriaParaAba = {
  name?: string | null
  handle?: string | null
  parent_category?: { id?: string | null } | null
  category_children?: ({ name?: string | null; handle?: string | null } | null)[] | null
}

/**
 * As abas do catálogo, montadas a partir da árvore de categorias.
 *
 * A primeira aba é sempre **Todas**, e ela aponta para `/store` — a página em que
 * a loja lista o catálogo inteiro. As outras são as categorias **de raiz**: a
 * árvore do Medusa é plana hoje (nenhuma categoria tem mãe), e é a raiz que
 * representa uma prateleira no menu.
 *
 * Quando a página atual é uma categoria **com filhas**, as filhas entram na barra
 * depois das raízes. É a navegação que a página de categoria já oferecia (a lista
 * de subcategorias) — sem ela, quem chega numa categoria com filhas não teria como
 * descer um nível, porque a lista antiga saiu para dar lugar às abas.
 *
 * Categoria sem `handle` fica de fora: uma aba para um endereço que não existe é
 * um clique que termina em "não encontrado".
 */
export function abasDoCatalogo(
  categorias: CategoriaParaAba[],
  atual?: CategoriaParaAba | null
): AbaDeCategoria[] {
  const abas: AbaDeCategoria[] = [{ label: "Todas", href: "/store" }]

  const aba = (categoria: CategoriaParaAba): AbaDeCategoria | null => {
    const handle = (categoria.handle ?? "").trim()

    if (handle === "") {
      return null
    }

    return {
      label: (categoria.name ?? "").trim() || handle,
      href: `/categories/${handle}`,
      handle,
    }
  }

  for (const categoria of categorias) {
    if (categoria.parent_category || !categoria.handle) {
      continue
    }

    const raiz = aba(categoria)

    if (raiz) {
      abas.push(raiz)
    }
  }

  for (const filha of atual?.category_children ?? []) {
    const item = filha ? aba(filha) : null

    // A categoria atual já está na barra quando ela é de raiz; uma filha
    // repetida (dados inconsistentes) também não entra duas vezes.
    if (item && !abas.some((existente) => existente.handle === item.handle)) {
      abas.push(item)
    }
  }

  return abas
}
