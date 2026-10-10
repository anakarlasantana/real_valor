/**
 * O painel não é uma segunda fonte de dado nem de tipo.
 * -------------------------------------------------------------------------
 * O CRM recebe o formulário pelo `schema` de `GET /admin/content` e desenha o
 * que chega. O que esta suíte prende são as ligações que a guarda de paridade
 * conferia por texto — e que **nenhum tipo alcança**:
 *
 *   - espelho de dado (`const ITEM_FIELDS = …`) ou de **forma** (`type FieldKind
 *     = { … }`) dentro do painel: medido na R2, um tipo estrutural copiado num
 *     arquivo que **não importa o nome** compila verde — tipo estrutural não
 *     enxerga cópia, e é a cópia que se proíbe;
 *   - a página e o editor de item **lendo** o schema (`itemFields`,
 *     `typeLabels`): um `schema` que ninguém lê é campo que some da tela;
 *   - a declaração de exaustividade por `kind`, que é o que faz o `tsc` reprovar
 *     um `kind` sem ramo — apagá-la numa refatoração devolveria a cobertura ao
 *     silêncio, sem erro em lugar nenhum;
 *   - o seletor de superfície e o numeral da ordem pendente, que vêm do payload.
 *
 * A varredura é o pacote inteiro (menos `__tests__`): até a R2 ela lia dois
 * arquivos, e uma cópia da forma num terceiro passava pelas duas — a asserção
 * era mais estreita que a frase que ela imprime.
 *
 * `node:fs` e não o renderizador: o que se confere aqui é o texto do painel, e um
 * teste de render precisaria de jsdom + testing-library, que este pacote não tem
 * (a lacuna está declarada no plano: é melhor uma verificação fraca e viva do que
 * nenhuma, e o dia de um teste de componente é um arquivo a mais no `testMatch`
 * do `admin/jest.config.js`).
 */
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

/** `admin/src` — o código do painel, sem `__tests__`. */
const PANEL_SRC = join(__dirname, "..", "..", "..", "..")
const CONTENT_DIR = join(PANEL_SRC, "admin", "routes", "content")

const fieldInput = readFileSync(join(CONTENT_DIR, "field-input.tsx"), "utf8")
const hrefInput = readFileSync(join(CONTENT_DIR, "href-input.tsx"), "utf8")
const page = readFileSync(join(CONTENT_DIR, "page.tsx"), "utf8")
const pagesView = readFileSync(join(CONTENT_DIR, "pages-view.tsx"), "utf8")

function panelSources(): string[] {
  const found: string[] = []

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)

      if (entry.isDirectory()) {
        // `__tests__` fica de fora: um teste monta fixture com a forma de um
        // payload, e um fixture chamado como uma tabela do contrato seria falso
        // positivo. O que se proíbe é o painel **em execução** ter uma segunda
        // fonte de dado ou de tipo.
        if (entry.name !== "__tests__") {
          walk(path)
        }
      } else if (/\.tsx?$/.test(entry.name)) {
        found.push(readFileSync(path, "utf8"))
      }
    }
  }

  walk(PANEL_SRC)

  return found
}

