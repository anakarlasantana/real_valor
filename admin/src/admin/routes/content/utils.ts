/**
 * Funções utilitárias compartilhadas entre os componentes de conteúdo.
 * Extraídas de page.tsx para evitar duplicação e dependências circulares.
 */
import type { Schema, Section, OrderFaixa, ContentSurfaceSpec } from "@conteudo/contract"

/**
 * Retorna os tipos que podem ser criados em uma superfície,
 * excluindo singletons que já existem.
 */
export function creatableTypes(
  schema: Schema,
  sections: Section[],
  surface?: ContentSurfaceSpec
): string[] {
  const singletons = new Set(schema.singletonTypes ?? [])
  const present = new Set(sections.map((section) => section.type))

  return (surface?.types ?? []).filter(
    (type) => !singletons.has(type) || !present.has(type)
  )
}

/**
 * Uma âncora livre para o tipo escolhido (hero, hero-2, hero-3...).
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
 * O numeral que a seção na casa `place` vai receber quando a ordem pendente for publicada.
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
