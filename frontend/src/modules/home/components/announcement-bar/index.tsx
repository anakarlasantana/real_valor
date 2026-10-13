import { type CSSProperties } from "react"

import { appearanceVars } from "@lib/content/appearance"
import {
  announceSections,
  DEFAULT_HOME_SECTIONS,
  type AnnouncementSection,
} from "@lib/content/home-sections"
import {
  tickerCopies,
  tickerLapSeconds,
  tickerMessages,
} from "@lib/util/ticker"

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
 * **A volta do ticker cobre a tela.** O laço só fecha sem buraco se a volta —
 * o que o keyframe leva pela tela — for mais larga que ela. Com duas mensagens
 * curtas a lista tem um terço da largura de uma tela de 1440, e o vão entrava
 * pela direita **antes** de a cópia chegar: a mensagem seguinte aparecia no meio
 * da barra em vez de entrar pela borda, e a faixa preta ficava à vista. Quem
 * resolve é o util (`tickerCopies`), repetindo a lista dentro da volta — como a
 * faixa do Instagram já fazia com as fotos —, mais o piso de `100vw` de
 * `.rv-announce-strip .rv-marquee-group` no `brand.css`, que cobre o caso em que
 * nem as cópias chegam (uma mensagem curta demais, ou uma tela mais larga que a
 * volta cheia). A duração acompanha a volta (`tickerLapSeconds`): o campo
 * continua sendo **segundos por volta da lista**, e não segundos da volta cheia.
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

  /*
   * Uma volta do trilho, e a duração dela. O `translateX(-50%)` do keyframe leva
   * uma volta inteira pela tela: a lista repetida (`tickerCopies`) é o que faz a
   * volta ser mais larga que a tela, e a duração é `speedSeconds × cópias`
   * (`tickerLapSeconds`), que é o que mantém o ritmo que o campo promete.
   */
  const copies = tickerCopies(messages.length)

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
                "--rv-marquee-duration": `${tickerLapSeconds(
                  messages.length,
                  content.speedSeconds
                )}s`,
              }
            : {}),
        } as CSSProperties
      }
    >
      {rolling ? (
        <Marquee messages={messages} copies={copies} />
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
 *
 * `rv-announce-strip` é a marca desta faixa (a do Instagram é `rv-insta-strip`),
 * e existe para o piso de `100vw` do `brand.css` ter onde morar: o
 * `.rv-marquee-group` é compartilhado pelas duas seções, e só a barra de anúncio
 * é que precisa da garantia — o quadro do Instagram já tem largura fixa.
 *
 * Com **uma** mensagem só esta faixa não é desenhada (o caso é o `<p>` centrado
 * do componente): a barra não tem vão para tapar, porque quem pinta a largura
 * inteira é o fundo da seção, e o texto parado não sai pela borda nem deixa
 * buraco atrás. É por isso que `tickerCopies(1)` é 1 e não oito cópias.
 */
function Marquee({
  messages,
  copies,
}: {
  messages: string[]
  copies: number
}) {
  return (
    <div className="rv-marquee rv-announce-strip flex min-h-[38px] items-center">
      <div className="rv-marquee-track">
        <MarqueeGroup messages={messages} copies={copies} />
        {/* A cópia do laço: existe para o olho, não para o leitor de tela. */}
        <MarqueeGroup messages={messages} copies={copies} clone />
      </div>
    </div>
  )
}

/**
 * A classe de cada mensagem na volta — e o respiro de 1.5rem de cada lado, que é
 * o mesmo em todas as junções: é essa uniformidade que faz a costura entre duas
 * voltas ter exatamente o espaço que as mensagens têm entre si.
 */
const MESSAGE_CLASS =
  "rv-eyebrow rv-section-text-onmedia whitespace-nowrap px-6 leading-none"

/**
 * Uma volta do trilho — a lista de mensagens repetida até a volta passar da
 * largura da tela (`tickerCopies`), porque uma volta mais estreita que a tela
 * deixa o vão da emenda à vista.
 *
 * A repetição é **do lado de dentro** da volta, e não cópias do grupo: o
 * `translateX(-50%)` leva uma volta inteira pela tela, então o que precisa ter
 * largura suficiente é a volta. Cada mensagem mantém o respiro de 1.5rem de cada
 * lado — o mesmo em todas as junções —, e é essa uniformidade que faz a costura
 * entre uma volta e a seguinte ter exatamente o mesmo espaço que as mensagens
 * têm entre si.
 *
 * As repetições que passam da **primeira** lista saem com `aria-hidden`: elas
 * existem para tapar a largura da tela, e o leitor de tela ouve as mensagens que
 * o lojista escreveu — uma vez, como antes de a volta ser repetida. É o mesmo
 * princípio do grupo inteiro que sai escondido (a cópia do laço), um nível
 * abaixo. E, com o movimento desligado, elas somem **da tela** também
 * (`rv-marquee-repeat`): parada, a faixa não tem vão para tapar.
 */
function MarqueeGroup({
  messages,
  copies,
  clone = false,
}: {
  messages: string[]
  copies: number
  clone?: boolean
}) {
  const lap = Array.from({ length: copies }, () => messages).flat()

  return (
    <ul
      className={
        clone ? "rv-marquee-group rv-marquee-clone" : "rv-marquee-group"
      }
      aria-hidden={clone || undefined}
    >
      {lap.map((message, index) => {
        /*
         * A **repetição** é da volta: a primeira lista é a mensagem que o lojista
         * escreveu, e o resto existe para a volta chegar à borda da tela. Ela sai
         * da leitura (o leitor de tela ouve a lista uma vez, como sempre ouviu) e
         * sai da tela quando a faixa está parada (`rv-marquee-repeat`, no
         * `brand.css`): sem movimento não há vão para tapar, e quatro cópias da
         * mesma linha seriam ruído.
         */
        const repeat = index >= messages.length

        return (
          // A chave é o **lugar na volta**, e não a mensagem: a mesma mensagem
          // aparece várias vezes de propósito, e uma chave por mensagem se
          // repetiria.
          <li
            key={index}
            aria-hidden={repeat || undefined}
            className={
              repeat ? `${MESSAGE_CLASS} rv-marquee-repeat` : MESSAGE_CLASS
            }
          >
            {message}
          </li>
        )
      })}
    </ul>
  )
}

