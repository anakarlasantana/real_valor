"use client"

import {
  type CSSProperties,
  type PointerEvent,
  useRef,
  useState,
} from "react"

import {
  marqueeCopies,
  marqueeSeconds,
  marqueeSeekOffset,
} from "@lib/util/marquee"

import { InstagramTile, type InstagramImage } from "./tile"

/**
 * A faixa do Instagram: o quadro que anda — e que a mão move.
 * -------------------------------------------------------------------------
 * Quem carrega as fotos é o **servidor** (`index.tsx`): o `src` e o `alt` de cada
 * quadro saem no HTML da primeira pintura, e a faixa continua sendo um laço de
 * CSS (`@keyframes rv-marquee`) **mesmo sem JavaScript** — esta ilha de cliente
 * acrescenta um gesto, e só: arrastar a faixa com o ponteiro.
 *
 * As decisões deste arquivo, e o que cada uma custa:
 *
 *   1. **O arrasto é um `seek`, e não uma segunda animação.** O trilho anda
 *      sozinho porque o CSS manda; o ponteiro não move o trilho — ele *adianta ou
 *      atrasa o relógio* que já está andando, escrevendo o `animation-delay` com a
 *      conta de `marqueeSeekOffset`. Isso custa um detalhe: mexer no relógio sem
 *      pausar seria um salto no meio do movimento, então o arrasto pausa
 *      (`.rv-insta-dragging`) enquanto o dedo está em cima. E economiza o que
 *      quase todo carrossel arrastável carrega: **nenhuma posição paralela** para
 *      manter de acordo com o CSS — o que o olho vê é sempre o keyframe, e o laço
 *      continua fechado com a mão no meio dele.
 *
 *      **O que isso custa:** com o movimento desligado
 *      (`prefers-reduced-motion: reduce`, que tira a animação — `brand.css`), o
 *      arrasto não tem relógio para mover e a faixa vira a lista parada de
 *      sempre. O cursor `grab` sai de cena nesse caso (o `brand.css` troca por
 *      `default`), para o ponteiro não prometer um gesto que não anda.
 *
 *   2. **O dedo anda o que o olho vê.** `dx` px de ponteiro valem `dx` px de
 *      faixa — não "um tantinho para o lado": a foto fica **debaixo do cursor**, e
 *      é isso que separa um carrossel que a visitante controla de um que ela
 *      empurra. Soltar não devolve a faixa ao lugar de antes: o `animation-delay`
 *      fica, e a faixa retoma o laço de onde a mão a deixou.
 *
 *   3. **O estado do arrasto não desenha.** O `seek` e o gesto em curso são
 *      `useRef`, e o valor do arrasto vai direto no `style` do trilho: um
 *      `setState` por `pointermove` seria um render por quadro para escrever um
 *      número que o React não lê — quem desenha é o CSS. O único estado de verdade
 *      é `dragging`, que muda duas vezes por gesto (pega e solta) e existe porque o
 *      cursor e a pausa do relógio são de classe.
 *
 *   4. **A medida é do CSS.** A volta (`period`) é metade da largura do trilho
 *      medida no DOM, e não uma soma de quadros que o JavaScript acredita: a
 *      largura de um quadro é `clamp(200px, 24vw, 340px)` no `brand.css`, e uma
 *      segunda conta aqui seria a segunda régua do mesmo desenho. Ela é medida no
 *      gesto — não há observador de tamanho — porque o gesto é o único momento em
 *      que o número é usado, e uma faixa nunca medida não é um caso a tratar: é um
 *      arrasto que não começa.
 */
