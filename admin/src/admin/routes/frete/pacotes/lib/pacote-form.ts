export type PacoteDaTela = {
  id: string
  nome: string
  peso_gramas: number
  altura_cm: number
  largura_cm: number
  comprimento_cm: number
  pesoTaxavel: number
  padrao: boolean
  ativo: boolean
}


export type RascunhoPacote = {
  nome: string
  peso_gramas: string
  altura_cm: string
  largura_cm: string
  comprimento_cm: string
  padrao: boolean
  ativo: boolean
}

export const LIMITES = {
  altura: { min: 2, max: 100 },
  largura: { min: 11, max: 105 },
  comprimento: { min: 16, max: 105 },
  soma: 200,
  peso_gramas: 30_000,
} as const

export const RASCUNHO_VAZIO: RascunhoPacote = {
  nome: "",
  peso_gramas: "",
  altura_cm: "",
  largura_cm: "",
  comprimento_cm: "",
  padrao: false,
  ativo: true,
}


export function paraRascunho(pacote: PacoteDaTela): RascunhoPacote {
  return {
    nome: pacote.nome,
    peso_gramas: String(pacote.peso_gramas),
    altura_cm: String(pacote.altura_cm),
    largura_cm: String(pacote.largura_cm),
    comprimento_cm: String(pacote.comprimento_cm),
    padrao: pacote.padrao,
    ativo: pacote.ativo,
  }
}

export function problemasDoRascunho(rascunho: RascunhoPacote): string[] {
  const problemas: string[] = []
  const medidas: [string, string, { min: number; max: number }][] = [
    ["altura", rascunho.altura_cm, LIMITES.altura],
    ["largura", rascunho.largura_cm, LIMITES.largura],
    ["comprimento", rascunho.comprimento_cm, LIMITES.comprimento],
  ]

  if (!rascunho.nome.trim()) {
    problemas.push("Dê um nome à caixa.")
  }

  for (const [rotulo, texto, limite] of medidas) {
    const valor = Number(texto)

    if (!Number.isFinite(valor) || valor < limite.min || valor > limite.max) {
      problemas.push(
        `A ${rotulo} deve ficar entre ${limite.min} cm e ${limite.max} cm.`
      )
    }
  }

  const soma =
    Number(rascunho.altura_cm) +
    Number(rascunho.largura_cm) +
    Number(rascunho.comprimento_cm)

  if (soma > LIMITES.soma) {
    problemas.push(`A soma das medidas passa do limite de ${LIMITES.soma} cm.`)
  }

  const peso = Number(rascunho.peso_gramas)

  if (!Number.isFinite(peso) || peso <= 0) {
    problemas.push("O peso deve ser maior que zero.")
  } else if (peso > LIMITES.peso_gramas) {
    problemas.push("O peso passa do limite de 30 kg dos Correios.")
  }

  return problemas
}


export function corpoDoPacote(rascunho: RascunhoPacote) {
  return {
    nome: rascunho.nome.trim(),
    peso_gramas: Number(rascunho.peso_gramas),
    altura_cm: Number(rascunho.altura_cm),
    largura_cm: Number(rascunho.largura_cm),
    comprimento_cm: Number(rascunho.comprimento_cm),
    padrao: rascunho.padrao,
    ativo: rascunho.ativo,
  }
}

export function podeDesativar(pacote: PacoteDaTela): boolean {
  return !pacote.padrao
}


export function pesoExibido(pacote: PacoteDaTela): string {
  const kg = (gramas: number) => (gramas / 1000).toFixed(2).replace(".", ",")

  return pacote.pesoTaxavel > pacote.peso_gramas
    ? `${kg(pacote.pesoTaxavel)} kg (cubagem)`
    : `${kg(pacote.peso_gramas)} kg`
}
