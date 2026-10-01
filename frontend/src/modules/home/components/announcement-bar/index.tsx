import { type CSSProperties } from "react"

import { appearanceVars } from "@lib/content/appearance"
import {
  announceSections,
  DEFAULT_HOME_SECTIONS,
  type AnnouncementSection,
} from "@lib/content/home-sections"
import { tickerMessages, tickerSeconds } from "@lib/util/ticker"

/**
 * Announcement bar — the thin strip above the header.
 *
 * It lives in the (main) layout rather than in the page, because it is
 * site chrome (present on every route) instead of home content.
 * `section` comes from the announcement block so the copy stays
 * admin-editable, and it carries the block's appearance with it: the bar
 * paints its own fill (it is not wrapped by the home renderer), so it is
 * the component that turns `appearanceVars` into the `--rv-section-*`
 * variables.
 *
 * **A barra rola sozinha quando há mais de uma mensagem.** O mecanismo são
 * as três peças de `styles/brand.css` (`.rv-marquee`, `.rv-marquee-track`,
 * `@keyframes rv-marquee`) e nenhuma linha de JavaScript no cliente: o
 * trilho recebe a lista duas vezes e anda metade da própria largura, o que
 * fecha o laço sem costura. Com uma mensagem só, a barra é a de sempre —
 * uma linha centrada e parada —, e com nenhuma ela não é desenhada.
 *
 * **A faixa é de borda a borda, e o ticker rola na largura da tela.** O que
 * rola não fica dentro do `rv-container` (1440px, centrado): com ele, a faixa
 * preta ia até a borda enquanto a linha sumia e reaparecia só no meio dela —
 * o trilho nasce e morre no meio da tela, que é o defeito que se vê. Quem
 * centraliza a mensagem única é o próprio `<p>` (`w-full px-6`), que é o
 * respiro que o container dava.
 *
 * Os dois campos de conteúdo (`text` e `messages`) são lidos por
 * `tickerMessages` (`lib/util/ticker.ts`), que **não** mora aqui de
 * propósito: é a decisão "qual mensagem vale", ela tem caso de borda
 * (lista vazia, item em branco, base antiga só com `text`) e é testável sem
 * renderizar nada. Esta barra aparece em toda rota da loja, então uma
 * faixa preta vazia no topo do site é o defeito que o teste evita.
 *
 * Bloco ausente (o lojista escondeu a seção no CRM) cai no **conteúdo
 * padrão** — não numa string escrita aqui. É o mesmo bloco que a loja usa
 * quando o `/store/content` falha (`lib/data/content.ts`): a loja nunca
 * fica sem barra por causa de uma requisição, e a copy continua sendo dado.
 */
const FALLBACK_ANNOUNCEMENT = announceSections(DEFAULT_HOME_SECTIONS)

export default function AnnouncementBar({
  section,
}: {
  section?: AnnouncementSection
}) {
  const content = section ?? FALLBACK_ANNOUNCEMENT

  if (!content) {
    return null
  }

  const messages = tickerMessages(content)

  if (messages.length === 0) {
    return null
  }

  const rolling = messages.length > 1

  return (
    <div
      className="rv-section rv-section-bg-preto w-full"
      style={
        {
          ...appearanceVars(content),
          // A velocidade só entra no estilo quando há o que rolar: sem
          // animação a variável não teria quem a lesse.
          ...(rolling
            ? {
                "--rv-marquee-duration": `${tickerSeconds(
                  content.speedSeconds
                )}s`,
              }
            : {}),
        } as CSSProperties
      }
    >
      {rolling ? (
        <Marquee messages={messages} />
      ) : (
        <p className="rv-eyebrow rv-section-text-onmedia flex min-h-[38px] w-full items-center justify-center px-6 text-center leading-none">
          {messages[0]}
        </p>
      )}
    </div>
  )
}

/**
 * A faixa que rola: a viewport (`overflow: hidden`) e o trilho que anda.
 *
 * A lista entra duas vezes de propósito. O laço de uma faixa contínua é
 * isso — a segunda cópia é o que aparece pela direita enquanto a primeira
 * sai pela esquerda —, e como as duas são idênticas o salto de volta ao
 * começo (`translateX(0)`) cai num ponto em que nada muda de lugar.
 */
function Marquee({ messages }: { messages: string[] }) {
  return (
    <div className="rv-marquee flex min-h-[38px] items-center">
      <div className="rv-marquee-track">
        <MarqueeGroup messages={messages} />
        {/* A cópia do laço: existe para o olho, não para o leitor de tela. */}
        <MarqueeGroup messages={messages} clone />
      </div>
    </div>
  )
}

/**
 * Uma volta do trilho — a lista de mensagens, com o mesmo respiro em todas
 * as junções (1.5rem de cada lado), e é essa uniformidade que faz a costura
 * entre uma volta e a seguinte ter exatamente o mesmo espaço que as
 * mensagens têm entre si.
 */
function MarqueeGroup({
  messages,
  clone = false,
}: {
  messages: string[]
  clone?: boolean
}) {
  return (
    <ul
      className={
        clone ? "rv-marquee-group rv-marquee-clone" : "rv-marquee-group"
      }
      aria-hidden={clone || undefined}
    >
      {messages.map((message, index) => (
        <li
          key={`${index}:${message}`}
          className="rv-eyebrow rv-section-text-onmedia whitespace-nowrap px-6 leading-none"
        >
          {message}
        </li>
      ))}
    </ul>
  )
}

