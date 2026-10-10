import { renderInline } from "@lib/content/markdown"
import { type FaqItem, type FaqSection } from "@lib/content/home-sections"
import { type ReactNode } from "react"

/**
 * As perguntas frequentes (`faq`) — a página da dúvida escrita no CRM.
 * -------------------------------------------------------------------------
 * É o par do `prose` (14.6.2 do doc 14): o mesmo lojista, o mesmo CRM, e a
 * resposta de cada pergunta passa pelo **mesmo** parser (`renderInline`) com as
 * mesmas marcas — negrito, itálico, riscado e link. O que muda é a forma da
 * leitura: aqui o texto está **fechado** até alguém clicar.
 *
 * **Por que `<details>` e `<summary>`, e não um acordeão.** É a decisão que o
 * tipo existe para tomar. O elemento nativo:
 *
 *   - é acessível por teclado **de graça** (o `<summary>` já é focável e o
 *     Enter/Espaço abrem): um acordeão de `div` + `onClick` precisa devolver
 *     isso a mão, e é onde se esquece o `aria-expanded`;
 *   - funciona **sem JavaScript** — não há estado, não há efeito, não há
 *     listener, e a página abre igual com o script bloqueado;
 *   - e o conteúdo fechado **é indexado**: para o buscador, para o leitor de
 *     tela e para o `Ctrl+F` a resposta está no HTML. Abas e acordeões feitos à
 *     mão escondem a resposta — e é justamente a resposta longa o que a cliente
 *     e o buscador procuram.
 *
 * Não há `dangerouslySetInnerHTML` em lugar nenhum aqui, como no `prose`: o
 * texto chega como **texto**, o React o escapa, e o que o lojista digita é o que
 * a página mostra.
 *
 * O desenho mora no `brand.css` (a família `.rv-faq-*`): a medida da coluna, o
 * fio entre as perguntas e o recuo da resposta. Aqui ficam só a estrutura e as
 * classes — nada de cor nem de fonte, que vêm do tema da loja pelas classes
 * `.rv-section-heading` / `.rv-section-text`.
 */
export default function Faq({ section }: { section: FaqSection }): ReactNode {
  // O banco é texto livre: a leitura defensiva é a mesma dos outros blocos. O
  // que chega pode ser de uma versão anterior do formulário, e o campo que não
  // dá para ler não derruba o resto da página.
  const title = textOf(section.title).trim()
  const items = (Array.isArray(section.items) ? section.items : []).filter(completo)

  // Nem título, nem pergunta completa: a seção **sai da página** — e o
  // `ContentSectionList` não desenha a âncora vazia. É o estado de uma seção
  // recém-criada no CRM (ela nasce com um item em branco), e o mesmo vazio
  // honesto da página sem bloco publicado, que responde 404 (critério 3 de
  // 14.11): melhor não ter página do que ter uma página em branco.
  if (!title && items.length === 0) {
    return null
  }

  return (
    <section className="rv-faq">
      <div className="rv-container">
        <div className="rv-section-pad rv-faq-body">
          {title !== "" && (
            <h2 className="rv-display rv-section-heading rv-faq-title">{title}</h2>
          )}

          {/* A ordem é a da lista do CRM, e cada item é um par fechado. */}
          {items.map((item, index) => (
            <details key={index} className="rv-faq-item">
              {/*
                A pergunta é `text` — texto simples, sem barra de marcas no CRM
                —, então ela entra como string: o que a loja não desenha, ela
                também não esconde. Quem interpreta marcas é a resposta, que é o
                campo `markdown` (a mesma assimetria declarada no contrato).
              */}
              <summary className="rv-section-heading rv-faq-question">
                {textOf(item.question)}
              </summary>
              <p className="rv-section-text rv-faq-answer">
                {renderInline(textOf(item.answer))}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * O item está completo?
 *
 * A pergunta frequente **é** o par: a linha que se clica e a resposta que abre.
 * Meio par não é item — e as duas metades falham de formas diferentes:
 *
 *   - pergunta em branco é um `<summary>` vazio, que não diz o que a cliente vai
 *     abrir;
 *   - resposta em branco é pior: o botão abre e não mostra nada, e quem
 *     clicasse concluiria que a página está quebrada.
 *
 * O item recém-criado no CRM nasce assim (os dois campos em branco), e a seção
 * que só tem ele não desenha nada — como o parágrafo em branco do `prose`. A
 * resposta em branco **não** vira um `<p></p>`: é o mesmo defeito, em ponto
 * pequeno, da página que responderia 200 sem ter o que mostrar.
 *
 * O parâmetro é `unknown` porque o `data` do banco é texto livre: um item que
 * chegou de uma versão anterior do formulário (ou de um `PATCH` torto) não pode
 * derrubar a página inteira por causa de um `null` no meio da lista.
 */
function completo(item: unknown): boolean {
  const par = (item ?? {}) as Partial<FaqItem>

  return (
    textOf(par.question).trim() !== "" && textOf(par.answer).trim() !== ""
  )
}

/** O texto de um campo que o banco guarda livre, como string em que se confia. */
function textOf(value: unknown): string {
  return typeof value === "string" ? value : ""
}
