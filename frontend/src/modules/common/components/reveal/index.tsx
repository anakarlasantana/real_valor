"use client"

import { clx } from "@medusajs/ui"
import { type ReactNode, useEffect, useRef, useState } from "react"

/**
 * O bloco que entra em cena quando aparece na tela.
 * -------------------------------------------------------------------------
 * É a única animação da vitrine que depende do JavaScript — o resto é CSS —, e
 * depende por um motivo só: **quem decide se o bloco está na tela é o
 * navegador**, e a resposta muda enquanto a pessoa rola. O `IntersectionObserver`
 * dá essa resposta sem listener de `scroll` e sem uma conta por quadro.
 *
 * As três decisões que fazem dele algo que não atrapalha:
 *
 *   1. **É uma ilha de cliente com os filhos do servidor**, como o carrossel da
 *      capa: o `children` chega pronto do servidor (o card, com produto e preço
 *      no HTML) e o que hidrata é o invólucro. A primeira pintura da página
 *      continua sendo a página inteira.
 *   2. **Entra uma vez e sai do caminho.** Ao aparecer, o observador é
 *      desconectado: rolar para cima e para baixo de novo não reanima nada, e o
 *      bloco não fica refém de um estado que muda.
 *   3. **Sem JavaScript, o conteúdo aparece.** A regra que esconde o bloco (em
 *      `brand.css`) vale só dentro de `@media (scripting: enabled)` *e* de
 *      `prefers-reduced-motion: no-preference`: onde o JavaScript não roda, ou
 *      onde o visitante pediu menos movimento, a classe não esconde nada e a
 *      vitrine é a de sempre.
 *
 * O atraso chega pronto (`revealDelay(index)`, `lib/util/motion.ts`): o compasso
 * é decisão de comportamento, e mora longe do React com teste próprio.
 */
export default function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode
  /** O atraso da entrada, em ms — ver `revealDelay`. */
  delay?: number
}) {
  const node = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const element = node.current

    if (!element) {
      return
    }

    if (typeof IntersectionObserver === "undefined") {
      // Navegador sem observador (ou ambiente de teste): o bloco aparece. É a
      // falha para o lado que não esconde conteúdo.
      setShown(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true)
          observer.disconnect()
        }
      },
      // A margem negativa embaixo é o que faz a entrada acontecer quando o bloco
      // já está um pouco dentro da tela, e não quando ele encosta na borda de
      // baixo: quem rola rápido não vê a animação pela metade.
      { rootMargin: "0px 0px -10% 0px" }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={node}
      className={clx("rv-reveal", shown && "rv-reveal-in")}
      // O atraso vai inline porque é do compasso do índice, e não uma classe: o
      // Tailwind não gera `delay-[Nms]` para um número que só existe em runtime.
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
