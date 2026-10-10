import { ArrowRightMini, MagnifyingGlass } from "@medusajs/icons"
import type { Metadata } from "next"

import { getLivePages } from "@lib/data/pages"
import EmptyState from "@modules/common/components/empty-state"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * /paginas — o índice público das páginas que estão no ar.
 * -------------------------------------------------------------------------
 * É o terceiro item do PR7 do doc 14 ("as páginas no rodapé, no índice público e
 * na sugestão do 404"), e o mais simples dos três: uma lista de links para as
 * páginas **publicadas** da loja. Existe porque a página institucional responde a
 * uma pergunta que a cliente já sabe fazer ("qual é a política de troca?") e não
 * ajuda quem **não** sabe o que o site tem — e porque um 404 honesto precisa de
 * um lugar para onde mandar quem se perdeu.
 *
 * **A lista não é conferida aqui.** Quem decide o que está no ar é o servidor
 * (`publishedSections` + `pageState`, no contrato — a mesma régua que a rota
 * `[slug]` aplica antes de responder 404), e chega pronta em `getLivePages()`.
 * Uma lista montada do contrato às cegas teria exatamente o defeito que o doc 13
 * mediu: prometer endereço que não abre.
 *
 * **O vazio é honesto.** Rodapé sem página no ar é o estado normal de uma loja
 * que ainda não escreveu as páginas, e o índice dele diz isso em vez de abrir uma
 * lista vazia. O caminho de saída é o catálogo, o mesmo do 404 — quem se perde no
 * meio da compra quer continuar comprando.
 *
 * `revalidate` é a janela do CMS (60s), a mesma das outras leituras de conteúdo:
 * publicar a página no CRM a faz aparecer aqui em até um minuto, e o
 * `revalidateTag("content")` do admin força antes.
 */
export const metadata: Metadata = {
  title: "Todas as páginas",
  description:
    "As páginas do site: a história da marca, trocas e devoluções, privacidade, termos de uso e contato.",
}

export const revalidate = 60

export default async function PagesIndex() {
  const pages = await getLivePages()

  return (
    <main className="rv-page-shell">
      <div className="rv-container">
        <p className="rv-eyebrow text-rv-rose-strong">Real Valor</p>
        <h1 className="rv-page-heading mt-3">Todas as páginas</h1>
        <p className="mt-4 max-w-xl text-rv-muted">
          O que a loja tem escrito hoje: a história da marca, as regras de troca
          e devolução, a privacidade, os termos e como falar com a gente.
        </p>

        {pages.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={<MagnifyingGlass aria-hidden="true" focusable="false" />}
              title="Nenhuma página publicada ainda"
              text="As páginas da loja aparecem aqui assim que forem escritas — e o catálogo já está no ar."
            >
              <LocalizedClientLink
                href="/store"
                className="rv-btn rv-btn-primary"
              >
                Ver todas as peças
              </LocalizedClientLink>
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-10 flex flex-col" data-testid="pages-index">
            {pages.map((page) => (
              <li key={page.id} className="border-b border-rv-dourado">
                <LocalizedClientLink
                  href={page.path}
                  data-testid="pages-index-link"
                  className="flex items-center justify-between gap-x-4 py-5 transition-colors duration-200 hover:text-rv-rose"
                >
                  <span className="rv-display text-xl">{page.label}</span>
                  <ArrowRightMini aria-hidden="true" focusable="false" />
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
