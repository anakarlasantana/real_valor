import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceContext,
  CreateFulfillmentResult,
  CreateShippingOptionDTO,
  FulfillmentOption,
} from "@medusajs/types"

import { REGIOES, calcularFrete, type Regiao } from "./tabela"

/**
 * O provider de frete "tabela".
 * -------------------------------------------------------------------------
 * O **primeiro** provider de frete de verdade da loja: ele calcula o preço
 * por peso × região, sem depender de transportadora nenhuma. Existe por dois
 * motivos ao mesmo tempo:
 *
 * **1. Entrega frete automático agora.** Hoje o seed cria PAC e SEDEX com preço
 * fixo, que não olha o peso da peça nem o destino — duas roupas e um sofá
 * saem pelo mesmo valor. Com este provider, o preço acompanha o pedido.
 *
 * **2. Prova que a arquitetura de plug-in funciona, antes de existir
 * transportadora.** O Medusa chama `calculatePrice` deste provider, e o
 * carrinho mostra o resultado. Quando a transportadora for escolhida, ela
 * entra como **outro** provider, ao lado deste — e nenhum consumidor (carrinho,
 * checkout, painel de envio, página de rastreio) muda.
 *
 * **Os números são fictícios** e estão em `tabela.ts`. Trocá-los é uma edição
 * naquele arquivo e nada mais.
 *
 * **Por que este arquivo é quase todo tradução.** Ele não decide preço: quem
 * decide é `calcularFrete`. Aqui só há o trabalho de mudar a forma que o
 * Medusa entrega na forma que a tabela entende — e vice-versa. É essa separação
 * que permite conferir a regra contra a transportadora real depois, sem nada
 * mais mudar.
 */
export class TabelaFulfillmentService extends AbstractFulfillmentProviderService {
  protected logger_: { info: Function; warn: Function }

  constructor({ logger }: { logger: any }) {
    super()
    this.logger_ = logger
  }

  /**
   * As opções que este provider oferece, para o Admin criar a shipping
   * option.
   *
   * Cada `id` aqui vira uma opção selecionável no Admin. A lista é
   * **curta** de propósito: ela é a escolha da loja, não o leque da
   * transportadora — e opções demais na vitrine confundem a cliente.
   */
  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [{ id: "tabela-nacional", name: "Entrega nacional — tabela" }]
  }

  /**
   * Este provider **calcula** preço. É o que faz o Medusa usar o
   * `/store/shipping-options/:id/calculate` em vez de ler um valor fixo.
   *
   * O `manual`, que é o que roda hoje, devolve `false` aqui — e é por isso
   * que as opções dele são preço fixo.
   */
  async canCalculate(_data: CreateShippingOptionDTO): Promise<boolean> {
    return true
  }

  /**
   * O preço, em centavos.
   *
   * O que entra:
   *  - `context.shipping_address` — de onde vem o **CEP** (o Medusa não
   *    entrega a região, e o CEP é o que decide o destino);
   *  - `context.items[].variant.weight` — em **gramas**, e por item: a
   *    quantidade multiplica.
   *
   * O que sai: `calculated_amount` e se o preço já tem imposto. A loja mostra
   * o valor final, então o preço sai **sem** imposto — o Medusa soma o que
   * falta.
   */
  async calculatePrice(
    _optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: CalculateShippingOptionPriceContext
  ): Promise<CalculatedShippingOptionPrice> {
    const cep = context?.shipping_address?.postal_code ?? ""
    const peso = pesoDoCarrinho(context)

    const resultado = calcularFrete(cep, peso)

    if (!resultado.ok) {
      // Registrar e devolver 0 **não** é opção: 0 é um frete grátis, e a
      // loja perderia dinheiro em toda consulta que falhasse. O `throw` tira
      // a opção da lista, que é o comportamento honesto para um destino que
      // não atendemos.
      this.logger_.warn(
        `[tabela] frete indisponível: ${resultado.motivo} (cep=${cep}, peso=${peso}g)`
      )

      throw new Error(resultado.motivo)
    }

    this.logger_.info(
      `[tabela] ${cep} · ${resultado.pesoGramas}g · ${resultado.regiao} · ${resultado.faixa} = ${resultado.preco}`
    )

    return {
      calculated_amount: resultado.preco,
      is_calculated_price_tax_inclusive: false,
    }
  }

  /** A opção é válida se a região existir na tabela. */
  async validateOption(data: Record<string, any>): Promise<boolean> {
    const regiao = data?.region as Regiao | undefined
    return !regiao || (REGIOES as readonly string[]).includes(regiao)
  }

  async validateFulfillmentData(
    _optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: unknown
  ): Promise<any> {
    return data
  }

  /**
   * Despachar o pedido.
   *
   * Devolve `{ data: {}, labels: [] }` — **sem etiqueta de rastreio** — e isso
   * é deliberado: uma etiqueta aqui viria em PDF de uma transportadora que a
   * loja ainda não tem. O código de rastreio entra pelo painel de envio
   * (RV-043), que é genérico e não depende de transportadora.
   */
  async createFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }

  async cancelFulfillment(): Promise<any> {
    return {}
  }

  async createReturnFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }
}

/** A soma dos pesos do carrinho, em gramas. */
function pesoDoCarrinho(context: CalculateShippingOptionPriceContext): number {
  const itens = context?.items ?? []

  return itens.reduce(
    (total: number, item: any) =>
      total +
      (Number(item?.variant?.weight) || 0) * (Number(item?.quantity) || 0),
    0
  )
}

/** O identificador com que o provider é resolvido no container do Medusa. */
TabelaFulfillmentService.identifier = "tabela"

export default TabelaFulfillmentService