describe("o painel não declara o contrato", () => {
  it("nenhum espelho das tabelas do contrato", () => {
    // Os cinco nomes, um por espelho que já existiu: o sub-formulário do item,
    // as chaves de ícone, os rótulos delas, as origens de coluna do rodapé e os
    // rótulos de tipo. Todos chegam pelo `schema` da API.
    const MIRRORS = [
      "ITEM_FIELDS",
      "ICON_KEYS_BY_KIND",
      "ICON_LABELS",
      "FOOTER_COLUMN_SOURCES",
      "TYPE_LABELS",
      "MARKDOWN_MARKS",
      "CONTENT_DESTINATIONS",
      // O vocabulário dos estados da tela "Páginas": ele chega no payload
      // (`pageStates`), com rótulo, tom e frase. Uma tabela aqui seria o
      // painel inventando a palavra — e a palavra tem de ser a do servidor,
      // que é quem de fato sabe se a página está no ar (ver `pages-view.tsx`).
      "PAGE_STATES",
    ]
    const sources = panelSources()
    const declarados = MIRRORS.filter((name) =>
      sources.some((source) => new RegExp(`const ${name}\\b`).test(source))
    )

    expect(declarados).toEqual([])
  })

  it("nenhuma declaração de forma dos tipos do contrato", () => {
    // O proibido é a **declaração de forma** (`type X = {` ou `type X = | "a"`),
    // não o *alias* (`type Schema = ContentSchemaPayload`) — esse é o desejado: o
    // nome local aponta para o contrato em vez de copiar o corpo. O `=` depois do
    // nome é obrigatório, senão a checagem casaria com o `import type { … }`.
    const SHAPES = [
      "FieldKind",
      "FieldSpec",
      "ItemFieldSpec",
      "ItemFields",
      "Schema",
    ]
    const sources = panelSources()
    const copiados = SHAPES.filter((name) =>
      sources.some((source) =>
        new RegExp(`^\\s*(export )?type ${name} = (\\{|\\n\\s*\\||\\|)`, "m").test(
          source
        )
      )
    )

    expect(copiados).toEqual([])
  })
})

