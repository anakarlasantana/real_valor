import { type FooterSection } from "@lib/content/home-sections"
import { listCategories } from "@lib/data/categories"
import { listCollections } from "@lib/data/collections"
import { getLivePages } from "@lib/data/pages"
import { ArrowRightMini } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import FooterColumn from "@modules/layout/components/footer-column"
import SocialLinks from "@modules/layout/components/social-links"

/**
 * Rodapé — cromo do site, renderizado pelo layout em todas as rotas.
 *
 * O que o lojista escreve vem do bloco `footer` do CMS (colunas de links e
 * redes sociais), resolvido pelo layout com `footerSections()` e passado
 * pronto para cá, igual ao cabeçalho. O que **não** é conteúdo continua no
 * JSX: a marca, a frase manuscrita e a linha de direitos.
 *
 * As colunas são todas conteúdo: não há coluna fixa no componente, e a de
 * catálogo é só uma origem possível (`source`), escolhida por coluna —
 * ver `FooterColumn`. Por isso o catálogo só é buscado quando alguma
 * coluna aponta para ele: um rodapé com colunas digitadas à mão (ou sem
 * coluna nenhuma) não paga requisição nenhuma.
 *
 * Regra de ouro das listas: vazia esconde o bloco. Vale para as colunas,
 * que é o que permite publicar o rodapé antes de ter tudo.
 *
 * Os links das colunas passam pelo `nav-link`, o mesmo do cabeçalho: um
 * `href` do CMS pode ser âncora (`/#editorial`), rota interna, `https://`
 * ou `mailto:`/`tel:`, e quem decide o comportamento é aquele componente —
 * não este.
 *
 * O rodapé é **preto no redesenho**, e a faixa do Instagram logo acima
 * dele, na home, também. Duas faixas escuras coladas viram uma só, com o
 * dobro da altura e sem começo nem fim. A separação escolhida foi o filete
 * dourado de 1px no topo deste — o Instagram não foi tocado, porque é a
 * seção que menos pode mudar: ela foi conferida pixel a pixel contra a
 * referência.
 *
 * A faixa de novidades é **casca**: não existe destino para a inscrição
 * (nem campo no CMS, nem rota), então o campo e o botão nascem
 * desabilitados e dizem isso em voz alta. Quando existir um destino, o que
 * muda é o atributo `disabled` e uma ação de envio — nada aqui precisa
 * mudar. A alternativa era um campo que aceita o e-mail e não faz nada com
 * ele, e silêncio depois de um clique é o que faz alguém desconfiar da
 * loja.
 */
export default async function Footer({ content }: { content: FooterSection }) {
  const columns = content.columns ?? []

  const needsCategories = columns.some(
    (column) => column.source === "categories"
  )
  const needsCollections = columns.some(
    (column) => column.source === "collections"
  )
  const needsPages = columns.some((column) => column.source === "pages")

  const productCategories: HttpTypes.StoreProductCategory[] = needsCategories
    ? await listCategories()
    : []

  const collections: HttpTypes.StoreCollection[] = needsCollections
    ? (await listCollections({ fields: "*products" })).collections
    : []

  // A coluna automática (PR7 do doc 14): as páginas que estão **no ar**, lidas de
  // uma vez só (`GET /store/content/pages`, com a mesma tag e a mesma janela do
  // resto do conteúdo). É a resposta ao defeito medido em 14.16 — o link digitado
  // à mão promete a página que a lojista ainda não escreveu, e a URL responde 404:
  // aqui o que está fora do ar não entra na lista, e o que entra responde.
  const pages = needsPages ? await getLivePages() : []

  return (
    <footer
      className="w-full border-t border-rv-dourado bg-rv-preto text-rv-offwhite"
    >
      {/* Faixa de novidades — decorativa por enquanto. Ver a nota no topo
          do arquivo, e `.rv-newsletter` em `brand.css`. */}
      <div className="rv-container rv-newsletter">
        <span className="rv-eyebrow text-rv-dourado">Cartas Real Valor</span>
        <h2>
          Inspiração, novidades e <em>um pouco de nós.</em>
        </h2>
        <p>Receba histórias e lançamentos pensados para você.</p>
        <form className="rv-newsletter-form">
          <input
            className="rv-newsletter-input"
            type="email"
            name="email"
            placeholder="Seu melhor e-mail"
            aria-label="Seu melhor e-mail"
            autoComplete="email"
            disabled
          />
          <button
            className="rv-btn rv-btn-primary disabled:opacity-60"
            type="submit"
            disabled
            data-testid="newsletter-submit"
          >
            Em breve
            <ArrowRightMini aria-hidden="true" focusable="false" />
          </button>
        </form>
        <p className="rv-newsletter-note">As inscrições abrem em breve.</p>
      </div>

      <div className="rv-container rv-footer-main">
        <div className="flex flex-col gap-y-10 small:flex-row items-start justify-between">
          <div className="flex flex-col gap-y-4 max-w-xs">
            <LocalizedClientLink
              href="/"
              className="flex flex-row items-center gap-x-3"
              aria-label="Real Valor — página inicial"
            >
              <img
                src="/favicon.png"
                alt="Real Valor"
                className="h-20 w-20 shrink-0"
              />
              {/* `text-rv-offwhite` divide o elemento com a classe de
                  propósito: sendo utilitário, ele entra **depois** de
                  `brand.css` e assume a cor no lugar do cacao que a
                  assinatura da marca usa no fundo claro. */}
              <div className="rv-brand-lockup text-rv-offwhite">
                <span className="rv-brand-lockup-name">REAL VALOR</span>
                <span className="rv-eyebrow mt-1 text-rv-dourado">
                  Alfaiataria feminina
                </span>
              </div>
            </LocalizedClientLink>
            <SocialLinks items={content.social ?? []} tone="dark" />
          </div>

          <div className="text-small-regular flex flex-wrap gap-x-10 gap-y-8 md:gap-x-16">
            {/* Uma volta por coluna, na ordem da lista. O rodapé não tem
                coluna fixa: cada uma diz de onde vêm os itens (`source`), e
                coluna sem título ou sem itens não aparece — assim o lojista
                publica o rodapé antes de ter tudo. */}
            {columns.map((column, index) => (
              <FooterColumn
                key={`${column.title}-${index}`}
                column={column}
                categories={productCategories}
                collections={collections}
                pages={pages}
                tone="dark"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="rv-container rv-footer-bottom">
        <span>
          © {new Date().getFullYear()} Real Valor. Todos os direitos
          reservados.
        </span>
        <span>
          Desenvolvido por{" "}
          <a
            href="https://ana-karla-dev.vercel.app/"
            className="transition-opacity hover:opacity-70"
          >
            Ana Karla Santana
          </a>
        </span>
      </div>
    </footer>
  )
}
