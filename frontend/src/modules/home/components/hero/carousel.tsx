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
  HERO_AUTOPLAY_SECONDS,
  HERO_SCROLL_SETTLE_MS,
  nextIndex,
  shouldAutoplay,
  slideIndexFromScroll,
} from "@lib/util/hero-carousel"

/**
 * O trilho da capa carrossel: o relógio, o ponto aceso e o botão de pausa.
 *
 * A capa com dois slides ou mais é **esta ilha de cliente**, e ela é pequena de
 * propósito: quem recebe o HTML das fotos e das cópias é o `children`, que o
 * servidor renderiza (`hero/index.tsx`). O dado não atravessa a fronteira — o
 * que atravessa é o *estado* de navegação, que é o que não existe no servidor.
 * Com um slide só, a ilha nem é montada: a capa continua HTML puro.
 *
 * As três decisões puras (de quanto em quanto tempo, de quem é a vez, em que
 * slide está) moram em `lib/util/hero-carousel.ts`, com teste próprio — aqui
 * fica só o que é de React: efeito, `ref` e evento.
 *
 * **O relógio reinicia a cada troca, venha de onde vier.** O temporizador é um
 * `setTimeout` que depende do slide atual, e não um `setInterval`: o rodízio
 * automático dá ao slide o mesmo tempo que o clique no ponto dá — quem escolheu
 * o slide à mão tem tempo de lê-lo antes de a capa andar sozinha de novo.
 *
 * **A rolagem é a fonte da verdade.** O clique no ponto e o relógio chamam o
 * mesmo `scrollTo`, e é a posição do trilho que decide o ponto aceso — por isso
 * arrastar com o dedo acende o ponto certo sem nenhum código de dedo. Durante o
 * `scrollTo` a rolagem é ignorada de propósito (ver `HERO_SCROLL_SETTLE_MS`).
 *
 * **Limite conhecido:** com a aba visível e a capa fora da dobra, o rodízio
 * continua rodando. Parar no `IntersectionObserver` é o caminho, e é o mesmo que
 * a capa de um slide não precisa — hoje o rodízio se contenta com o
 * `visibilitychange`.
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
  const [paused, setPaused] = useState(false)
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
            slideIndexFromScroll(settled.scrollLeft, settled.clientWidth, count)
          )
        }
      }, HERO_SCROLL_SETTLE_MS)

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
        count,
        reducedMotion: reduced,
        paused,
        held: hovering || focused || hidden,
      })
    ) {
      return
    }

    const timer = window.setTimeout(
      () => go(nextIndex(index, count)),
      HERO_AUTOPLAY_SECONDS * 1000
    )

    return () => window.clearTimeout(timer)
  }, [count, focused, go, hidden, hovering, index, paused, reduced])

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

      const current = slideIndexFromScroll(
        element.scrollLeft,
        element.clientWidth,
        count
      )

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
              onClick={() => go(dot)}
            />
          </li>
        ))}

        {/*
         * Sem rodízio (movimento reduzido no sistema) não há o que pausar: um
         * botão que não pausa nada seria um controle morto na capa.
         */}
      </ul>
    </div>
  )
}

