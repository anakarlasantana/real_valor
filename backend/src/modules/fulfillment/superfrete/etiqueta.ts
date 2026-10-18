import { caixaValida, padraoUnico, pesoTaxavel, type Pacote } from "../pacotes/pacotes"
import { SERVICOS, apenasDigitos, ehServico, paraQuilos, type Servico } from "./catalogo"

export type Endereco = {
  nome: string
  documento: string
  telefone: string
  email: string
  cep: string
  rua: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
}

export type ProdutoDoEnvio = {
  nome: string
  quantidade: number
  valorCentavos: number
}

export type Remetente = Endereco
export type Destinatario = Endereco

export type PedidoParaEtiqueta = {
  numero: number
  servico: Servico
  remetente: Remetente
  destinatario: Destinatario
  produtos: ProdutoDoEnvio[]
  pago: boolean
}

export type Problema = { status: number; mensagem: string }

// O que impede a etiqueta de existir; a mensagem diz o campo que falta.
export function problemaDaEtiqueta(pedido: PedidoParaEtiqueta): Problema | null {
  if (!pedido.pago) {
    return {
      status: 409,
      mensagem: "O pedido ainda não está pago. Pague antes de emitir a etiqueta.",
    }
  }

  if (!ehServico(pedido.servico)) {
    return { status: 422, mensagem: "O pedido não diz qual serviço de entrega ele é." }
  }

  const d = pedido.destinatario
  const faltando: string[] = []

  if (!d.nome.trim()) faltando.push("nome")
  if (apenasDigitos(d.cep).length !== 8) faltando.push("CEP")
  if (!d.rua.trim()) faltando.push("endereço")
  if (!d.bairro.trim()) faltando.push("bairro")
  if (!d.cidade.trim()) faltando.push("cidade")
  if (d.estado.trim().length !== 2) faltando.push("estado")
  if (!d.documento.trim()) faltando.push("CPF")

  if (faltando.length > 0) {
    return {
      status: 422,
      mensagem: `O endereço do pedido não serve para a etiqueta: falta ${faltando.join(", ")}.`,
    }
  }

  const r = pedido.remetente
  const faltandoRemetente: string[] = []

  if (apenasDigitos(r.cep).length !== 8) faltandoRemetente.push("CEP")
  if (!r.rua.trim()) faltandoRemetente.push("rua")
  if (!r.cidade.trim()) faltandoRemetente.push("cidade")
  if (r.estado.trim().length !== 2) faltandoRemetente.push("estado")

  if (faltandoRemetente.length > 0) {
    return {
      status: 422,
      mensagem: `O endereço do centro de distribuição está incompleto: falta ${faltandoRemetente.join(", ")}.`,
    }
  }

  if (pedido.produtos.length === 0) {
    return { status: 422, mensagem: "O pedido não tem itens para declarar." }
  }

  return null
}

export function caixaDoEnvio(caixas: Pacote[]): Pacote | null {
  const elegiveis = (caixas || [])
    .filter((caixa) => caixa?.ativo)
    .filter(caixaValida)
    .sort((a, b) => a.peso_gramas - b.peso_gramas)

  return padraoUnico(elegiveis) ?? elegiveis[0] ?? null
}

export function nomeCompleto(nome: string, prefixo = "Loja"): string {
  const limpo = nome.trim().slice(0, 50)

  return limpo.includes(" ") ? limpo : `${prefixo} ${limpo}`.trim().slice(0, 50)
}

export function corpoDoCarrinho(pedido: PedidoParaEtiqueta, caixa: Pacote) {
  const d = pedido.destinatario
  const r = pedido.remetente

  return {
    from: {
      name: nomeCompleto(r.nome),
      address: r.rua.trim().slice(0, 50),
      number: apenasDigitos(r.numero).slice(0, 10),
      complement: r.complemento.trim().slice(0, 20),
      district: r.bairro.trim().slice(0, 60) || "NA",
      city: r.cidade.trim().slice(0, 50),
      state_abbr: r.estado.trim().toUpperCase(),
      postal_code: apenasDigitos(r.cep),
      document: apenasDigitos(r.documento),
      phone: apenasDigitos(r.telefone),
      email: r.email.trim(),
    },
    to: {
      name: nomeCompleto(d.nome, "Cliente"),
      address: d.rua.trim().slice(0, 50),
      number: apenasDigitos(d.numero).slice(0, 10),
      complement: d.complemento.trim().slice(0, 20),
      district: d.bairro.trim().slice(0, 50),
      city: d.cidade.trim().slice(0, 50),
      state_abbr: d.estado.trim().toUpperCase(),
      postal_code: apenasDigitos(d.cep),
      document: apenasDigitos(d.documento),
      phone: apenasDigitos(d.telefone),
      email: d.email.trim(),
    },
    service: Number(SERVICOS[pedido.servico]),
    products: pedido.produtos.map((produto) => ({
      name: produto.nome.slice(0, 100),
      quantity: Math.max(1, Math.floor(produto.quantidade)),
      unitary_value: Math.max(0, Math.round(produto.valorCentavos)) / 100,
    })),
    volumes: {
      height: Number(caixa.altura_cm),
      width: Number(caixa.largura_cm),
      length: Number(caixa.comprimento_cm),
      weight: paraQuilos(pesoTaxavel(caixa)),
    },
    options: { insurance_value: null, receipt: false, own_hand: false },
    platform: `RealValor #${pedido.numero}`,
  }
}

export function linkDeRastreio(idDaEtiqueta: string): string {
  return `https://rastreio.superfrete.com/#/tracking/${encodeURIComponent(idDaEtiqueta.trim())}`
}

