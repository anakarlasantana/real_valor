/**
 * Conteúdo da vitrine — a fachada que o storefront importa.
 * -----------------------------------------------------------------
 * Tipos das seções, listas fechadas do tema e conteúdo padrão vêm do
 * **pacote do contrato** (`@rv/contrato`, `packages/contrato/src/`), o mesmo
 * que o backend e o CRM importam. Até o G5 esta linha apontava para
 * `./contract.generated`, uma cópia escrita por `node scripts/gen-content.mjs`;
 * a cópia morreu e a fronteira contrato ⇔ loja passou a ser do compilador.
 *
 * Aqui mora só o que é decisão da vitrine: os quatro seletores com que o
 * layout separa o cromo (anúncio, cabeçalho, rodapé) do conteúdo da home,
 * e a regra de ordem (`visibleSections`). O `export *` preserva o caminho de
 * importação que os componentes usam desde o protótipo
 * (`@lib/content/home-sections`).
 */

import {
  DEFAULT_FOOTER,
  DEFAULT_HEADER,
  DEFAULT_HOME_SECTIONS,
  type AnnouncementSection,
  type FooterSection,
  type HomeSection,
  type NavSection,
} from "@rv/contrato"

export * from "@rv/contrato"

/** Sections sorted by position and with disabled ones removed. */
export function visibleSections(sections: HomeSection[]): HomeSection[] {
  return sections
    .filter((section) => section.enabled)
    .slice()
    .sort((a, b) => a.position - b.position)
}

/**
 * The announcement bar is site chrome (every route), not home content,
 * yet its copy is content. The layout calls this to pull just that one
 * block, so the string still lives in a single place and becomes
 * admin-editable together with the rest of the CMS later.
 */
export function announceSections(
  sections: HomeSection[] = DEFAULT_HOME_SECTIONS
): AnnouncementSection | undefined {
  return sections.find(
    (section): section is AnnouncementSection => section.type === "announcement"
  )
}

/**
 * The header is site chrome (every route), not home content, yet its
 * links are content — same reasoning as `announceSections`, so the
 * layout pulls that one block out of the payload it already fetched.
 *
 * Falls back to `DEFAULT_HEADER` when there is no `nav` block: disabled
 * sections are removed by `visibleSections` before this point, and an
 * empty header is worse than a plain one.
 */
export function headerSections(
  sections: HomeSection[] = DEFAULT_HOME_SECTIONS
): NavSection {
  return (
    sections.find((section): section is NavSection => section.type === "nav") ??
    DEFAULT_HEADER
  )
}

/**
 * The footer is chrome on every route, same as the header, and its copy
 * is content — so the layout pulls that one block out of the payload it
 * already fetched, and a single request feeds both.
 *
 * Falls back to `DEFAULT_FOOTER` when there is no `footer` block
 * (the seed never ran, the admin hid it, or `/store/content` failed): an
 * empty footer would take the wordmark and the rights line with it.
 */
export function footerSections(
  sections: HomeSection[] = DEFAULT_HOME_SECTIONS
): FooterSection {
  return (
    sections.find(
      (section): section is FooterSection => section.type === "footer"
    ) ?? DEFAULT_FOOTER
  )
}
