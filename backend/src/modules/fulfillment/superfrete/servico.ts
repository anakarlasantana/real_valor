
import { corpoDaCotacao, cepValido, lerCotacoes, type Cotacao, type Servico } from "./catalogo"

/** A mensagem não pode dizer "Correios" quando o serviço pedido é outra. */
export function semEntrega(asServicos: Servico[]): string {
  return asServicos.length === 1
    ? `Não há entrega por este serviço para este CEP e este peso.`
    : "Não há entrega para este CEP e este peso."
}
import { caixaDoEnvio } from "./etiqueta"
import { pesoTaxavel, type Pacote } from "../pacotes/pacotes"
import { PACOTES_MODULE } from "../pacotes"
import type PacotesModuleService from "../pacotes/service"
import type { ItemDoPedido } from "../pacotes/volumes"
import type { chamarSuperFrete } from "./cliente"

export type Chamar = typeof chamarSuperFrete

export type ConfigSuperFrete = { token: string; ambiente: "sandbox" | "producao" }

export const VALIDADE_CACHE_MS = 5 * 60 * 1000

const cache = new Map<string, { em: number; cotacoes: Cotacao[] }>()

export type ResultadoCotacao =
  | { ok: true; cotacoes: Cotacao[]; volumes: number; pesoGramas: number }
  | { ok: false; erro: string; status: number }


export async function cotarPedido({
  container,
  config,
  cepOrigem,
  cepDestino,
  itens,
  servicos,
  chamar,
}: {
  container: { resolve: (chave: string) => unknown }
  config: ConfigSuperFrete
  cepOrigem: string
  cepDestino: string
  itens: ItemDoPedido[]
  servicos: Servico[]
  // Injetável: o teste não toca a rede.
  chamar: typeof chamarSuperFrete
}): Promise<ResultadoCotacao> {
  if (!cepValido(cepOrigem)) {
    return {
      ok: false,
      status: 422,
      erro: "O CEP de origem não está configurado. Configure o endereço do centro de distribuição.",
    }
  }

  if (!cepValido(cepDestino)) {
    return { ok: false, status: 400, erro: "Informe um CEP de destino válido." }
  }

  const pacotes = container.resolve(PACOTES_MODULE) as PacotesModuleService
  const calculo = await pacotes.volumesDoPedido(itens)

  if (!calculo.ok) {
    return { ok: false, status: 422, erro: calculo.motivo }
  }

  const volume = calculo.volumes[0]
  const chave = JSON.stringify([cepOrigem, cepDestino, volume, servicos])
  const guardado = cache.get(chave)

  if (guardado && Date.now() - guardado.em < VALIDADE_CACHE_MS) {
    return {
      ok: true,
      cotacoes: guardado.cotacoes,
      volumes: calculo.volumes.length,
      pesoGramas: calculo.pesoGramas,
    }
  }

  let resposta: unknown

  try {
    resposta = await chamar({
      ambiente: config.ambiente,
      token: config.token,
      caminho: "/api/v0/calculator",
      metodo: "POST",
      corpo: corpoDaCotacao({ cepOrigem, cepDestino, volume, servicos }),
    })
  } catch (erro: any) {
    // A falha não entra no cache: um 5xx não pode ficar grudado por 5 min.
    return {
      ok: false,
      status: Number(erro?.status) || 502,
      erro: erro?.message ?? "O cálculo de frete falhou.",
    }
  }

  const cotacoes = lerCotacoes(resposta)

  if (cotacoes.length === 0) {
    return {
      ok: false,
      status: 422,
      erro: semEntrega(servicos),
    }
  }

  // Cada caixa é cobrada: o total, senão o checkout mostra metade.
  const total = cotacoes.map((cotacao) => ({
    ...cotacao,
    preco: cotacao.preco * calculo.volumes.length,
  }))

  cache.set(chave, { em: Date.now(), cotacoes: total })

  return {
    ok: true,
    cotacoes: total,
    volumes: calculo.volumes.length,
    pesoGramas: calculo.pesoGramas,
  }
}


/** A cotação de teste: a mesma caixa padrão do checkout, sem cache e sem gravar nada. */
export async function testarCotacao({
  config,
  cepOrigem,
  cepDestino,
  caixas,
  servicos,
  chamar,
}: {
  config: ConfigSuperFrete
  cepOrigem: string
  cepDestino: string
  caixas: Pacote[]
  servicos: Servico[]
  chamar: Chamar
}): Promise<ResultadoCotacao> {
  if (!cepValido(cepOrigem)) {
    return {
      ok: false,
      status: 422,
      erro:
        "O CEP de origem não está configurado. Configure o endereço do centro de distribuição.",
    }
  }

  if (!cepValido(cepDestino)) {
    return { ok: false, status: 400, erro: "Informe um CEP de destino válido." }
  }

  const caixa = caixaDoEnvio(caixas)

  if (!caixa) {
    return { ok: false, status: 422, erro: "Nenhuma caixa ativa e válida para cotar." }
  }

  const volume = {
    peso_gramas: pesoTaxavel(caixa),
    altura_cm: caixa.altura_cm,
    largura_cm: caixa.largura_cm,
    comprimento_cm: caixa.comprimento_cm,
  }

  try {
    const resposta = await chamar({
      ambiente: config.ambiente,
      token: config.token,
      caminho: "/api/v0/calculator",
      metodo: "POST",
      corpo: corpoDaCotacao({ cepOrigem, cepDestino, volume, servicos }),
    })
    const cotacoes = lerCotacoes(resposta)

    if (cotacoes.length === 0) {
      return {
        ok: false,
        status: 422,
        erro: semEntrega(servicos),
      }
    }

    return { ok: true, cotacoes, volumes: 1, pesoGramas: volume.peso_gramas }
  } catch (erro: any) {
    return {
      ok: false,
      status: Number(erro?.status) || 502,
      erro: erro?.message ?? "O cálculo de frete falhou.",
    }
  }
}


export function limparCache(): void {
  cache.clear()
}
