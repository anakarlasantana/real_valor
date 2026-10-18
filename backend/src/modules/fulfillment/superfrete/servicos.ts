import {
  ROTULOS,
  SERVICOS,
  TRANSPORTADORAS,
  ehServico,
  type Servico,
} from "./catalogo"

export type OpcaoDeServico = {
  id: string
  nome: string
  servico: Servico | null
  transportadora: string | null
  ativa: boolean
  precoFixo: boolean
}

export type EscolhaDeServico = {
  id: string
  ativo: boolean
}

// Sem o `data`, o `type.code` do seed (`correios_pac`) é o resto do que sobrou.
export function servicoDaOpcao(opcao: Record<string, any>): Servico | null {
  const doData = String(opcao?.data?.servico ?? "")
    .trim()
    .toUpperCase()

  if (ehServico(doData)) {
    return doData
  }

  const codigo = String(opcao?.type?.code ?? "")
    .trim()
    .toLowerCase()

  // O seed antigo usava `correios_pac` até para serviço que não é dos Correios.
  const achado = (Object.keys(ROTULOS) as Servico[]).find(
    (servico) => codigo === `correios_${servico.toLowerCase()}`,
  )

  return achado ?? null
}

// Lida pela cotação: desligar aqui tira a opção do checkout, não apaga.
export function estaAtiva(opcao: Record<string, any>): boolean {
  const regras = (opcao?.rules ?? []) as {
    attribute?: string
    value?: unknown
  }[]
  const regra = regras.find((r) => r?.attribute === "enabled_in_store")

  return regra ? String(regra.value) !== "false" : true
}

export function opcoesDoServico(
  opcoes: Record<string, any>[],
): OpcaoDeServico[] {
  const lidas = (opcoes ?? []).map((opcao) => {
    const servico = servicoDaOpcao(opcao)

    return {
      id: String(opcao.id),
      nome: String(opcao.name ?? ""),
      servico,
      // Vem do catálogo, não do nome da opção: o nome é editável.
      transportadora: servico ? TRANSPORTADORAS[servico] : null,
      ativa: estaAtiva(opcao),
      precoFixo: opcao.price_type === "flat",
    }
  })

  const ordem = Object.keys(SERVICOS) as Servico[]

  // Opção sem serviço vai para o fim: `-1` no `indexOf` a jogaria para o topo.
  const posicao = (servico: Servico | null) => {
    const indice = servico ? ordem.indexOf(servico) : -1

    return indice === -1 ? ordem.length : indice
  }

  return lidas.sort((a, b) => posicao(a.servico) - posicao(b.servico))
}

export function regrasDeAtivacao(ativa: boolean) {
  return [
    {
      attribute: "enabled_in_store",
      value: ativa ? "true" : "false",
      operator: "eq" as const,
    },
  ]
}

export type ProblemaDasEscolhas = { status: number; mensagem: string }

export function problemaDasEscolhas(
  escolhas: EscolhaDeServico[],
  atuais: OpcaoDeServico[] = [],
): ProblemaDasEscolhas | null {
  if (!Array.isArray(escolhas) || escolhas.length === 0) {
    return {
      status: 400,
      mensagem: "Mande a lista de serviços com o campo `ativo`.",
    }
  }

  if (
    escolhas.some((escolha) => typeof escolha?.id !== "string" || !escolha.id)
  ) {
    return {
      status: 400,
      mensagem: "Cada serviço precisa do `id` da opção de envio.",
    }
  }

  // O estado final, não o corpo: a tela manda só o que mudou.
  const ficamLigadas =
    atuais.length === 0
      ? escolhas.filter((escolha) => escolha.ativo === true).length
      : atuais
          .map((opcao) => {
            const escolha = escolhas.find((e) => e.id === opcao.id)

            return escolha ? escolha.ativo === true : opcao.ativa
          })
          .filter(Boolean).length

  if (ficamLigadas === 0) {
    return {
      status: 422,
      mensagem:
        "Deixe ao menos um serviço ativo, senão o checkout fica sem opção de entrega.",
    }
  }

  return null
}

export function mudancas(
  atuais: OpcaoDeServico[],
  escolhas: EscolhaDeServico[],
): { id: string; ativa: boolean }[] {
  const porId = new Map(atuais.map((opcao) => [opcao.id, opcao]))

  // Só a escolha que repete o estado fica de fora; `undefined` vira `false`.
  return escolhas
    .filter((escolha) => porId.has(escolha.id))
    .map((escolha) => ({ id: escolha.id, ativa: escolha.ativo === true }))
    .filter((escolha) => porId.get(escolha.id)!.ativa !== escolha.ativa)
}
