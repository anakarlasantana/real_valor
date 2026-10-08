import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import {
  ProductCategoryWorkflowEvents,
  ProductCollectionWorkflowEvents,
  ProductVariantWorkflowEvents,
  ProductWorkflowEvents,
} from "@medusajs/framework/utils"

import { notifyStorefrontTag } from "../modules/content/revalidate"

/**
 * O aviso à loja quando o CATÁLOGO muda — o que faltava para "salvei no painel e
 * a loja mudou".
 * -------------------------------------------------------------------------
 * O conteúdo já tinha esse aviso (`modules/content/revalidate.ts`, chamado pelas
 * rotas de `/admin/content`). O catálogo não tinha **nenhum**: criar, editar ou
 * publicar peça, variante, categoria ou coleção no painel não avisava o
 * storefront, e o cache do catálogo não tinha janela de expiração
 * (`force-cache` sem `revalidate`, ver `frontend/src/lib/data/cookies.ts`).
 *
 * O efeito medido: uma peça publicada no painel aparecia em `/br/store` e na
 * página da categoria — as chaves de cache dessas consultas eram novas — e
 * **não** aparecia nas seções da home, cuja entrada (`limit=8`, sem filtro) tinha
 * sido gravada antes da publicação e não expirava nunca. O lojista conclui, com
 * razão, que o painel não publica.
 *
 * As três portas do problema, e o que este arquivo cobre:
 *
 *   1. cache do catálogo sem janela  → `revalidate: 60` no `cookies.ts` (teto de
 *      defasagem, não o caso normal);
 *   2. nada avisando a loja na hora  → este subscriber;
 *   3. ninguém limpando a entrada já gravada → o aviso (`revalidateTag`) é o
 *      único jeito, e por isso ele é disparado a cada gravação, e não só na
 *      primeira.
 *
 * **Por que três eventos de variante e não só de produto.** Preço, estoque,
 * imagem e os hexes de cor vivem na variante: é o `product-variant.updated` que
 * a lojista dispara quando corrige o preço de um tamanho — e é justamente o
 * caso em que a vitrine precisa mudar.
 *
 * **Por que categoria e coleção também revalidam `products`.** O nome e a ordem
 * de categoria/coleção entram na listagem de produtos (os `fields` do storefront
 * pedem `*collection`/`*categories`), então mexer na categoria sem limpar
 * `products` deixaria o filtro da vitrine desatualizado — a mesma classe de bug,
 * em outro lugar.
 *
 * **O aviso é `void`, e não pode atrasar o CRUD.** `notifyStorefrontTag` não
 * lança e tem timeout próprio (3s); se `FRONTEND_URL` ou `REVALIDATE_SECRET` não
 * estiverem no ambiente, ele simplesmente volta. Nenhum caminho daqui derruba
 * uma gravação no painel — o pior caso é a defasagem de 60s da janela.
 *
 * **Custo conhecido:** cada evento é um `POST` para o storefront. Um script em
 * massa (o enriquecimento do doc 12 toca N variantes de uma vez) vira N avisos
 * em rajada. É idempotente e barato (`revalidateTag` repetido é a mesma limpeza),
 * mas é o motivo de não haver aqui nenhum `await`: a rajada não segura o CRUD.
 */
export const TAGS_BY_EVENT: Record<string, readonly string[]> = {
  [ProductWorkflowEvents.CREATED]: ["products"],
  [ProductWorkflowEvents.UPDATED]: ["products"],
  [ProductWorkflowEvents.DELETED]: ["products"],
  [ProductVariantWorkflowEvents.CREATED]: ["products"],
  [ProductVariantWorkflowEvents.UPDATED]: ["products"],
  [ProductVariantWorkflowEvents.DELETED]: ["products"],
  [ProductCategoryWorkflowEvents.CREATED]: ["categories", "products"],
  [ProductCategoryWorkflowEvents.UPDATED]: ["categories", "products"],
  [ProductCategoryWorkflowEvents.DELETED]: ["categories", "products"],
  [ProductCollectionWorkflowEvents.CREATED]: ["collections", "products"],
  [ProductCollectionWorkflowEvents.UPDATED]: ["collections", "products"],
  [ProductCollectionWorkflowEvents.DELETED]: ["collections", "products"],
}

/**
 * A tag que o evento limpa — a única pergunta que o handler faz.
 *
 * Mora fora do handler porque é a **regra** (o que cada evento invalida) e é o
 * que o teste prende: um evento novo que precise de tag nova não tem como passar
 * despercebido, porque a lista de eventos assinados sai deste mapa.
 */
export function tagsForEvent(eventName: string): readonly string[] {
  return TAGS_BY_EVENT[eventName] ?? []
}

export default async function catalogRevalidateHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  for (const tag of tagsForEvent(event.name)) {
    notifyStorefrontTag(container, tag)
  }
}

/** A lista de eventos é **derivada** do mapa: uma resposta só para a pergunta. */
export const config: SubscriberConfig = {
  event: Object.keys(TAGS_BY_EVENT),
}
