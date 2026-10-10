"use server"

import { sdk } from "@lib/config"
import {
  DEFAULT_HOME_SECTIONS,
  visibleSections,
  type HomeSection,
} from "@lib/content/home-sections"
import { supportedSections } from "@lib/data/supported-sections"

/**
 * Tag de cache do conteúdo.
 *
 * Passada direto (não via `getCacheOptions`), que prefixa a tag com um
 * id de visitante por cookie. O conteúdo é igual para todo mundo, então
 * uma tag global é mais útil: `revalidateTag("content")` invalida de
 * uma vez, e não só a sessão que editou.
 *
 * Não é exportada: num arquivo `"use server"` o Next só permite
 * exportar funções async, e uma constante quebraria o build.
 */
const CONTENT_CACHE_TAG = "content"

type ContentResponse = {
  sections: HomeSection[]
  /**
   * A versão do schema com que os dados foram gravados (vem do registro no
   * Postgres, via a Store API). A loja não tipa por ela — os tipos são
   * gerados — e sim por ela **descarta** o que não reconhece, o que é o
   * contrato de "campo/tipo desconhecido é ignorado, nunca quebra a página".
   */
  schemaVersion: number
}

/**
 * Lê **uma** superfície de conteúdo (`GET /store/content?surface=`).
 *
 * É a leitura de **blocos** do storefront: a home e cada página declarada saem
 * daqui. O tema tem a dele (`lib/data/theme.ts`), porque precisa das linhas
 * cruas — `themesFromRows` as vira paleta — e não de `HomeSection[]`; o que as
 * duas pontas compartilham é a **tag** e a **janela** (`content`, 60s), e é isso
 * que faz uma gravação no CRM valer para as duas.
 *
 * Até a F1 do doc 14 a função era
 * `getHomeSections`, com `surface: "home"` escrito dentro do corpo, e uma página
 * teria de copiá-la — com a cópia vinha o risco de perder a tag de cache (o
 * defeito 5 do doc 14: a página ficaria fora do `revalidateTag` e a edição do
 * CRM só apareceria em um deploy) ou o `revalidate: 60`, que é a janela
 * prometida ("editar no CRM muda a loja em até 60s").
 *
 * A tolerância (`supportedSections`) e a ordem (`visibleSections`) valem para
 * qualquer superfície: tipo desconhecido é descartado com log, bloco
 * desabilitado não trafega, e a ordem é a coluna `position`.
 *
 * **Sem fallback.** Vazio aqui é vazio: quem decide o que fazer com isso é a
 * ponta — a home cai no padrão, uma página responde 404. É o defeito 4 do doc
 * 14, em que a página vazia herdava o fallback da vitrine e virava a home.
 */
export const getSurfaceSections = async (
  surface: string
): Promise<HomeSection[]> => {
  const { sections, schemaVersion } = await sdk.client.fetch<ContentResponse>(
    "/store/content",
    {
      method: "GET",
      query: { surface },
      // `force-cache` sozinho guarda a resposta para sempre. Isso era
      // aceitável quando só a home lia o conteúdo, mas o cabeçalho
      // (`nav`) agora sai daqui e aparece em *todas* as rotas — nas que
      // renderizam a cada request (`/cart`, `/account`, `/search`) o
      // menu ficaria congelado até alguém chamar
      // `revalidateTag("content")` na mão, e nada no código faz isso.
      // Uma janela curta e explícita limita a defasagem ao mesmo
      // "dentro de um minuto" já documentado em `(main)/page.tsx`.
      next: { tags: [CONTENT_CACHE_TAG], revalidate: 60 },
      cache: "force-cache",
    }
  )

  return visibleSections(supportedSections(sections, schemaVersion))
}

/**
 * Reads the home content from the backend Content module
 * (`GET /store/content?surface=home`).
 *
 * The contract and the defaults live in the `@rv/contrato` workspace package
 * (`packages/contrato/src/`), which this app imports directly — there is no
 * generated copy and no second hand-typed source to drift. `make check` still
 * guards what the compiler cannot see (the panel's field shapes, the appearance
 * values and the theme seed).
 *
 * A content failure must never take the storefront down, so every
 * error path falls back to `DEFAULT_HOME_SECTIONS` — **e só aqui**: o fallback
 * é o que a vitrine sempre teve (empty is far more often a sign the seed never
 * ran), e uma página não o herda de propósito.
 */
export const getHomeSections = async (): Promise<HomeSection[]> => {
  try {
    const sections = await getSurfaceSections("home")

    // Empty is valid configuration (the admin hid everything), but it is
    // far more often a sign the seed never ran — use the defaults then.
    if (!sections.length) {
      return visibleSections(DEFAULT_HOME_SECTIONS)
    }

    return sections
  } catch (error) {
    // A content failure must never take the storefront down: the home
    // still renders with the baked-in defaults.
    console.error("Falha ao carregar o conteúdo da home:", error)

    return visibleSections(DEFAULT_HOME_SECTIONS)
  }
}

/**
 * Os blocos de uma página declarada (`PAGE_SURFACES`), por slug.
 *
 * Vazio é resposta legítima e **não** vira o padrão da vitrine: quem responde
 * por isso é a rota, com `notFound()` (critério 3 do doc 14). A falha de rede
 * também devolve vazio, pelo mesmo motivo — uma página institucional que
 * aparecesse com a vitrine dentro seria pior do que um 404, porque o 404 não
 * mente.
 */
export const getPageSections = async (
  slug: string
): Promise<HomeSection[]> => {
  try {
    return await getSurfaceSections(slug)
  } catch (error) {
    console.error(`Falha ao carregar a página "${slug}":`, error)

    return []
  }
}

