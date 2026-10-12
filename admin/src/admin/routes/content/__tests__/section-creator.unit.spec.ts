/**
 * O diálogo "Nova seção": a lista de tipos tem de ficar POR CIMA do cartão.
 * -------------------------------------------------------------------------
 * O diálogo é um cartão `fixed inset-0 z-50` montado **dentro** do painel, e as
 * opções do `Select` do Medusa nascem num **portal** (`document.body`) com
 * `z-index: auto`: o wrapper `[data-radix-popper-content-wrapper` (react-popper)
 * copia para si o `z-index` **computado** do `Select.Content`. Sem um z-index
 * próprio, o portal pinta **abaixo** do cartão — as opções existem no DOM e o
 * clique em "Tipo" parece não fazer nada, porque a tela não muda. É o defeito
 * que este arquivo prende: o `<select>` nativo do diálogo antigo não o tinha
 * porque não passava por camada nenhuma.
 *
 * A conferência é de **texto** pelo mesmo motivo declarado em
 * `panel-wiring.unit.spec.ts`: o pacote não tem jsdom + testing-library, e o
 * jsdom não pinta camadas — um teste de render passaria verde com a lista
 * escondida atrás do modal. O que se prende aqui é a **relação** entre os dois
 * z-index, não o desenho: o do popup, maior que o do cartão.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

/** `admin/src` — o código do painel (mesma raiz de `panel-wiring`). */
const PANEL_SRC = join(__dirname, "..", "..", "..", "..")
const CREATOR = readFileSync(
  join(PANEL_SRC, "admin", "routes", "content", "SectionCreator.tsx"),
  "utf8"
)

/** O primeiro `z-index` que o padrão captura, ou um erro que diz qual faltou. */
function zIndexOf(pattern: RegExp): number {
  const match = pattern.exec(CREATOR)

  if (!match) {
    throw new Error(`z-index não encontrado no diálogo: ${pattern}`)
  }

  return Number(match[1])
}

describe("a lista de tipos do diálogo fica acima do modal", () => {
  it("o popup do `Select` tem z-index maior que o do cartão", () => {
    // O cartão (`fixed inset-0 z-50`) é o que cobre a tela; o popup
    // (`<Select.Content className="z-[…]">`) é o que tem de vencer essa camada.
    const cartao = zIndexOf(/fixed inset-0 z-(\d+)/)
    const popup = zIndexOf(/<Select\.Content className="z-\[(\d+)\]"/)

    expect(popup).toBeGreaterThan(cartao)
  })
})
