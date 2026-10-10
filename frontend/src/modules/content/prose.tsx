import { renderInline } from "@lib/content/markdown"
import { type ProseBlock, type ProseSection } from "@lib/content/home-sections"
import { type ReactNode } from "react"

/**
 * O texto longo (`prose`) — a página institucional escrita no CRM.
 * -------------------------------------------------------------------------
 * É o bloco que destrava Privacidade, Termos, Trocas e Cuidados (14.6.2 do doc
 * 14): o lojista escreve no CRM em blocos — subtítulo, parágrafo, lista — e o
 * texto de cada um aceita um subconjunto fechado de marcas inline (negrito,
 * itálico, riscado e link). Quem as interpreta é `renderInline`, o mesmo parser
 * da vitrine: **o texto chega como texto**, não como HTML, e não existe
 * `dangerouslySetInnerHTML` em lugar nenhum aqui — o que o lojista digita é o
 * que a página mostra.
 *
 * **Estrutura é dado, marca é marca.** O `kind` do bloco decide o elemento
 * (`<h3>`, `<p>`, `<ul>`), e é por isso que o campo de texto não precisa de
 * `##` nem de `- item`: duas formas de escrever a mesma coisa é como nasce a
 * divergência entre o painel e a página (14.6.2).
 *
 * O desenho mora no `brand.css` (a família `.rv-prose-*`): a medida da coluna,
 * o ritmo entre os blocos e a lista. Aqui ficam só a estrutura e as classes.
 * Nada disto é classe de cor ou de fonte — quem dá as duas ao título e ao texto
 * é `.rv-section-heading` / `.rv-section-text`, com o que o lojista escolheu no
 * tema da loja.
 */
export default function Prose({
  section,
}: {
  section: ProseSection
}): ReactNode {
  // O banco é texto livre: o que chega pode ser de uma versão anterior do
  // formulário. A leitura defensiva é a mesma dos outros blocos do storefront —
  // a página fica de pé, e o campo que não dá para ler não derruba o resto.
  const title = textOf(section.title).trim()
  const blocks = (Array.isArray(section.blocks) ? section.blocks : []).filter(
    drawn
  )

  // Nem título, nem bloco com texto: a seção **sai da página** — e o
  // `ContentSectionList` não desenha a âncora vazia. É o estado de uma seção
  // recém-criada no CRM (ela nasce com um parágrafo em branco) e o mesmo vazio
  // honesto da página sem bloco publicado, que responde 404 (critério 3 de
  // 14.11): melhor não ter página do que ter uma página em branco.
  if (!title && blocks.length === 0) {
    return null
  }

  return (
    <section className="rv-prose">
      <div className="rv-container">
        <div className="rv-section-pad rv-prose-body">
          {title !== "" && (
            <h2 className="rv-display rv-section-heading rv-prose-title">
              {title}
            </h2>
          )}

          {blocks.map((block, index) => (
            <ProseBlockBody key={`${index}-${block.kind}`} block={block} />
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * Um bloco na página: o `kind` decide o elemento e o texto passa por
 * `renderInline` nos três — negrito, itálico, riscado e link valem no
 * subtítulo, no parágrafo e em cada item da lista.
 *
 * O `<h3>` do subtítulo (e não o `<h2>` do exemplo de 14.6.3) é a única
 * correção ao desenho: o título da seção já é um `<h2>`, e um `<h2>` dentro dele
 * ficaria no mesmo nível do nome da seção — dois títulos irmãos onde um é
 * subordinado ao outro. Quem lê a página por cabeçalhos (leitor de tela, índice
 * da busca) perde a hierarquia.
 */
function ProseBlockBody({ block }: { block: ProseBlock }): ReactNode {
  if (block.kind === "subtitle") {
    return (
      <h3 className="rv-display rv-section-heading rv-prose-subtitle">
        {renderInline(textOf(block.text))}
      </h3>
    )
  }

  if (block.kind === "bullets") {
    return (
      <ul className="rv-section-text rv-prose-list">
        {listItems(block).map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>
    )
  }

  // `paragraph` — e o `kind` que o contrato não conhece: uma versão futura do
  // CRM pode gravar um tipo novo, e o texto dele continua legível como
  // parágrafo em vez de sumir da página (a mesma escolha do `supportedSections`
  // no nível de cima: degradar é melhor do que apagar).
  return (
    <p className="rv-section-text rv-prose-paragraph">
      {renderInline(textOf(block.text))}
    </p>
  )
}

/** As linhas de uma lista, sem as caixas vazias — `bullets` vale por elas. */
function listItems(block: ProseBlock): string[] {
  const items = Array.isArray(block.items) ? block.items : []

  return items.map(textOf).filter((item) => item.trim() !== "")
}

/**
 * O bloco tem o que desenhar?
 *
 * Um bloco nasce vazio no CRM (a seção nova nasce com um parágrafo em branco),
 * e um parágrafo vazio na página é uma linha em branco que ninguém escreveu —
 * o mesmo defeito, em ponto pequeno, da página vazia que responderia 200. O
 * corte é por `kind`: `bullets` vale pelas linhas, os outros pelo texto.
 */
function drawn(block: ProseBlock): boolean {
  if (block.kind === "bullets") {
    return listItems(block).length > 0
  }

  return textOf(block.text).trim() !== ""
}

/** O texto de um campo que o banco guarda livre, como string em que se confia. */
function textOf(value: unknown): string {
  return typeof value === "string" ? value : ""
}
