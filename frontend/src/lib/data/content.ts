"use server"

import { sdk } from "@lib/config"
import {
  DEFAULT_HOME_SECTIONS,
  isSectionType,
  visibleSections,
  type HomeSection,
} from "@lib/content/home-sections"

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
 * Reads the home content from the backend Content module
 * (`GET /store/content`).
 *
 * The contract and the defaults live in the backend Content module
 * (`backend/src/modules/content/`). The storefront receives a generated copy
 * at `lib/content/contract.generated.ts` — `node scripts/gen-content.mjs`
 * writes it and `make check` fails when it is stale, so there is no second
 * hand-typed source to drift.
 *
 * A content failure must never take the storefront down, so every
 * error path falls back to `DEFAULT_HOME_SECTIONS`.
 */
/**
 * Descarta as seções cujo tipo a loja não conhece.
 *
 * Isto não é_metrica de estilo: é o que impede que um **tipo novo gravado no
 * schema sem deploy** derrube a home. O render da home é exaustivo por
 * `switch` e o `default` chama `assertNever`, que lança — então uma seção
 * desconhecida que chegasse ao render viraria HTTP 500 na página inteira.
 *
 * Descartar (com log no servidor) é o comportamento pedido pelo plano: a loja
 * valida o que recebe e ignora o que não conhece. O erro de digitação no
 * contrato continua visível, porque o log sai no servidor — e o `--check` do
 * `seed-schema` é quem acusa schema gravado sem o storefront saber.
 */
function supportedSections(
  sections: unknown,
  schemaVersion: number
): HomeSection[] {
  if (!Array.isArray(sections)) {
    return []
  }

  return sections.filter((section): section is HomeSection => {
    const type = (section as { type?: unknown } | null)?.type

    if (typeof type === "string" && isSectionType(type)) {
      return true
    }

    console.error(
      `Seção com tipo "${String(type)}" não é suportada pela loja ` +
        `(schema v${schemaVersion}); descartada.`
    )

    return false
  })
}

export const getHomeSections = async (): Promise<HomeSection[]> => {
  try {
    const { sections, schemaVersion } = await sdk.client.fetch<ContentResponse>(
      "/store/content",
      {
        method: "GET",
        query: { surface: "home" },
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

    const supported = supportedSections(sections, schemaVersion)

    // Empty is valid configuration (the admin hid everything), but it is
    // far more often a sign the seed never ran — use the defaults then.
    if (!supported.length) {
      return visibleSections(DEFAULT_HOME_SECTIONS)
    }

    return visibleSections(supported)
  } catch (error) {
    // A content failure must never take the storefront down: the home
    // still renders with the baked-in defaults.
    console.error("Falha ao carregar o conteúdo da home:", error)

    return visibleSections(DEFAULT_HOME_SECTIONS)
  }
}

