/**
 * Funções utilitárias compartilhadas entre os componentes de conteúdo.
 * -------------------------------------------------------------------------
 * Extraídas de page.tsx para evitar duplicação e dependências circulares.
 *
 * São todas **puras**, e é por isso que moram fora dos componentes: a varredura
 * dos campos do contrato em linhas de formulário (`toRows`), o aviso do trilho de
 * fundo (`railNote`), os tipos que podem ser criados (`creatableTypes`), a âncora
 * livre (`freeAnchor`) e a previsão do numeral (`numeralFor`).
 * `__tests__/utils.unit.spec.ts` as prende — a de `numeralFor`, contra a mesma
 * conta que o `applyOrder` (backend) faz.
 *
 * O `import type` vem pelo alias `@conteudo/*` (`admin/tsconfig.json`), que aponta
 * para o módulo do conteúdo no backend: o vínculo tem nome em vez de cinco
 * níveis de `..` (ver docs/plano-centralizacao.md, R2). Só tipo atravessa — valor
 * importado por este apelido é reprovado por `scripts/check-boundaries.mjs`.
 */
import type {
  AppearanceGroup,
  ContentSurfaceSpec,
  FieldSpec,
} from "@conteudo/contract"
import type { OrderFaixa } from "@conteudo/order"

import type { Schema, Section } from "./types"

/**
 * Uma linha do formulário: um campo de conteúdo solto, ou um trilho de aparência
 * (o grupo de campos que veste o campo anterior).
 */
export type FormRow =
  | { kind: "field"; spec: FieldSpec }
  | { kind: "rail"; group: string; specs: FieldSpec[] }

/**
 * O trilho do fundo da seção.
 *
 * Espelha `APPEARANCE_GROUPS` do contrato (`packages/contrato/src/contract.ts`) e
 * existe só para o aviso de fundo escuro: é o único trilho onde uma escolha tem
 * um efeito automático que o lojista não escolheu — o texto do bloco vira claro
 * (`appearanceVars`, no storefront). O tipo `AppearanceGroup` é o que garante que
 * renomear o trilho no contrato não deixa o aviso apontando para o nada.
 */
export const BACKGROUND_RAIL: AppearanceGroup = "Fundo"

/**
 * Percorre os campos do contrato na ordem e devolve as linhas do formulário.
 *
 * É uma varredura sequencial, e não um agrupamento por tipo de campo, porque a
 * ordem é o que o contrato promete: o trilho "Títulos" vem logo depois do campo
 * que ele veste, e não numa seção "Aparência" no fim. O contrato garante isso
 * declarando os trilhos em ordem, no mesmo array (`attachedTo` + a guarda de
 * paridade), então aqui basta seguir.
 *
 * Um `rail` em andamento fecha quando o conteúdo volta ou o grupo muda; um mesmo
 * grupo aparecendo em dois trechos viraria dois trilhos com o mesmo rótulo, que é
 * o que a âncora do contrato existe para impedir.
 */
export function toRows(specs: readonly FieldSpec[]): FormRow[] {
  const rows: FormRow[] = []

  for (const spec of specs) {
    const group = spec.group
    const last = rows[rows.length - 1]

    // Trilho em aberto: o campo é do mesmo grupo do último trilho empilhado. Um
    // campo de conteúdo no meio (por isso o `last.kind === "rail"`) fecha o
    // trilho — e um mesmo grupo voltando mais adiante viraria dois trilhos de
    // mesmo nome, que é o que a âncora do contrato existe para impedir.
    if (group && last?.kind === "rail" && last.group === group) {
      last.specs.push(spec)
      continue
    }

    if (group) {
      rows.push({ kind: "rail", group, specs: [spec] })
      continue
    }

    rows.push({ kind: "field", spec })
  }

  return rows
}

