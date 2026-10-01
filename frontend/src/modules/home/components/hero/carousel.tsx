"use client"

import {
  type FocusEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import {
  CAROUSEL_SCROLL_SETTLE_MS,
  nextIndex,
  pageIndexFromScroll,
  shouldAutoplay,
} from "@lib/util/carousel"

/**
 * Quantos segundos cada slide da capa fica antes de o rodízio passar ao próximo.
 *
 * Sete — um a mais que os seis da vitrine (`CAROUSEL_AUTOPLAY_SECONDS`): a capa é
 * uma foto inteira com uma frase, e a frase precisa de tempo de leitura. Menos
 * que isso a capa vira GIF; mais que isso o segundo slide quase não existe —
 * quem percorre a home passa da dobra antes do rodízio fechar a volta. É
 * **constante de código, e não campo do CRM**: o contrato só ganha campo quando o
 * lojista tem o que decidir com ele, e "trocar mais devagar" ainda não foi
 * pedido. Quando for, o número que ele herda é este.
 */
const HERO_AUTOPLAY_SECONDS = 7

/**
 * O trilho da capa carrossel: o relógio e o ponto aceso.
 *
 * A capa com dois slides ou mais é **esta ilha de cliente**, e ela é pequena de
 * propósito: quem recebe o HTML das fotos e das cópias é o `children`, que o
 * servidor renderiza (`hero/index.tsx`). O dado não atravessa a fronteira — o
 * que atravessa é o *estado* de navegação, que é o que não existe no servidor.
 * Com um slide só, a ilha nem é montada: a capa continua HTML puro.
 *
 * As decisões puras (de quanto em quanto tempo, de quem é a vez, em que slide
 * está) moram em `lib/util/carousel.ts`, com teste próprio — aqui fica só o que é
 * de React: efeito, `ref` e evento. A conta é a **mesma do carrossel de produtos**
 * (`product-carousel/index.tsx`): a capa é o caso particular em que cada página é
 * um slide, e por isso `pageCount` aqui é o número de slides.
 *
 * **O relógio reinicia a cada troca, venha de onde vier.** O temporizador é um
 * `setTimeout` que depende do slide atual, e não um `setInterval`: o rodízio
 * automático dá ao slide o mesmo tempo que o clique no ponto dá — quem escolheu
 * o slide à mão tem tempo de lê-lo antes de a capa andar sozinha de novo.
 *
 * **A rolagem é a fonte da verdade.** O clique no ponto e o relógio chamam o
 * mesmo `scrollTo`, e é a posição do trilho que decide o ponto aceso — por isso
 * arrastar com o dedo acende o ponto certo sem nenhum código de dedo. Durante o
 * `scrollTo` a rolagem é ignorada de propósito (ver `CAROUSEL_SCROLL_SETTLE_MS`).
 *
 * **Quem para o rodízio (WCAG 2.2.2).** São três coisas, e nenhuma é um botão de
 * pausa: o `prefers-reduced-motion` do sistema desliga o rodízio por inteiro, o
 * ponteiro em cima e o foco do teclado o seguram enquanto estão lá, e o **clique
 * no ponto o para de vez** — no primeiro gesto de navegação o visitante assume o
 * volante, e a capa não volta a andar sozinha. É o mecanismo que existe no lugar
 * de um botão `Pausar`/`Retomar` que chegou a ser estilizado (`.rv-hero-pause`)
 * e nunca chegou ao HTML: um controle que ninguém podia clicar não atendia
 * critério nenhum. O que falta é o botão visível — decisão de produto, e não
 * código esquecido (ver `brand.css`).
 *
 * **Limite conhecido:** com a aba visível e a capa fora da dobra, o rodízio
 * continua rodando. Parar no `IntersectionObserver` é o caminho — e é o que o
 * carrossel de produtos já faz —, mas a capa é a primeira dobra em qualquer
 * navegação normal, e um observador a mais aqui não mudaria nada que se veja.
 */
export default function HeroCarousel({
  count,
  children,
}: {
  count: number
  children: ReactNode
}) {
  const track = useRef<HTMLDivElement>(null)
  // O quadro da leitura de rolagem e o relógio do `scrollTo` em voo: dois
  // temporizadores que sobrevivem ao evento que os criou, e por isso precisam
  // de limpeza no desmonte.
  const frame = useRef<number | null>(null)
  const settle = useRef<number | null>(null)
  const animating = useRef(false)

  const [index, setIndex] = useState(0)
  /*
   * O visitante assumiu o volante: o primeiro clique num ponto para o rodízio de
   * vez (ver o cabeçalho). É o `stopped` do `shouldAutoplay`.
   */
  const [stopped, setStopped] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [reduced, setReduced] = useState(false)

  /*
   * A preferência do sistema é lida no efeito, e não no primeiro render: o
   * HTML do servidor não tem `matchMedia`, e um valor diferente no cliente
   * seria divergência de hidratação. Até o efeito rodar `reduced` é `false` — e
   * como o rodízio só começa depois dele, nada se move antes da hora.
   */
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduced(query.matches)

    sync()
    query.addEventListener("change", sync)

    return () => query.removeEventListener("change", sync)
  }, [])

  /** Aba oculta é o visitante que saiu: o rodízio não tem para quem rodar. */
  useEffect(() => {
    const sync = () => setHidden(document.hidden)

    document.addEventListener("visibilitychange", sync)

    return () => document.removeEventListener("visibilitychange", sync)
  }, [])

  useEffect(
    () => () => {
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current)
      }

      if (settle.current !== null) {
        window.clearTimeout(settle.current)
      }
    },
    []
  )

  const go = useCallback(
    (to: number) => {
      const element = track.current

      if (!element) {
        return
      }

      setIndex(to)
      animating.current = true

      if (settle.current !== null) {
        window.clearTimeout(settle.current)
      }

      settle.current = window.setTimeout(() => {
        animating.current = false
        settle.current = null

        // O destino pedido é a resposta normal; reler a rolagem cobre o
        // navegador que não animou, ou que parou antes do fim.
        const settled = track.current

        if (settled) {
          setIndex(
            pageIndexFromScroll({
              scrollLeft: settled.scrollLeft,
              clientWidth: settled.clientWidth,
              scrollWidth: settled.scrollWidth,
              // Cada página é um slide: o número de páginas é o de slides.
              pageCount: count,
            })
          )
        }
      }, CAROUSEL_SCROLL_SETTLE_MS)

      element.scrollTo({
        left: to * element.clientWidth,
        // Menos movimento tira a animação da **troca**, e não só a do rodízio:
        // quem pediu menos movimento não quer a capa deslizando sob o dedo.
        behavior: reduced ? "auto" : "smooth",
      })
    },
    [count, reduced]
  )

  useEffect(() => {
    if (
      !shouldAutoplay({
        // Cada página é um slide: o número de páginas é o de slides.
        pageCount: count,
        reducedMotion: reduced,
        held: hovering || focused || hidden,
        stopped,
        // A capa não observa a interseção (ver o limite conhecido, acima).
        onScreen: true,
      })
    ) {
      return
    }

    const timer = window.setTimeout(
      () => go(nextIndex(index, count)),
      HERO_AUTOPLAY_SECONDS * 1000
    )

    return () => window.clearTimeout(timer)
  }, [count, focused, go, hidden, hovering, index, reduced, stopped])

  /**
   * A leitura da rolagem, uma por quadro.
   *
   * Quem arrasta move o trilho dezenas de vezes por segundo, e o que interessa é
   * onde ele parou — o `requestAnimationFrame` é o que evita uma conta (e um
   * `setState`) por evento.
   */
  const onScroll = () => {
    if (frame.current !== null) {
      return
    }

    frame.current = window.requestAnimationFrame(() => {
      frame.current = null

      const element = track.current

      if (!element || animating.current) {
        return
      }

      const current = pageIndexFromScroll({
        scrollLeft: element.scrollLeft,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        pageCount: count,
      })

      setIndex((previous) => (previous === current ? previous : current))
    })
  }

  /**
   * O foco só segura o rodízio quando ele **veio do teclado**.
   *
   * Um clique no ponto deixa o foco no botão, e contar esse foco deixaria o
   * rodízio parado para sempre depois do primeiro clique — quem pausa de
   * propósito tem o botão ao lado para isso. `:focus-visible` é justamente a
   * pergunta "este foco é do teclado?", e é o navegador quem responde.
   */
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target

    if (target instanceof Element && target.matches(":focus-visible")) {
      setFocused(true)
    }
  }

  return (
    <div
      className="relative"
      /*
       * Ponteiro, foco e aba oculta param o rodízio, e os três ficam no
       * contêiner do carrossel inteiro — trilho **e** controles. Parar só no
       * trilho deixaria o rodízio correndo enquanto o visitante navega os
       * pontos por Tab, que é exatamente quem a WCAG 2.2.2 quer proteger.
       */
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onFocus={onFocus}
      onBlur={() => setFocused(false)}
    >
      <div
        ref={track}
        onScroll={onScroll}
        className="rv-hero-track no-scrollbar flex snap-x snap-mandatory scroll-smooth overflow-x-auto"
      >
        {children}
      </div>

      <ul className="rv-container absolute inset-x-0 bottom-8 z-20 flex items-center gap-x-3">
        {Array.from({ length: count }, (_, dot) => (
          <li key={dot}>
            <button
              type="button"
              className="rv-hero-dot"
              // `aria-current`, e não uma classe de aceso: o estado do ponto é
              // do leitor de tela, e a cor sai do mesmo atributo no CSS.
              aria-current={dot === index ? "true" : undefined}
              aria-label={`Ir para o slide ${dot + 1} de ${count}`}
              onClick={() => {
                // O primeiro clique à mão para o rodízio de vez: é o mecanismo
                // de parada que existe no lugar do botão de pausa.
                setStopped(true)
                go(dot)
              }}
            />
          </li>
        ))}

        {/*
         * O botão de pausa **não** está aqui, e este comentário é o registro que
         * ficou dele: o estilo chegou a ser escrito (`.rv-hero-pause`, em
         * `brand.css`) e nenhum `Pausar` chegou ao HTML — um controle que ninguém
         * podia clicar. O que para o rodízio é o clique no ponto (acima), o
         * ponteiro em cima, o foco do teclado e o `prefers-reduced-motion`; ver o
         * cabeçalho deste arquivo.
         */}
      </ul>
    </div>
  )
}

