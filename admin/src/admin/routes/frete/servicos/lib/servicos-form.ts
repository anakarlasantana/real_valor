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

/** Os códigos da `/api/v0/calculator`. O painel não importa do backend (bundle
 * separado) e o corpo manda **o código**: sem esta tabela, "código 1". */
export const CODIGOS_SUPERFRETE = {
  PAC: "1",
  SEDEX: "2",
  MINI: "17",
  JADLOG: "3",
  JNT: "33",
  LOGGI: "31",
} as const

const ROTULOS_DO_CATALOGO: Record<keyof typeof CODIGOS_SUPERFRETE, string> = {
  PAC: "PAC",
  SEDEX: "SEDEX",
  MINI: "Mini Envios",
  JADLOG: "Jadlog",
  JNT: "J&T",
  LOGGI: "Loggi",
}

/** O corpo que o backend mandou ao SuperFrete — o contrato da `/api/v0/calculator`. */
export type RequisicaoDaCotacao = {
  metodo: string
  url: string
  caminho: string
  cabecalhos: Record<string, string>
  corpo: {
    from: { postal_code: string }
    to: { postal_code: string }
    services: string
    options: Record<string, unknown>
    package: { height: number; width: number; length: number; weight: number }
  }
}

/** O que a resposta de `/admin/shipping/testar` traz além das cotações. */
export type AuditoriaDaCotacao = {
  requisicao?: RequisicaoDaCotacao
  latenciaMs?: number
  origem?: string
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

/** O que impede a cotação de teste de sair. Não exige serviço ligado: o teste
 * inclui os desligados — é assim que se descobre se a Jadlog cota. */
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

/** De onde veio o preço, em português: quem testa precisa saber se foi à rede. */
export function origemDaCotacao(origem: unknown): string {
  switch (String(origem ?? "")) {
    case "rede":
      return "resposta da API"
    case "redis":
      return "cache do Redis"
    case "memoria":
      return "cache em memória"
    default:
      return "origem não informada"
  }
}

/** `1200` → `1,2 s`; `180` → `180 ms`. Tempo de parede não mostra microssegundo. */
export function tempoDaCotacao(msBrutos: number): string {
  const ms = Math.max(0, Math.round(Number(msBrutos) || 0))

  return ms >= 1000 ? `${(ms / 1000).toFixed(1).replace(".", ",")} s` : `${ms} ms`
}

/** `"1,2,17"` + catálogo → `"PAC, SEDEX, Mini Envios"`. A busca é pelo código do
 * catálogo, nunca pela string: o corpo manda código, não nome. */
export function servicosDoCorpo(
  corpo: RequisicaoDaCotacao["corpo"],
  servicos: ServicoDaTela[],
): string {
  const codigos = Object.values(CODIGOS_SUPERFRETE) as string[]

  return String(corpo?.services ?? "")
    .split(",")
    .map((codigo) => codigo.trim())
    .filter(Boolean)
    .map((codigo) => {
      const posicao = codigos.indexOf(codigo)

      if (posicao === -1) {
        return `código ${codigo}`
      }

      const chave = Object.keys(CODIGOS_SUPERFRETE)[posicao] as keyof typeof CODIGOS_SUPERFRETE
      const achado = (servicos ?? []).find((linha) => linha.servico === chave)

      return achado?.nome ?? ROTULOS_DO_CATALOGO[chave]
    })
    .join(", ")
}

/** Escapa um valor para dentro de aspas simples, no cURL. */
function aspas(valor: string): string {
  // A aspa simples se escreve, no shell, fechando, escapando e reabrindo.
  // Codigos em `fromCharCode` (39 = aspas, 92 = contrabarra): a sequencia
  // em literal e padrao de substituicao para `replace`/`join`.
  const ASPA = String.fromCharCode(39)
  const BARRA = String.fromCharCode(92)
  const texto = String(valor).split(ASPA).join(ASPA + BARRA + ASPA + ASPA)

  return ASPA + texto + ASPA
}

/** O cURL da `POST /api/v0/calculator` como saiu daqui. O token nunca chega ao
 * navegador: o cabeçalho vem mascarado e o comando usa `$SUPERFRETE_TOKEN`. */
export function curlDaCotacao(requisicao: RequisicaoDaCotacao): string {
  const linhas = [`curl -X ${requisicao.metodo} ${aspas(requisicao.url)}`]

  for (const [nome, valor] of Object.entries(requisicao.cabecalhos ?? {})) {
    const mostrado = /^authorization$/i.test(nome) ? "Bearer $SUPERFRETE_TOKEN" : valor

    linhas.push(`  -H ${aspas(`${nome}: ${mostrado}`)}`)
  }

  linhas.push(
    `  --data-raw ${aspas(JSON.stringify(requisicao.corpo, null, 2))}`,
  )

  // `espaco + contrabarra + quebra de linha`: o shell junta as linhas.
  const quebra = " " + String.fromCharCode(92) + String.fromCharCode(10)

  return linhas.join(quebra)
}
