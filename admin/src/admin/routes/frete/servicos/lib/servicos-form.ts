/** O serviço como a tela o mostra — o mesmo JSON de `/admin/shipping/servicos`. */
export type ServicoDaTela = {
  id: string
  nome: string
  servico: string | null
  transportadora: string | null
  ativa: boolean
  precoFixo: boolean
}

export type CotacaoDaTela = {
  servico: string
  nome: string
  preco: number
  prazo: number
  /** O serviço está ligado na loja? A cotação de teste inclui os desligados. */
  ativo?: boolean
}

/** `id → ativo`; a tela só manda o que ela mudou, o backend compara com o banco. */
export function escolhasDosServicos(
  servicos: ServicoDaTela[],
): Record<string, boolean> {
  const escolhas: Record<string, boolean> = {}

  for (const servico of servicos ?? []) {
    escolhas[servico.id] = Boolean(servico.ativa)
  }

  return escolhas
}

export function corpoDosServicos(escolhas: Record<string, boolean>) {
  return {
    servicos: Object.entries(escolhas ?? {}).map(([id, ativo]) => ({
      id,
      ativo: Boolean(ativo),
    })),
  }
}

export function nadaAtivo(escolhas: Record<string, boolean>): boolean {
  const valores = Object.values(escolhas ?? {})

  return valores.length > 0 && valores.every((ativo) => !ativo)
}

/**
 * O que impede a cotação de teste de sair.
 *
 * Não exige serviço ligado: o teste inclui os desligados, porque é assim que se
 * descobre se a Jadlog cota antes de ligá-la para a loja.
 */
export function problemaDaCotacao(cep: string, testaveis: number): string | null {
  const digitos = String(cep ?? "").replace(/\D/g, "")

  if (digitos.length !== 8) {
    return "Digite um CEP de destino com 8 dígitos para testar a cotação."
  }

  if (testaveis === 0) {
    return "Nenhuma opção diz qual serviço é: rode o seed do frete para criá-las."
  }

  return null
}

/** Quantas opções têm código de serviço — ligadas ou não. */
export function testaveis(servicos: ServicoDaTela[]): number {
  return (servicos ?? []).filter((servico) => Boolean(servico.servico)).length
}

/** Os serviços que o teste vai cotar, na ordem da tela. */
export function servicosDoTeste(servicos: ServicoDaTela[]): string[] {
  return (servicos ?? [])
    .map((servico) => servico.servico)
    .filter((servico): servico is string => Boolean(servico))
}

/** Rótulo de quem não cotou: desligado é escolha, não defeito. */
export function motivoDaAusencia(
  servico: string,
  servicos: ServicoDaTela[],
): string {
  const achado = (servicos ?? []).find((linha) => linha.servico === servico)

  return achado?.ativa
    ? "Não cotou para este CEP e este peso."
    : "Desligado na loja — não cotou."
}

/** Centavos → "R$ 27,40": o preço do SuperFrete já vem em centavos. */
export function reaisDaCotacao(centavosBrutos: number): string {
  const valor = Math.max(0, Math.round(Number(centavosBrutos) || 0))

  return `R$ ${Math.floor(valor / 100)},${String(valor % 100).padStart(2, "0")}`
}

export function prazoDaCotacao(dias: number): string {
  const numero = Math.max(0, Math.round(Number(dias) || 0))

  if (numero === 0) {
    return "prazo não informado"
  }

  return numero === 1 ? "1 dia útil" : `${numero} dias úteis`
}

/** O rótulo do serviço na cotação; o código é o que o SuperFrete devolve. */
export function rotuloDaCotacao(cotacao: CotacaoDaTela): string {
  const nome = cotacao.nome || cotacao.servico

  return cotacao.ativo === false ? `${nome} (desligado)` : nome
}