/**
 * O aviso do trilho, quando ele se aplica.
 *
 * Só o trilho do fundo tem aviso, e só quando a cor escolhida é uma das escuras
 * (`schema.darkTokens`): é a regra do storefront de legibilizar o texto em off
 * white quando o fundo é escuro e ninguém escolheu uma cor de texto. Não é um
 * campo para o lojista preencher — é a loja fazendo sozinha algo que ele precisa
 * saber que vai acontecer, porque escolher "Preto" e ler o texto da seção em
 * grafite na tela o faria desconfiar do CRM.
 *
 * Aviso que está sempre escrito vira ruído, então só aparece na escolha escura.
 */
export function railNote(
  row: Extract<FormRow, { kind: "rail" }>,
  draft: Record<string, unknown>,
  darkTokens?: readonly string[]
): string | undefined {
  if (row.group !== BACKGROUND_RAIL || !darkTokens?.length) {
    return undefined
  }

  const isDark = row.specs.some((spec) =>
    darkTokens.includes(String(draft[spec.name] ?? ""))
  )

  return isDark
    ? "Fundo escuro: o texto do bloco fica claro automaticamente, para não ficar ilegível. Escolher uma cor de texto tem efeito por cima."
    : undefined
}

/**
 * Os tipos que podem ser criados agora.
 *
 * Fora os **únicos que já existem**: barra de anúncio, cabeçalho, rodapé, capa e
 * faixa de benefícios só aceitam um bloco cada — os três primeiros e o rodapé
 * porque o layout os resolve por `find`; a capa e a faixa porque moram numa casa
 * ancorada (ver `FIXED_SECTION_POSITIONS`). A API recusa o segundo de qualquer um
 * deles, e oferecer o botão seria oferecer um erro. Quem diz quais são é
 * `schema.singletonTypes`, que sai do mesmo contrato que a rota usa.
 *
 * A lista sai da **superfície** — o que ela pode criar —, e não de
 * `schema.types`: a aba da vitrine oferece seções e a do tema oferece a estação.
 * Sem isto o diálogo da aba do tema ofereceria "Hero", um bloco que nenhum render
 * daquela superfície lê.
 */
export function creatableTypes(
  schema: Schema,
  sections: Section[],
  surface?: ContentSurfaceSpec
): string[] {
  const singletons = new Set<string>(schema.singletonTypes ?? [])
  const present = new Set(sections.map((section) => section.type))

  return (surface?.types ?? []).filter(
    (type) => !singletons.has(type) || !present.has(type)
  )
}

/**
 * Uma âncora livre para o tipo escolhido (`hero`, `hero-2`, `hero-3`…).
 *
 * A âncora é o `id` do bloco e o fragmento do link (`/#hero`): sugerir uma que já
 * existe só levaria a um erro na criação, e o lojista não tem como adivinhar o
 * que está livre.
 */
export function freeAnchor(type: string, sections: Section[]): string {
  const taken = new Set(sections.map((section) => section.id))

  if (!taken.has(type)) {
    return type
  }

  for (let n = 2; ; n += 1) {
    const candidate = `${type}-${n}`

    if (!taken.has(candidate)) {
      return candidate
    }
  }
}

/**
 * O numeral que a seção na casa `place` **vai** receber quando a ordem pendente
 * for publicada — a mesma conta que o servidor faz (`applyOrder`, em
 * `modules/content/order.ts`).
 *
 * A faixa chega como dado (`order`, no payload) com as casas **ancoradas**
 * (`reserved`): na home, a casa 10 é do rodapé, e a renumeração a pula — as
 * ordenáveis ficam em 5 a 9 e, a partir da sexta, em 11. O painel precisa pular
 * as mesmas casas; se ele só multiplicasse `first + place * step`, o numeral da
 * tela seria um que a gravação não segue — e um numeral que discorda da ordem
 * visível é pior do que nenhum.
 */
export function numeralFor(place: number, order: OrderFaixa): number {
  const reserved = new Set(order.reserved ?? [])
  let position = order.first
  let free = 0

  while (true) {
    if (!reserved.has(position)) {
      if (free === place) {
        return position
      }

      free += 1
    }

    position += order.step
  }
}
