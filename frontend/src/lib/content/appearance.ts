import { type CSSProperties } from "react"

import {
  FONT_ROLES,
  THEME_COLOR_TOKENS,
  THEME_DARK_TOKENS,
  type SectionAppearance,
} from "@lib/content/home-sections"

/**
 * Aparência por seção — da escolha do lojista no CRM para o CSS.
 * -----------------------------------------------------------------
 * O lojista escolhe, por seção, a fonte e as cores (título, texto,
 * detalhe e fundo) entre os **papéis do tema** — nunca um hex solto —,
 * e o que este módulo devolve é o mapa de variáveis CSS que o wrapper
 * da seção recebe inline:
 *
 *   appearanceHeadingFont    → --rv-section-heading-font
 *   appearanceTextFont       → --rv-section-text-font
 *   appearanceHeadingColor   → --rv-section-heading-color
 *   appearanceTextColor      → --rv-section-text-color
 *   appearanceAccentColor    → --rv-section-accent
 *   appearanceBackgroundColor → --rv-section-bg
 *
 * Quem consome essas variáveis são as classes `.rv-section-*` do
 * `styles/brand.css`, cada uma com o valor que a seção já usava como
 * fallback do `var()` — por isso uma seção sem nenhuma escolha rende
 * exatamente o mesmo HTML e o mesmo pixel de antes.
 *
 * O valor emitido é `var(--rv-dourado)`, e não `#d4b19a`: a seção aponta
 * para o **papel** do tema, então um tema sazonal (Black Friday, Natal)
 * recolore a seção junto com o resto da loja. Guardar a cor literal
 * venceria o tema em vez de acompanhá-lo.
 *
 * Campo vazio — o padrão e o caso normal — fica de fora do mapa: sem a
 * variável, cada classe cai no fallback dela.
 *
 * Exceção, e a única regra que não vem direto de um campo: **fundo escuro
 * sem cor de texto escolhida ganha texto off white**. `preto` de fundo com
 * o grafite padrão seria ilegível, e o lojista que escolheu um fundo escuro
 * não tem por que saber que o texto tem de ser escolhido junto. A escolha
 * explícita sempre vence — quem gravar `grafite` de texto num fundo `preto`
 * fica com grafite. Ver `THEME_DARK_TOKENS`.
 *
 * Valor fora das listas é ignorado, e não escrito: o que vem do banco é
 * texto livre, e uma variável apontando para `var(--rv-roxo)` deixaria a
 * declaração inválida no meio do cascade (o fallback do `var()` só vale
 * quando a variável não existe, não quando ela existe e não resolve).
 *
 * A entrada é `unknown` de propósito. Quem chama é o wrapper da home, que
 * recebe a união `HomeSection` — e `nav`/`footer` viajam nessa união sem
 * nenhum campo de aparência (o editor não os oferece), o que reprovaria
 * num tipo `SectionAppearance` pelo cheque de "tipo fraco" (`Type 'NavSection'
 * has no properties in common`). Como cada valor é validado aqui antes de
 * virar CSS, o tipo não acrescentaria garantia nenhuma: quem garante que
 * os nomes lidos são os do contrato é
 * `scripts/check-contract-parity.mjs`.
 */
export function appearanceVars(section?: unknown): CSSProperties {
  const source = (section ?? {}) as SectionAppearance
  const vars: Record<string, string> = {}

  const color = (variable: string, value: unknown) => {
    if (
      typeof value === "string" &&
      (THEME_COLOR_TOKENS as readonly string[]).includes(value)
    ) {
      vars[variable] = `var(--rv-${value})`
    }
  }

  const font = (variable: string, value: unknown) => {
    if (
      typeof value === "string" &&
      (FONT_ROLES as readonly string[]).includes(value)
    ) {
      vars[variable] = `var(--rv-font-${value})`
    }
  }

  font("--rv-section-heading-font", source.appearanceHeadingFont)
  font("--rv-section-text-font", source.appearanceTextFont)

  color("--rv-section-heading-color", source.appearanceHeadingColor)
  color("--rv-section-text-color", source.appearanceTextColor)
  color("--rv-section-accent", source.appearanceAccentColor)
  color("--rv-section-bg", source.appearanceBackgroundColor)

  // Fundo escuro sem texto escolhido: legibiliza sem sobrescrever quem
  // escolheu (as duas chaves só entram se ainda estiverem vazias).
  if (
    typeof source.appearanceBackgroundColor === "string" &&
    (THEME_DARK_TOKENS as readonly string[]).includes(
      source.appearanceBackgroundColor
    )
  ) {
    vars["--rv-section-heading-color"] ??= "var(--rv-offwhite)"
    vars["--rv-section-text-color"] ??= "var(--rv-offwhite)"
  }

  return vars
}