describe("o painel lê o schema", () => {
  it("a página e o editor leem os campos de item (`itemFields`)", () => {
    // O outro lado do mesmo defeito: um `schema` que ninguém lê é campo que some
    // da tela — o sub-formulário da lista deixa de ser desenhado.
    expect(page).toContain("itemFields")
    expect(fieldInput).toContain("itemFields")
  })

  it("a listagem lê os rótulos de tipo (`typeLabels`)", () => {
    // Sem eles a listagem mostra o `type` cru (`launches`, `editorial`) no lugar
    // do nome que o lojista lê.
    expect(page).toContain("typeLabels")
  })

  it("a barra do texto formatado desenha as marcas do payload (`markdownMarks`)", () => {
    // A lista **não** pode morar no painel — é o espelho que a suíte proíbe
    // (`MIRRORS`): elas chegam pelo `schema`, e a barra as percorre. Quem decide
    // o que o clique faz é o `toggleMark` (`markdown-bar.ts`), que tem teste
    // próprio; aqui se confere a ligação: sem a leitura, a barra do `prose`
    // nasceria vazia.
    expect(page).toContain("markdownMarks")
    expect(fieldInput).toContain("marks.map")
    expect(fieldInput).toContain("toggleMark(")
  })

  it("os `list:*` de caixa de texto têm ramo próprio, antes do ramo genérico", () => {
    // `list:text` e `list:markdown` são uma caixa por item e **não** têm
    // entrada em `ITEM_FIELDS` (contrato: `LIST_KINDS_WITHOUT_ITEM_FORM`). Sem
    // ramo próprio elas caem no ramo genérico dos `list:*`, que desenha um
    // cartão de item com o sub-formulário — vazio, porque não há campo dentro.
    // O `tsc` não distingue um `list:*` do outro, então a conferência é de
    // texto, como as outras deste arquivo.
    for (const kind of ["list:text", "list:markdown"]) {
      expect(fieldInput).toContain(`spec.kind === "${kind}"`)
    }
  })

  it("o campo de destino desenha a lista do payload (`destinations`)", () => {
    // A lista **não** pode morar no painel — é o espelho que a suíte proíbe
    // (`MIRRORS`): ela chega pelo `schema`, e o `HrefInput` a percorre. Sem a
    // leitura, o campo `href` volta a ser caixa de texto livre, que é
    // exatamente a causa-raiz do doc 13 (nove botões em `/store` porque não
    // havia alternativa no painel).
    expect(page).toContain("destinations")
    expect(fieldInput).toContain("destinations")
    expect(hrefInput).toContain("destinations")
    expect(hrefInput).toContain("<datalist")
  })

  it("o campo de destino tem ramo próprio — na seção e dentro do item", () => {
    // O `tsc` não distingue um `kind` do outro: `text` e `href` compilam os
    // dois. Sem o ramo da seção, o `ctaHref` continua caixa de texto; sem o do
    // item, o link do rodapé também — e é lá que estão os seis links do padrão.
    expect(fieldInput).toContain('spec.kind === "href"')
    expect(fieldInput).toContain('nested === "href"')
  })

  it("o seletor de superfície e o diálogo saem do schema", () => {
    // Uma superfície nova no contrato aparece na tela sem edição no painel: é a
    // mesma promessa da bolinha de cor e do sub-formulário dos itens.
    expect(page).toContain("schema?.surfaces")
    expect(page).toContain("currentSurface")
    expect(page).toContain("?surface=")
  })

  it("a ordem pendente usa a faixa do payload, e publica pela porta única", () => {
    // O numeral da ordem pendente é previsão do que a gravação vai usar: sai do
    // `order` que a API manda (com as casas ancoradas em `order.reserved`), e não
    // de uma segunda regra dentro do navegador. Publicar é o POST da porta única
    // — não N `PATCH`es, um por seção.
    expect(page).toContain("numeralFor(place, order)")
    expect(page).toContain("order.reserved")
    expect(page).toContain('"/admin/content/order"')
  })

  it('a tela "Páginas" lê o índice da API — e não conta nada no navegador', () => {
    // O estado de cada página ("Publicada", "Despublicada", "Sem blocos") é a
    // régua do contrato, aplicada no **servidor** (`GET /admin/content/pages`,
    // ver `modules/content/pages.ts`): habilitada e de um tipo que a loja
    // desenha — a mesma régua que a rota `[slug]` do storefront usa para decidir
    // o 404. A tela desenha o que chega. Se ela contasse seção, haveria uma
    // segunda resposta para "esta página está no ar" — e a resposta que a
    // cliente vê é a da loja.
    expect(pagesView).toContain('"/admin/content/pages"')
    expect(pagesView).toContain("json.pageStates")
    expect(pagesView).toContain("state?.label")
    // A prova de que ela não conta: não há o que contar. A tela não recebe seção
    // nenhuma — nem `enabled`, nem `type` para comparar.
    expect(pagesView).not.toContain("enabled")
  })

  it("o índice é um modo da tela de conteúdo, e o atalho troca de aba", () => {
    // A F3a pede "um atalho para a aba de blocos dela", e o atalho é a troca de
    // aba que já existe (`openSurface`): o índice não inventa navegação — uma
    // rota nova teria de carregar a URL do painel junto, que o CRM não conhece
    // (`MEDUSA_ADMIN_PATH` é configuração). Sem `setShowPages(false)` antes da
    // troca, o atalho mudaria a superfície e continuaria mostrando o índice.
    expect(page).toContain("PagesView")
    expect(page).toContain("showPages")
    expect(page).toContain("setShowPages(false)")
    expect(page).toContain("openSurface")
  })
})

describe("a exaustividade por `kind`", () => {
  it("a declaração que faz o `tsc` reprovar `kind` sem ramo continua lá", () => {
    // Não é sobre `kind`: é sobre a **declaração** que transforma um `kind` novo
    // no contrato, sem ramo no editor, em erro de compilação (`TS2322`, medido
    // no G2, quando o `Record<FieldKind, …>` + `satisfies` substituiu cinco
    // asserções de texto). Apagá-la numa limpeza "que não muda nada" devolveria
    // a cobertura ao silêncio.
    expect(fieldInput).toMatch(
      /type UnhandledKind = Exclude<FieldKind, HandledKind>/
    )
    expect(fieldInput).toContain("UNHANDLED_KINDS")
  })
})
