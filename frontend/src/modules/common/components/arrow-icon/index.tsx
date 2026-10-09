/**
 * A seta do redesenho — o traço fino que acompanha um link de texto ("Ver tudo",
 * a chamada de um cartão de coleção).
 *
 * Ela é um SVG de 24px desenhado aqui, e não um ícone do `@medusajs/icons`, pelo
 * mesmo motivo do chevron do carrossel (`product-carousel/index.tsx`): o traço da
 * régua é um só (`M5 12h14` com a ponta em `m14 7 5 5-5 5`, `stroke-width: 1.5`,
 * sem preenchimento), e é ele que dá o peso miúdo do gesto. Os ícones da casa são
 * de outra família (15px, contorno fechado) e ao lado de uma caixa alta de 9px
 * pesariam mais que o texto.
 *
 * O desenho é o **único** nos dois lugares em que aparece: o tamanho vem da
 * classe que acompanha o link (`.rv-section-link-icon` / `.rv-collection-cta-icon`,
 * em `brand.css`), e a cor é o `currentColor` de quem o usa.
 */
export default function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m14 7 5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
