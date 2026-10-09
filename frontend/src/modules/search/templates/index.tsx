import { Fragment, Suspense } from "react"

import EmptyState from "@modules/common/components/empty-state"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"

import SearchField from "../components/search-field"
import SearchEmpty from "../components/search-empty"
import SearchResults from "./results"

/**
 * A busca — a página inteira, montada como as demais páginas internas da
 * loja: uma faixa de abertura (título + campo) e o resultado embaixo.
 *
 * A referência desenha a busca como uma **sobreposição** que cobre a tela.
 * Não foi portada como sobreposição, e a razão é o endereço: o cabeçalho
 * aponta para `/search` (é o que o CMS guarda, e é o que o ícone de lupa
 * faz), e uma sobreposição não tem URL — não se compartilha, não se
 * favorita, não volta pelo "voltar" do navegador, e o resultado da busca
 * não existe para quem chega de fora. O que a sobreposição tem de bom — a
 * faixa de abertura com o campo grande e as sugestões — está aqui inteiro.
 *
 * O campo é uma ilha de cliente (`../components/search-field`), porque
 * digitar escreve na URL; o resto é servidor, inclusive a lista de peças.
 * A `<Suspense>` existe pelo mesmo motivo que no catálogo: buscar é I/O, e
 * a faixa de abertura (que já está pintada) não pode ficar presa atrás
 * dele. A `key` é o que faz o limite valer **por busca**: sem ela, o React
 * reaproveitaria a lista anterior e a cliente veria os resultados do termo
 * antigo enquanto o novo carrega.
 */
export default function SearchTemplate({
  query,
  page,
  countryCode,
}: {
  query: string
  page: number
  countryCode: string
}) {
  return (
    <main data-testid="search-page">
      <section className="rv-page-intro">
        <p className="rv-eyebrow text-rv-rose-strong">Encontre a sua peça</p>

        {/*
          O título diz em que ponto da busca a cliente está: antes de
          escrever, ele convida; depois, ele conta o que foi procurado — e
          o termo aparece com destaque, que é a leitura de "foi isto que
          você pediu". O `em` é colorido pelo `brand.css`
          (`.rv-page-intro h1 em`), no rosa que o tamanho deste título
          permite.
        */}
        <h1>
          {query ? (
            <>
              Resultados para <em>“{query}”</em>
            </>
          ) : (
            <>
              O que você <em>procura?</em>
            </>
          )}
        </h1>

        <SearchField query={query} />

        {/*
          As sugestões são as da referência — os três termos que ela
          escreve embaixo do campo. Lá são texto morto; aqui cada um leva à
          busca já feita, porque sugerir sem deixar clicar é apontar uma
          porta sem maçaneta.
        */}
        <p className="rv-search-suggestions">
          Sugestões:{" "}
          {SUGGESTIONS.map((term, index) => (
            <Fragment key={term}>
              {/* O separador é do desenho, e o leitor de tela já ouve a
                  vírgula natural da lista de links: por isso ele não é
                  anunciado. */}
              {index > 0 && <span aria-hidden="true"> · </span>}
              <LocalizedClientLink
                className="rv-search-suggestion"
                href={`/search?q=${encodeURIComponent(term)}`}
              >
                {term}
              </LocalizedClientLink>
            </Fragment>
          ))}
        </p>
      </section>

      {query ? (
        <Suspense key={`${query}:${page}`} fallback={<SearchSkeleton />}>
          <SearchResults query={query} page={page} countryCode={countryCode} />
        </Suspense>
      ) : (
        <SearchEmpty />
      )}
    </main>
  )
}

/**
 * Os termos oferecidos antes de a cliente escrever. São os do redesenho.
 * Eles moram aqui, e não no CMS, porque sugestão de busca é atalho de
 * interface — e porque um termo que não existe no catálogo não quebra
 * nada: a busca simplesmente devolve o vazio, que é onde a página explica
 * o que fazer.
 */
const SUGGESTIONS = ["blazer", "vestido", "alfaiataria"]

/** O lugar da lista enquanto o servidor busca — a mesma grade de sempre. */
function SearchSkeleton() {
  return (
    <div className="rv-page-pad">
      <div className="rv-container">
        <SkeletonProductGrid numberOfProducts={8} />
      </div>
    </div>
  )
}
