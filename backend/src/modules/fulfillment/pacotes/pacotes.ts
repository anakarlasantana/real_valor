export type Pacote = {
  id: string
  nome: string
  peso_gramas: number
  altura_cm: number
  largura_cm: number
  comprimento_cm: number
  padrao: boolean
  ativo: boolean
}

export type PesosDaCaixa = Pick<
  Pacote,
  "peso_gramas" | "altura_cm" | "largura_cm" | "comprimento_cm"
>


export const DIVISOR_CUBAGEM = 6000


export const LIMITES_CORREIOS = {
  altura: { min: 2, max: 100 },
  largura: { min: 11, max: 105 },
  comprimento: { min: 16, max: 105 },
  soma: 200,
  peso_gramas: 30_000,
} as const


export function pesoCubico(pacote: PesosDaCaixa): number {
  const volume =
    Number(pacote.altura_cm) *
    Number(pacote.largura_cm) *
    Number(pacote.comprimento_cm)

  return Math.ceil(volume / DIVISOR_CUBAGEM) * 1000
}


export function pesoTaxavel(pacote: PesosDaCaixa): number {
  return Math.max(Number(pacote.peso_gramas) || 0, pesoCubico(pacote))
}


export function volumeCm3(pacote: PesosDaCaixa): number {
  return (
    Number(pacote.altura_cm) *
    Number(pacote.largura_cm) *
    Number(pacote.comprimento_cm)
  )
}


export function problemasDaCaixa(pacote: PesosDaCaixa): string[] {
  const problemas: string[] = []
  const dimensoes: [string, number, { min: number; max: number }][] = [
    ["altura", Number(pacote.altura_cm), LIMITES_CORREIOS.altura],
    ["largura", Number(pacote.largura_cm), LIMITES_CORREIOS.largura],
    ["comprimento", Number(pacote.comprimento_cm), LIMITES_CORREIOS.comprimento],
  ]

  for (const [nome, valor, limite] of dimensoes) {
    if (!Number.isFinite(valor) || valor < limite.min || valor > limite.max) {
      problemas.push(
        `A ${nome} deve ficar entre ${limite.min} cm e ${limite.max} cm.`
      )
    }
  }

  const soma =
    Number(pacote.altura_cm) +
    Number(pacote.largura_cm) +
    Number(pacote.comprimento_cm)

  if (soma > LIMITES_CORREIOS.soma) {
    problemas.push(
      `A soma das medidas (${soma} cm) passa do limite de ${LIMITES_CORREIOS.soma} cm.`
    )
  }

  const peso = Number(pacote.peso_gramas)

  if (!Number.isFinite(peso) || peso <= 0) {
    problemas.push("O peso deve ser maior que zero.")
  } else if (peso > LIMITES_CORREIOS.peso_gramas) {
    problemas.push(
      `O peso passa do limite de ${LIMITES_CORREIOS.peso_gramas / 1000} kg dos Correios.`
    )
  }

  return problemas
}


export function caixaValida(pacote: PesosDaCaixa): boolean {
  return problemasDaCaixa(pacote).length === 0
}


export function padraoUnico(pacotes: Pacote[]): Pacote | undefined {
  return pacotes.find((pacote) => pacote.padrao && pacote.ativo)
}


export function comPadraoUnico<T extends { id: string; padrao: boolean }>(
  pacotes: T[],
  id: string
): T[] {
  return pacotes.map((pacote) => ({
    ...pacote,
    padrao: pacote.id === id,
  }))
}
