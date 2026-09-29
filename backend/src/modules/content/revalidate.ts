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
 */
import type { Logger } from "@medusajs/types"

/** Teto do aviso: a rota do conteúdo não fica presa esperando o storefront. */
const TIMEOUT_MS = 3000

/** A tag que `getHomeSections` usa no cache (`CONTENT_CACHE_TAG`). */
const CONTENT_TAG = "content"

export async function revalidateContent(logger: Logger): Promise<void> {
  const url = process.env.FRONTEND_URL
  const secret = process.env.REVALIDATE_SECRET

  if (!url || !secret) {
    return
  }

  const target = `${url.replace(/\/+$/, "")}/api/revalidate?tag=${CONTENT_TAG}`

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
        `O storefront recusou a revalidação do conteúdo (HTTP ${res.status}). ` +
          `A loja continua correta e se atualiza sozinha em até um minuto.`
      )
    }
  } catch (error) {
    logger.warn(
      `Não foi possível revalidar o conteúdo no storefront (${error}). ` +
        `A loja continua correta e se atualiza sozinha em até um minuto.`
    )
  }
}