export const SITUACOES_DA_ETIQUETA: Record<string, string> = {
  pending: "Aguardando pagamento",
  released: "Aguardando postagem",
  posted: "Postada",
  delivered: "Entregue",
  cancelled: "Cancelada",
}

export function situacaoDaEtiqueta(status: unknown): string {
  const chave = String(status ?? "").trim().toLowerCase()

  return SITUACOES_DA_ETIQUETA[chave] ?? "Situação desconhecida"
}

export type Chamar = <T>(args: {
  ambiente: "sandbox" | "producao"
  token: string
  caminho: string
  metodo?: "GET" | "POST" | "DELETE"
  corpo?: unknown
}) => Promise<T>

export type ConfigDoEnvio = { token: string; ambiente: "sandbox" | "producao" }

export async function emitirEtiqueta({
  pedido,
  caixa,
  config,
  chamar,
}: {
  pedido: PedidoParaEtiqueta
  caixa: Pacote
  config: ConfigDoEnvio
  chamar: Chamar
}): Promise<
  | { ok: false; status: number; mensagem: string; id?: string }
  | { ok: true; id: string; precoCentavos: number; situacao: string }
> {
  let criado: any

  try {
    criado = await chamar<any>({
      ambiente: config.ambiente,
      token: config.token,
      caminho: "/api/v0/cart",
      metodo: "POST",
      corpo: corpoDoCarrinho(pedido, caixa),
    })
  } catch (erro: any) {
    return {
      ok: false,
      status: Number(erro?.status) || 502,
      mensagem: erro?.message ?? "A SuperFrete não aceitou a etiqueta.",
    }
  }

  const id = String(criado?.id ?? "").trim()

  if (!id) {
    return {
      ok: false,
      status: 502,
      mensagem: "A SuperFrete criou a etiqueta mas não devolveu o identificador.",
    }
  }

  const precoCentavos = Math.round(Number(criado?.price) * 100) || 0

  try {
    await chamar({
      ambiente: config.ambiente,
      token: config.token,
      caminho: "/api/v0/checkout",
      metodo: "POST",
      corpo: { orders: [id] },
    })
  } catch (erro: any) {
    return {
      ok: false,
      id,
      status: Number(erro?.status) || 502,
      mensagem:
        Number(erro?.status) === 400
          ? "A etiqueta foi criada mas não foi paga: confira o saldo da carteira SuperFrete."
          : erro?.message ?? "A etiqueta foi criada mas o pagamento falhou.",
    }
  }

  return { ok: true, id, precoCentavos, situacao: "released" }
}

export async function pagarEtiqueta({
  id,
  config,
  chamar,
}: {
  id: string
  config: ConfigDoEnvio
  chamar: Chamar
}): Promise<{ ok: boolean; mensagem?: string }> {
  try {
    await chamar({
      ambiente: config.ambiente,
      token: config.token,
      caminho: "/api/v0/checkout",
      metodo: "POST",
      corpo: { orders: [id] },
    })
  } catch (erro: any) {
    return {
      ok: false,
      mensagem:
        Number(erro?.status) === 400
          ? "A carteira SuperFrete não tem saldo para pagar esta etiqueta."
          : erro?.message ?? "O pagamento da etiqueta falhou.",
    }
  }

  return { ok: true }
}

export async function urlDaEtiqueta({
  id,
  config,
  chamar,
}: {
  id: string
  config: ConfigDoEnvio
  chamar: Chamar
}): Promise<{ ok: true; url: string } | { ok: false; mensagem: string }> {
  try {
    const resposta = await chamar<any>({
      ambiente: config.ambiente,
      token: config.token,
      caminho: "/api/v0/tag/print",
      metodo: "POST",
      corpo: { orders: [id] },
    })

    const url = String(resposta?.url ?? "").trim()

    if (!url) {
      return { ok: false, mensagem: "A SuperFrete não devolveu o link da etiqueta." }
    }

    return { ok: true, url }
  } catch (erro: any) {
    return { ok: false, mensagem: erro?.message ?? "Não foi possível gerar o PDF." }
  }
}

export async function cancelarEtiqueta({
  id,
  motivo,
  config,
  chamar,
}: {
  id: string
  motivo: string
  config: ConfigDoEnvio
  chamar: Chamar
}): Promise<{ ok: true } | { ok: false; status: number; mensagem: string }> {
  try {
    await chamar({
      ambiente: config.ambiente,
      token: config.token,
      caminho: "/api/v0/order/cancel",
      metodo: "POST",
      corpo: {
        order: {
          id,
          description: motivo.trim().slice(0, 100) || "Cancelado pelo lojista",
        },
      },
    })
  } catch (erro: any) {
    return {
      ok: false,
      status: Number(erro?.status) || 502,
      mensagem: erro?.message ?? "A SuperFrete não cancelou a etiqueta.",
    }
  }

  return { ok: true }
}

export async function saldoDaCarteira({
  config,
  chamar,
}: {
  config: ConfigDoEnvio
  chamar: Chamar
}): Promise<{ ok: true; saldoCentavos: number } | { ok: false; mensagem: string }> {
  try {
    const usuario = await chamar<any>({
      ambiente: config.ambiente,
      token: config.token,
      caminho: "/api/v0/user",
      metodo: "GET",
    })

    return { ok: true, saldoCentavos: Math.round(Number(usuario?.balance) * 100) || 0 }
  } catch (erro: any) {
    return { ok: false, mensagem: erro?.message ?? "Não foi possível ler o saldo." }
  }
}

