import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceContext,
  CreateFulfillmentResult,
  CreateShippingOptionDTO,
  FulfillmentOption,
} from "@medusajs/types"

import { caixaValida, padraoUnico, pesoTaxavel, type Pacote } from "../pacotes/pacotes"
import { calcularVolumes } from "../pacotes/volumes"
import { cotarPedido, type ConfigSuperFrete } from "./servico"
import { SERVICOS, ROTULOS, ehServico, type Servico } from "./catalogo"
import { ambienteDaConfig, chamarSuperFrete } from "./cliente"


type OpcoesDoServico = { servico?: Servico }

export class SuperFreteFulfillmentService extends AbstractFulfillmentProviderService {
  protected logger_: any
  protected manager_: any
  protected config_: ConfigSuperFrete


  constructor({ logger, manager }: { logger?: any; manager?: any }) {
    super()
    this.logger_ = logger
    this.manager_ = manager
    this.config_ = {
      token: process.env.SUPERFRETE_TOKEN ?? "",
      ambiente: ambienteDaConfig(process.env.SUPERFRETE_AMBIENTE),
    }
  }


  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return (Object.keys(SERVICOS) as Servico[]).map((servico) => ({
      id: servico,
      name: ROTULOS[servico],
    }))
  }

  async canCalculate(_data: CreateShippingOptionDTO): Promise<boolean> {
    return true
  }

  /** Em centavos. `throw` e nunca `0`: zero é frete grátis em toda falha. */
  async calculatePrice(
    optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: CalculateShippingOptionPriceContext
  ): Promise<CalculatedShippingOptionPrice> {
    const servico = (optionData as OpcoesDoServico)?.servico

    if (!servico || !ehServico(servico)) {
      throw new Error("A opção de frete não diz qual serviço de entrega ela é.")
    }

    const cepOrigem = this.cepDeOrigem(context)
    const itens = (context?.items ?? []).map((item: any) => ({
      quantidade: Number(item?.quantity) || 0,
      peso_gramas: item?.variant?.weight ?? null,
    }))

    const resultado = await cotarPedido({
      container: {
        resolve: () => ({
          volumesDoPedido: async (itens: any[]) =>
            calcularVolumes(itens, await this.caixas()),
        }),
      },
      config: this.config_,
      cepOrigem,
      cepDestino: String(context?.shipping_address?.postal_code ?? ""),
      itens,
      servicos: [servico],
      chamar: chamarSuperFrete,
    })

    if (!resultado.ok) {
      this.logger_.warn(`[superfrete] ${servico}: ${resultado.erro}`)
      throw new Error(resultado.erro)
    }

    const escolhida = resultado.cotacoes.find((c) => c.servico === servico)

    if (!escolhida) {
      throw new Error("O SuperFrete não cotou este serviço para o destino.")
    }

    return {
      calculated_amount: escolhida.preco,
      is_calculated_price_tax_inclusive: false,
    }
  }

  /** Lidas direto do banco: o provider não resolve módulos nem tem a query. */
  private async caixas(): Promise<Pacote[]> {
    if (!this.manager_) {
      throw new Error(
        "O provider do SuperFrete não recebeu o banco: não há como ler as caixas de envio."
      )
    }

    const linhas = await this.manager_.execute(
      `select "id", "nome", "peso_gramas", "altura_cm", "largura_cm", "comprimento_cm", "padrao", "ativo"
         from "pacote" where "ativo" = true and "deleted_at" is null
        order by "padrao" desc, "peso_gramas" asc`
    )

    return (linhas ?? []) as Pacote[]
  }

  async validateOption(data: Record<string, any>): Promise<boolean> {
    return !data?.servico || ehServico(data.servico)
  }

  async validateFulfillmentData(
    _optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: unknown
  ): Promise<any> {
    return data
  }


  async createFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }

  async cancelFulfillment(): Promise<any> {
    return {}
  }

  async createReturnFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }

  private cepDeOrigem(
    context: CalculateShippingOptionPriceContext
  ): string {
    return String((context as any)?.from_location?.address?.postal_code ?? "")
  }
}

SuperFreteFulfillmentService.identifier = "superfrete"

export default SuperFreteFulfillmentService
