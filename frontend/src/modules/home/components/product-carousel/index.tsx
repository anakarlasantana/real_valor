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
} from "@lib/util/carousel"

/**
 * O carrossel da vitrine — a ilha de cliente de "Peças em destaque" e de
 * "Lançamentos".
 * -------------------------------------------------------------------------
 * Quem carrega os cards é o **servidor** (`children`): produto, preço e chip
 * saem no HTML da primeira pintura, como nas outras seções. O que atravessa a
 * fronteira é só o *estado de navegação*, que não existe no servidor — em que
 * página a fila está, quantos pontos acenderam e de quem é a vez de andar. É o
 * mesmo desenho do carrossel da capa (`hero/carousel.tsx`), e a conta pura dos
 * dois mora junta (`lib/util/carousel.ts`).
 *
 * As decisões deste arquivo, e o que cada uma custa:
 *
 *   1. **Quem sabe o desenho é o CSS.** A largura do card e o vão vivem em
 *      `.rv-carousel-track` / `.rv-carousel-item` (`brand.css`), e o componente
 *      **mede** o resultado no DOM (`ResizeObserver`): com dois cards e meio por
 *      tela no tablet, `pagesOf(3, 2,48)` dá duas páginas; com o card de 76% do
 *      celular (1,29 por tela), dá três; com os três cards do desktop (3,29) e
 *      três peças publicadas, dá **uma**. Uma tabela de pontos de quebra em
 *      JavaScript seria a segunda régua do mesmo desenho — e a que fica velha
 *      primeiro.
 *   2. **Sem página a mais, sem controle.** Enquanto o trilho não foi medido (e
 *      quando tudo cabe na tela) não há seta nem ponto: um controle que não leva
 *      a lugar nenhum é ruído, e um contador de páginas errado é pior que
 *      nenhum. Os controles entram depois da medida, quando há página para
 *      trocar.
 *
 *      **O que isso custa:** os controles não existem no HTML do servidor (lá não
 *      há como medir), então a seção cresce os ~3rem deles uma vez, no primeiro
 *      quadro depois da hidratação. Reservar o espaço com um buraco de 3rem em
 *      *todo* carrossel — inclusive nos que não têm página para trocar — seria
 *      pior que o crescimento; e um contador de pontos chutado no servidor seria
 *      pior que os dois.
 *   3. **Ponteiro em cima pausa — e acende o card apontado.** O carrossel para
 *      de andar e o card sob o cursor fica aceso, com os irmãos em ~70% de
 *      opacidade. O escurecimento é CSS puro (`.rv-carousel`, com
 *      `@media (hover: hover)`), então não há estado de "qual card" para
 *      sincronizar com o ponteiro.
 *   4. **O primeiro gesto do visitante para a fila de vez.** No primeiro clique
 *      de seta ou de ponto, e no primeiro arrasto, `stopped` vira `true` e o
 *      rodízio não volta.
 *
 *      **Dívida conhecida (WCAG 2.2.2):** pausar no ponteiro não é um mecanismo
 *      de parada — atende quem está com o mouse em cima, e não quem navega por
 *      teclado ou por leitor de tela. O que fecha o critério é o item 4 (o
 *      movimento nunca volta depois de o visitante assumir o volante) somado ao
 *      `prefers-reduced-motion`, que desliga o rodízio no sistema de quem pediu
 *      menos movimento e é lido aqui, em efeito. O que falta é o botão visível de
 *      pausa — o mesmo que a barra de anúncio espera (`brand.css`, `.rv-marquee`)
 *      —, e ele não foi acrescentado junto porque põe um controle na moldura de
 *      todas as seções. Enquanto não existir, `stopped` é o mecanismo: qualquer
 *      toque no carrossel o para para sempre.
 *   5. **Fora da tela não roda.** O `IntersectionObserver` é o que impede o
 *      relógio de andar numa seção que ninguém está vendo — a fila chegaria
 *      adiantada na tela de quem chegou.
 *
 * O `key` de quem monta esta ilha **inclui o filtro ativo** (`?peca=vestidos`):
 * trocar de chip remonta o carrossel, e a vitrine filtrada começa na primeira
 * página em vez de abrir na página 2 de outra lista.
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
  // O quadro da leitura de rolagem e o relógio do `scrollTo` em voo: dois
  // temporizadores que sobrevivem ao evento que os criou, e por isso precisam
  // de limpeza no desmonte.
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

  /*
   * A preferência do sistema é lida no efeito, e não no primeiro render: o HTML
   * do servidor não tem `matchMedia`, e um valor diferente no cliente seria
   * divergência de hidratação. Até o efeito rodar `reduced` é `false` — e como o
   * rodízio só começa depois dele, nada se move antes da hora.
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

  /**
   * Onde o trilho estava parado da última vez que fomos nós que o movemos.
   *
   * Serve para separar as duas rolagens: a que nós pedimos (seta, ponto,
   * relógio) e a que o visitante fez. A distância de comparação é folgada
   * porque o `snap` do navegador ainda ajusta alguns pixels depois de parar.
   */
  const restingAt = useRef(0)

  /**
   * A medida do trilho.
   *
   * O vão vem do `getComputedStyle` (o `columnGap` do flex) em vez de um `24`
   * escrito aqui: o desenho é de quem escreve o CSS, e no dia em que o vão mudar
   * de 1.5rem para outra coisa a conta acompanha sozinha.
   */
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

    // A largura do card é uma fração da largura do trilho: a medida só muda
    // quando a janela muda, e o `ResizeObserver` é quem avisa.
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
      // Um quinto do trilho já é "está na tela": esperar o carrossel inteiro
      // atrasaria o rodízio de quem chega rolando, e o critério aqui é só não
      // gastar relógio com o que está fora da vista.
      { threshold: 0.15 }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  /**
   * Leva o trilho a uma página.
   *
   * É o mesmo caminho para a seta, o ponto e o relógio: a página deixa de ser
   * decidida por quem chamou e passa a ser lida da posição do trilho — por isso
   * arrastar com o dedo acende o ponto certo sem código de dedo nenhum.
   */
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

        // O destino pedido é a resposta normal; reler a rolagem cobre o
        // navegador que não animou, ou que parou antes do fim (o último ponto
        // fica a um pixel do fim do trilho).
        const settled = track.current

        if (settled) {
          restingAt.current = settled.scrollLeft
          setIndex(pageAt(settled, pageCount))
        }
      }, CAROUSEL_SCROLL_SETTLE_MS)

      element.scrollTo({
        left: page * element.clientWidth,
        // Menos movimento tira a animação da **troca**, e não só a do rodízio:
        // quem pediu menos movimento não quer a fila deslizando sob o dedo.
        behavior: reduced ? "auto" : "smooth",
      })
    },
    [pageCount, reduced]
  )

  /**
   * A leitura da rolagem, uma por quadro.
   *
   * Quem arrasta move o trilho dezenas de vezes por segundo, e o que interessa é
   * onde ele parou — o `requestAnimationFrame` é o que evita uma conta (e um
   * `setState`) por evento. A rolagem que nós mesmos pedimos é ignorada de
   * propósito (ver `CAROUSEL_SCROLL_SETTLE_MS`).
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

      const current = pageAt(element, pageCount)

      setIndex((previous) => (previous === current ? previous : current))

      // Rolagem que não é nossa é do visitante: ele assumiu o volante, e a fila
      // não volta a andar sozinha (ver o item 4 do cabeçalho).
      if (Math.abs(element.scrollLeft - restingAt.current) > 8) {
        restingAt.current = element.scrollLeft
        setStopped(true)
      }
    })
  }

  /**
   * O foco só segura o rodízio quando ele **veio do teclado**.
   *
   * Um clique no ponto deixa o foco no botão, e contar esse foco seria contar
   * duas vezes o mesmo gesto — o clique já para a fila de vez, e por outro
   * caminho. `:focus-visible` é justamente a pergunta "este foco é do teclado?",
   * e é o navegador quem responde.
   */
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
      // `aria-roledescription` diz o que a região é ("carrossel"), e o
      // `aria-label` diz de que peças ele é — os dois, sem inventar um `role`
      // que não existe.
      aria-roledescription="carrossel"
      aria-label={label}
      data-testid="product-carousel"
      className="rv-carousel"
      /*
       * Ponteiro no carrossel inteiro — trilho **e** controles. Parar só no
       * trilho deixaria a fila andando enquanto o visitante navega os pontos.
       */
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onFocus={onFocus}
      onBlur={() => setFocused(false)}
    >
      <div className="relative">
        <ul
          ref={track}
          onScroll={onScroll}
          /*
           * `rv-rail` é a barra de rolagem da casa: fina e dourada no desktop
           * (onde ela é a pista de que há mais peça à direita) e ausente no
           * celular, onde o gesto de arrastar é o óbvio. Nada de `no-scrollbar`
           * aqui — as duas classes se anulam.
           */
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

/**
 * A página que a rolagem do trilho está mostrando.
 *
 * Existe para o componente não repetir os quatro campos do DOM em cada lugar em
 * que precisa perguntar — a conta é de `lib/util/carousel.ts`.
 */
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

