/**
 * A tolerância da loja: o que ela **não** conhece é descartado.
 *
 * Fica num arquivo próprio (e não dentro de `content.ts`) por dois motivos:
 * `content.ts` é `"use server"` e puxa o SDK da Medusa, o que é peso demais
 * para um teste de função pura; e a decisão é a parte que precisa estar
 * coberta — é ela que impede que um tipo novo gravado no schema derrube a home.
 *
 * Ver `content.ts`, que é quem chama.
 */
import { isSectionType, type HomeSection } from "@lib/content/home-sections"

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
export function supportedSections(
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


