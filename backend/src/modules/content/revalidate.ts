/**
 * Avisa o storefront de que o conteúdo mudou.
 * -------------------------------------------------------------------------
 * As páginas do storefront leem o conteúdo com cache
 * (`next: { tags: ["content"], revalidate: 60 }`, em
 * `frontend/src/lib/data/content.ts`). Sem aviso, uma edição feita no CRM só
 * aparece na loja no próximo ciclo — até um minuto depois de o lojista ler
 * "Conteúdo salvo", que é o intervalo em que ele conclui que não funcionou.
 *
 * O aviso é o mesmo endpoint que o `make revalidate` chama
 * (`POST /api/revalidate?tag=content`), com o segredo combinado. São duas
 * variáveis de ambiente, e **as duas são necessárias para o aviso existir**:
 *
 *   FRONTEND_URL       o storefront visto de dentro da rede (`http://frontend:8000`)
 *   REVALIDATE_SECRET  o mesmo segredo que o storefront tem no ambiente dele
 *
 * Sem elas o aviso é simplesmente pulado, e nada quebra: a loja continua
 * correta, só dentro da janela de 60s. Falha de rede também não sobe para a
 * resposta HTTP — a gravação já aconteceu e é ela que importa; o cache é
 * consequência. Por isso a função nunca lança e o chamador pode disparar sem
 * `await`.
 *
 * UMA TAG SÓ NÃO BASTAVA
 * O catálogo (`products`, `categories`, `collections`) tinha o mesmo problema do
 * conteúdo — e pior: até aqui não tinha aviso nenhum, e o cache do catálogo não
 * tinha janela (`force-cache` sem `revalidate` = entrada que não expira).
 * Publicar uma peça no painel deixava a loja defasada até alguém rodar
 * `make revalidate TAG=products` na mão.
 *
 * Por isso o aviso passou a receber a **tag**: `revalidateStorefrontTag` é o
 * núcleo (HTTP puro, sem saber o que é conteúdo) e `revalidateContent` é o caso
 * `content` — que é o único que já existia. O consumidor novo é
 * `subscribers/catalog-revalidate.ts`, que importa daqui porque **o helper mora
 * onde nasceu**, e movê-lo agora espalharia a mudança por quatro rotas do CRM
 * sem ganho: ele não lê nada do módulo de conteúdo, só o `FRONTEND_URL` e o
 * `REVALIDATE_SECRET` do ambiente.
 */
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { Logger, MedusaContainer } from "@medusajs/framework/types"

/** Teto do aviso: a rota do conteúdo não fica presa esperando o storefront. */
const TIMEOUT_MS = 3000

/** A tag que `getHomeSections` usa no cache (`CONTENT_CACHE_TAG`). */
const CONTENT_TAG = "content"

/**
 * O aviso, do jeito que as rotas o usam: sem `await`.
 *
 * Mora aqui, e não em cada rota, porque **quatro** portas precisam do mesmo
 * aviso — as três de `/admin/content` e a de ordenação (R6.5) —, e a
 * alternativa é cada uma repetir o `void` com o logger do scope. Recebe o
 * **container** (e não a requisição) porque é tudo de que precisa: quem avisa é
 * a rota, depois de gravar.
 */
export function notifyStorefront(scope: MedusaContainer): void {
  void revalidateContent(scope.resolve(ContainerRegistrationKeys.LOGGER))
}

/**
 * O mesmo aviso, para qualquer tag do storefront — e não só `content`.
 *
 * Existe pelo catálogo: `subscribers/catalog-revalidate.ts` precisa avisar
 * `products` (e `categories`, `collections`) depois de gravar, e a alternativa
 * seria o subscriber repetir aqui o `void` com o logger do scope e conhecer o
 * `AbortSignal.timeout`. Quem chama passa a tag; o `POST` é o mesmo.
 */
export function notifyStorefrontTag(scope: MedusaContainer, tag: string): void {
  void revalidateStorefrontTag(
    scope.resolve(ContainerRegistrationKeys.LOGGER),
    tag
  )
}

export async function revalidateContent(logger: Logger): Promise<void> {
  return revalidateStorefrontTag(logger, CONTENT_TAG)
}

/**
 * O núcleo: `POST /api/revalidate?tag=<tag>` no storefront.
 *
 * Nunca lança — a gravação já aconteceu e é ela que importa (ver o cabeçalho).
 * Sem `FRONTEND_URL` ou sem `REVALIDATE_SECRET` volta sem fazer nada: é o caso
 * do ambiente que não tem storefront para avisar, e o storefront responde 500
 * fail-closed quando o segredo dele não está definido, então tentar seria ruído.
 */
export async function revalidateStorefrontTag(
  logger: Logger,
  tag: string
): Promise<void> {
  const url = process.env.FRONTEND_URL
  const secret = process.env.REVALIDATE_SECRET

  if (!url || !secret) {
    return
  }

  const base = url.replace(/\/+$/, "")
  const target = `${base}/api/revalidate?tag=${encodeURIComponent(tag)}`

  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "x-revalidate-secret": secret },
      // O `fetch` do Node não tem timeout por padrão; sem isto, um storefront
      // pendurado deixaria a requisição do CRM esperando.
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      logger.warn(
        `O storefront recusou a revalidação de "${tag}" (HTTP ${res.status}). ` +
          `A loja continua correta e se atualiza sozinha em até um minuto.`
      )
    }
  } catch (error) {
    logger.warn(
      `Não foi possível revalidar "${tag}" no storefront (${error}). ` +
        `A loja continua correta e se atualiza sozinha em até um minuto.`
    )
  }
}