export default function InstagramStrip({
  images,
  seconds,
}: {
  images: InstagramImage[]
  seconds: unknown
}) {
  const strip = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)

  /**
   * Os segundos de `animation-delay` que já estão no trilho.
   *
   * Vive em `useRef` porque é **o que o arrasto escreveu no DOM**, e não um
   * desenho que o React precise refazer: só este arquivo escreve o
   * `animation-delay`, então o valor daqui e o da tela são o mesmo por
   * construção — e é ele que a próxima pegada do ponteiro herda.
   */
  const seek = useRef(0)

  /** O gesto em curso: quem pegou, onde pegou e com que `seek`. */
  const drag = useRef<{ pointerId: number; x: number; seek: number } | null>(null)

  const [dragging, setDragging] = useState(false)

  // A duração da **volta** (segundos por imagem × quadros da volta) é a mesma que
  // o CSS anima e a mesma que o arrasto converte em segundos.
  const duration = marqueeSeconds(images.length, seconds)

  /**
   * A largura de uma volta, em px: metade do trilho, que carrega a lista duas
   * vezes. É **exatamente** a distância que o `translateX(-50%)` do keyframe anda,
   * e por isso ela é medida, e não somada.
   */
  function period(): number {
    const node = track.current

    return node ? node.getBoundingClientRect().width / 2 : 0
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    // Só o botão principal (o do meio e o direito têm outro dono), e só com uma
    // volta medida: sem a medida a regra de três do arrasto não existe.
    if (event.button !== 0 || period() <= 0) {
      return
    }

    /*
     * O ponteiro fica **preso** à faixa (`setPointerCapture`): o arrasto continua
     * valendo depois de sair dela, e sem isso o gesto morre na borda do bloco — no
     * meio de um arrasto para fora da tela, que é o gesto mais natural de todos.
     */
    strip.current?.setPointerCapture(event.pointerId)

    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      seek: seek.current,
    }
    setDragging(true)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current
    const node = track.current

    if (!state || !node || state.pointerId !== event.pointerId) {
      return
    }

    /*
     * Do **começo do gesto** para cá, e não do último quadro: somar incrementos
     * erra por arredondamento, e num arrasto longo o erro aparece como faixa e
     * dedo fora de sincronia — o defeito que este arquivo existe para não ter.
     */
    const next =
      state.seek + marqueeSeekOffset(state.x - event.clientX, period(), duration)

    seek.current = next
    node.style.animationDelay = `-${next}s`
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current

    if (!state || state.pointerId !== event.pointerId) {
      return
    }

    drag.current = null

    if (strip.current?.hasPointerCapture(event.pointerId)) {
      strip.current.releasePointerCapture(event.pointerId)
    }

    // O `animation-delay` **fica** onde o dedo o deixou — é ele que guarda a
    // posição; este `setState` só devolve o cursor e o relógio.
    setDragging(false)
  }

  return (
    <div
      ref={strip}
      className={
        dragging
          ? "rv-marquee rv-insta-strip rv-insta-dragging"
          : "rv-marquee rv-insta-strip"
      }
      /*
       * A duração da volta entra inline, como na barra de anúncio. O `var()` do CSS
       * só cai no padrão do ticker se a variável não chegar — o que não acontece
       * enquanto o servidor renderizar a faixa (a animação é de CSS, e vale sem
       * JavaScript).
       */
      style={{ "--rv-marquee-duration": `${duration}s` } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/*
       * O trilho é `div`, e não `ul` como o grupo de dentro — o mesmo desenho do
       * ticker da barra de anúncio. `ul` dentro de `ul` é marcação inválida (só
       * `li` pode ser filho de `ul`), e é o grupo que é a lista: quem lê a tela
       * ouve uma lista de fotos, e não uma lista de listas.
       */}
      <div ref={track} className="rv-marquee-track">
        <StripGroup images={images} />
        {/* A cópia do laço: existe para o olho, não para o leitor de tela. */}
        <StripGroup images={images} clone />
      </div>
    </div>
  )
}

/**
 * Uma volta do trilho — a lista de fotos repetida até a volta passar da largura da
 * tela (`marqueeCopies`), porque uma volta mais estreita que a tela deixa o vão da
 * emenda à vista.
 *
 * A repetição é **do lado de dentro** da volta, e não cópias do grupo: o
 * `translateX(-50%)` leva uma volta inteira pela tela, então o que precisa ter
 * largura suficiente é a volta.
 */
function StripGroup({
  images,
  clone = false,
}: {
  images: InstagramImage[]
  clone?: boolean
}) {
  const tiles = Array.from(
    { length: marqueeCopies(images.length) },
    () => images
  ).flat()

  return (
    <ul
      className={
        clone ? "rv-marquee-group rv-marquee-clone" : "rv-marquee-group"
      }
      aria-hidden={clone || undefined}
    >
      {tiles.map((image, index) => (
        // A chave é o **lugar na volta**, e não a foto: a mesma foto aparece
        // várias vezes de propósito, e uma chave por foto se repetiria.
        <InstagramTile key={index} image={image} />
      ))}
    </ul>
  )
}
