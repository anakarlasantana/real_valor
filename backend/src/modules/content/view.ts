/**
 * A forma de saída da seção — achatada, como a da rota pública.
 * -------------------------------------------------------------------------
 * A seção no banco é uma linha com colunas de controle e um `data` JSON; o que
 * o CRM recebe é o **achatamento** dos dois, porque é isso que o formulário
 * desenha e o que ele devolve no "Salvar". O mesmo formato vale para a rota
 * pública (`/store/content`), que usa `service.listSections` — a mesma ideia,
 * escrita uma vez em cada lado porque uma é linha do banco e a outra é corpo de
 * resposta.
 *
 * Fica fora da rota (`api/admin/content/route.ts`) porque **três** portas o
 * usam — `GET`, `POST` e `PATCH` —, e porque é a parte que não depende de
 * request: qualquer rota (a de ordenação, na R6.5, entre elas) responde uma
 * seção com esta função.
 *
 * `fixed` sai junto: é a coluna que a tela lê para saber se a seção tem ordem
 * (o numeral × a etiqueta "Fixo", e a existência das setas). Ver
 * `models/content-section.ts`.
 */
export function toSection(block: {
  id: string
  enabled: boolean
  position: number
  fixed: boolean
  type: string
  data: unknown
}) {
  return {
    id: block.id,
    enabled: block.enabled,
    position: block.position,
    fixed: block.fixed,
    type: block.type,
    ...((block.data ?? {}) as Record<string, unknown>),
  }
}
