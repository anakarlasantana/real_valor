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
  CAROUSEL_AUTOPLAY_SECONDS,
  CAROUSEL_SCROLL_SETTLE_MS,
  itemsPerView,
  nextIndex,
  pageIndexFromScroll,
  pagesOf,
  shouldAutoplay,
} from "@lib/ui/carousel"

/**
 * O carrossel da vitrine — a ilha de cliente de "Peças em destaque" e de
 * "Lançamentos". Os cards vêm do servidor (`children`); só o estado de navegação
 * atravessa a fronteira. **Quem sabe o desenho é o CSS** e o componente **mede**
 * o DOM (`ResizeObserver`), nunca uma tabela de breakpoints; sem página a mais
 * (medida), não há seta nem ponto — nascem só quando há página para trocar.
 */
/*
 * Dívida conhecida (WCAG 2.2.2): pausar no ponteiro não é mecanismo de parada —
 * atende o mouse, não o teclado/leitor de tela. O critério fecha com o primeiro
 * gesto (`stopped` vira `true` e não volta) somado ao `prefers-reduced-motion`;
 * falta o botão visível de pausa. O `key` de quem monta inclui o filtro ativo.
 */
export default function ProductCarousel({
  label,
  count,
  children,
}: {
  /** O nome do carrossel para o leitor de tela ("Peças em destaque"). */
  label: string
  /** Quantos cards vieram — o número de páginas sai daqui. */
  count: number
  /** Os cards, renderizados pelo servidor. */
  children: ReactNode
}) {
  const track = useRef<HTMLUListElement>(null)
  // Dois temporizadores que sobrevivem ao evento que os criou: limpeza no desmonte.
  const frame = useRef<number | null>(null)
  const settle = useRef<number | null>(null)
  const animating = useRef(false)

  const [index, setIndex] = useState(0)
  const [perView, setPerView] = useState(1)
  const [measured, setMeasured] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [onScreen, setOnScreen] = useState(false)

  const pageCount = pagesOf(count, perView)
  /** Só há controle quando o trilho foi medido e sobra página para navegar. */
  const controls = measured && pageCount > 1

  // A preferência do sistema é lida no efeito, não no primeiro render (não há
  // `matchMedia` no servidor): um valor diferente seria divergência de hidratação.
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

  /**
   * Onde o trilho estava parado na última vez que o movemos — separa a rolagem
   * que pedimos da que o visitante fez.
   * `null` = "ainda não sabemos": começando em `0`, a primeira leitura viava da
   * tolerância e parava a fila (`stopped`) — o trilho abre já deslocado.
   */
  const restingAt = useRef<number | null>(null)

  /** A medida do trilho: o vão vem do `getComputedStyle` (`columnGap`) em vez de
   * um `24` escrito aqui — o desenho é de quem escreve o CSS, e a conta acompanha
   * quando o vão mudar. */
  const measure = useCallback(() => {
    const element = track.current

    if (!element) {
      return
    }

    const first = element.firstElementChild as HTMLElement | null
    const gap = Number.parseFloat(getComputedStyle(element).columnGap)

    setPerView(
      itemsPerView(
        element.clientWidth,
        first?.offsetWidth ?? 0,
        Number.isFinite(gap) ? gap : 0
      )
    )
    setMeasured(true)
  }, [])

  useEffect(() => {
    measure()

    const element = track.current

    if (!element || typeof ResizeObserver === "undefined") {
      return
    }

    // A largura do card é fração do trilho: a medida só muda quando a janela muda.
    const observer = new ResizeObserver(measure)
    observer.observe(element)

    return () => observer.disconnect()
  }, [measure])

  /** Fora da tela a fila não anda — ver o item 5 do cabeçalho. */
  useEffect(() => {
    const element = track.current

    if (!element || typeof IntersectionObserver === "undefined") {
      setOnScreen(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setOnScreen(entries.some((entry) => entry.isIntersecting))
      },
      // Um quinto já é "está na tela": esperar o carrossel inteiro atrasaria o
      // rodízio; o critério é só não gastar relógio com o que está fora da vista.
      { threshold: 0.15 }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  /** Leva o trilho a uma página — o mesmo caminho para seta, ponto e relógio: a
   * página passa a ser lida da posição do trilho, então o dedo acende o ponto certo. */
  const go = useCallback(
    (page: number) => {
      const element = track.current

      if (!element) {
        return
      }

      setIndex(page)
      animating.current = true

      if (settle.current !== null) {
        window.clearTimeout(settle.current)
      }

      settle.current = window.setTimeout(() => {
        animating.current = false
        settle.current = null

        // O destino pedido; reler a rolagem cobre o navegador que não animou ou
        // parou antes do fim (o último ponto fica a um pixel do fim).
        const settled = track.current

        if (settled) {
          restingAt.current = settled.scrollLeft
          setIndex(pageAt(settled, pageCount))
        }
      }, CAROUSEL_SCROLL_SETTLE_MS)

      element.scrollTo({
        left: page * element.clientWidth,
        // Menos movimento tira a animação da **troca**, e não só a do rodízio.
        behavior: reduced ? "auto" : "smooth",
      })
    },
    [pageCount, reduced]
  )

  /** A leitura da rolagem, uma por quadro: o `requestAnimationFrame` evita uma
   * conta por evento; a rolagem que nós pedimos é ignorada (`CAROUSEL_SCROLL_SETTLE_MS`). */
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

      const current = pageAt(element, pageCount)

      setIndex((previous) => (previous === current ? previous : current))

      // Rolagem que não é nossa é do visitante: ele assumiu o volante e a fila
      // não volta a andar sozinha (item 4). A **primeira** leitura não conta como
      // gesto: até aqui o `restingAt` é `null` (o trilho abre já deslocado).
      if (restingAt.current === null) {
        restingAt.current = element.scrollLeft
        return
      }

      if (Math.abs(element.scrollLeft - restingAt.current) > 8) {
        restingAt.current = element.scrollLeft
        setStopped(true)
      }
    })
  }

  /** O foco só segura o rodízio quando **veio do teclado** (`:focus-visible`): um
   * clique no ponto já para a fila, e contar esse foco seria contar duas vezes. */
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target

    if (target instanceof Element && target.matches(":focus-visible")) {
      setFocused(true)
    }
  }

  /** O relógio da fila, reiniciado a cada troca — inclusive na troca à mão. */
  useEffect(() => {
    if (
      !measured ||
      !shouldAutoplay({
        pageCount,
        reducedMotion: reduced,
        held: hovering || focused || hidden,
        stopped,
        onScreen,
      })
    ) {
      return
    }

    const timer = window.setTimeout(
      () => go(nextIndex(index, pageCount)),
      CAROUSEL_AUTOPLAY_SECONDS * 1000
    )

    return () => window.clearTimeout(timer)
  }, [
    focused,
    go,
    hidden,
    hovering,
    index,
    measured,
    onScreen,
    pageCount,
    reduced,
    stopped,
  ])

  /** A página acesa — nunca além da última, mesmo depois de a janela encolher. */
  const activePage = Math.min(index, pageCount - 1)
  /* A anterior, dando a volta no começo: é a volta que dá o laço. */
  const previousPage = (activePage - 1 + pageCount) % pageCount

  return (
    <div
      role="group"
      // `aria-roledescription` diz o que a região é ("carrossel"); o `aria-label`,
      // de que peças ele é. Os dois, sem inventar um `role` que não existe.
      aria-roledescription="carrossel"
      aria-label={label}
      data-testid="product-carousel"
      className="rv-carousel"
      /* Ponteiro no carrossel inteiro — trilho **e** controles: parar só no
         trilho deixaria a fila andando enquanto o visitante navega os pontos. */
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onFocus={onFocus}
      onBlur={() => setFocused(false)}
    >
      <div className="relative">
        <ul
          ref={track}
          onScroll={onScroll}
          /* `rv-rail` é a barra de rolagem da casa: fina e dourada no desktop (a
           * pista de que há mais peça à direita), ausente no celular. */
          className="rv-carousel-track rv-rail"
        >
          {children}
        </ul>

        {controls && (
          <>
            <button
              type="button"
              className="rv-carousel-arrow rv-carousel-arrow-prev"
              aria-label="Peças anteriores"
              data-testid="carousel-prev"
              onClick={() => {
                setStopped(true)
                go(previousPage)
              }}
            >
              <Chevron direction="prev" />
            </button>

            <button
              type="button"
              className="rv-carousel-arrow rv-carousel-arrow-next"
              aria-label="Próximas peças"
              data-testid="carousel-next"
              onClick={() => {
                setStopped(true)
                go(nextIndex(activePage, pageCount))
              }}
            >
              <Chevron direction="next" />
            </button>
          </>
        )}
      </div>

      {controls && (
        <ul className="rv-carousel-dots" data-testid="carousel-dots">
          {Array.from({ length: pageCount }, (_, page) => (
            <li key={page}>
              <button
                type="button"
                className="rv-carousel-dot"
                // `aria-current`, e não uma classe de aceso: o estado do ponto é
                // do leitor de tela, e a cor sai do mesmo atributo no CSS.
                aria-current={page === activePage ? "true" : undefined}
                aria-label={`Ir para a página ${page + 1} de ${pageCount}`}
                data-testid="carousel-dot"
                onClick={() => {
                  setStopped(true)
                  go(page)
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** A página que a rolagem do trilho está mostrando — evita repetir os quatro
 * campos do DOM em cada lugar; a conta é de `lib/ui/carousel.ts`. */
function pageAt(element: HTMLElement, pageCount: number): number {
  return pageIndexFromScroll({
    scrollLeft: element.scrollLeft,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    pageCount,
  })
}

/** O traço da seta: fino, sem peso de ícone cheio, no `currentColor` do botão. */
function Chevron({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="rv-carousel-arrow-icon"
    >
      <path
        d={direction === "next" ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

