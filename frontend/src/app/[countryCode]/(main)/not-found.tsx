import { MagnifyingGlass } from "@medusajs/icons"
import { Metadata } from "next"

import { getLivePages } from "@lib/data/pages"
import EmptyState from "@modules/common/components/empty-state"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export const metadata: Metadata = {
  title: "404",
  description: "Não encontramos esta página",
}

/**
 * A página que não existe — em português, no vazio da casa, com o que existe.
 *
 * O título já estava traduzido; o corpo dizia "The page you tried to access does
 * not exist." e o botão, "Go to frontpage": o mesmo defeito do RV-003, na tela em
 * que a cliente já está perdida. Agora ele usa o `EmptyState` da loja — o mesmo
 * componente do vazio da busca e da sacola —, então um 404 tem a mesma forma de
 * qualquer outro "não tem nada aqui".
 *
 * O caminho de volta é o catálogo, e não a home: quem se perde no meio da compra
 * quer continuar comprando.
 *
 * **A sugestão é o PR7 do doc 14.** Um 404 que só diz "não encontramos" joga a
 * visita fora; ele passa a oferecer as páginas que **estão no ar** — a mesma
 * lista do rodapé e do índice público (`/paginas`), lida de uma vez só
 * (`getLivePages`) e já filtrada pela régua do 200 no servidor. Sugerir um
 * endereço que responde 404 seria pior do que não sugerir nada, e é por isso que
 * a lista não é montada aqui a partir do contrato: o contrato diz que a página
 * pode existir, o conteúdo diz se ela existe hoje.
 *
 * A falha de rede cai no 404 sem sugestão — que continua sendo um 404 honesto.
 */
export default async function NotFound() {
  const pages = await getLivePages()

  return (
    <main className="rv-page-shell">
      <EmptyState
        icon={<MagnifyingGlass aria-hidden="true" focusable="false" />}
        title="Não encontramos esta página"
        text="O endereço pode ter mudado de lugar ou nunca ter existido. Veja as peças que estão no ar."
      >
        <div className="flex flex-col items-center gap-y-4">
          {pages.length > 0 && (
            <>
              <p className="text-sm text-rv-muted">
                Ou dê uma olhada no que a loja tem escrito:
              </p>
              <ul
                className="flex flex-wrap justify-center gap-x-4 gap-y-2"
                data-testid="not-found-pages"
              >
                {pages.map((page) => (
                  <li key={page.id}>
                    <LocalizedClientLink
                      href={page.path}
                      data-testid="not-found-page"
                      className="underline decoration-rv-dourado underline-offset-4 transition-colors duration-200 hover:text-rv-rose"
                    >
                      {page.label}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
              <LocalizedClientLink
                href="/paginas"
                className="text-sm text-rv-muted underline underline-offset-4 transition-colors duration-200 hover:text-rv-rose"
              >
                Ver todas as páginas
              </LocalizedClientLink>
            </>
          )}

          <LocalizedClientLink href="/store" className="rv-btn rv-btn-primary">
            Ver todas as peças
          </LocalizedClientLink>
        </div>
      </EmptyState>
    </main>
  )
}
