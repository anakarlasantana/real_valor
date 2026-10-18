/** Só Correios; as outras transportadoras são outra decisão. */
export const SERVICOS = {
  PAC: "1",
  SEDEX: "2",
  MINI: "17",
} as const

export type Servico = keyof typeof SERVICOS


export const ROTULOS: Record<Servico, string> = {
  PAC: "PAC",
  SEDEX: "SEDEX",
  MINI: "Mini Envios",
}

const POR_CODIGO: Record<string, Servico> = {
  "1": "PAC",
  "2": "SEDEX",
  "17": "MINI",
}

/** `preco` em centavos, `prazo` em dias úteis. */
export type Cotacao = {
  servico: Servico
  nome: string
  preco: number
  prazo: number
}

/** 3 casas: sem isso, 0,3 kg sai 0.30000000000000004 no log. */
export function paraQuilos(gramas: number): number {
  return Math.round(Number(gramas) / 1000 * 1000) / 1000
}

/** Centavos: onde o erro de 100× mora. */
export function paraCentavos(reais: number | string): number {
  return Math.round(Number(reais) * 100)
}

/** O corpo do `POST /api/v0/calculator`. */
export function corpoDaCotacao({
  cepOrigem,
  cepDestino,
  volume,
  servicos,
}: {
  cepOrigem: string
  cepDestino: string
  volume: { peso_gramas: number; altura_cm: number; largura_cm: number; comprimento_cm: number }
  servicos: Servico[]
}) {
  return {
    from: { postal_code: apenasDigitos(cepOrigem) },
    to: { postal_code: apenasDigitos(cepDestino) },
    services: servicos.map((servico) => SERVICOS[servico]).join(","),
    options: {
      own_hand: false,
      receipt: false,
      insurance_value: 0,
      use_insurance_value: false,
    },
    package: {
      height: Number(volume.altura_cm),
      width: Number(volume.largura_cm),
      length: Number(volume.comprimento_cm),
      weight: paraQuilos(volume.peso_gramas),
    },
  }
}


export function apenasDigitos(valor: unknown): string {
  return String(valor ?? "").replace(/\D/g, "")
}


export function cepValido(valor: unknown): boolean {
  const digitos = apenasDigitos(valor)

  return digitos.length === 8 && !/^0+$/.test(digitos)
}

/** `has_error` sai mesmo com preço: seria frete grátis que não existe. */
export function lerCotacoes(resposta: unknown): Cotacao[] {
  if (!Array.isArray(resposta)) {
    return []
  }

  return resposta.flatMap((entrada) => {
    const item = entrada as Record<string, any>
    const servico = POR_CODIGO[String(item?.id)]

    if (!servico || item?.has_error) {
      return []
    }

    const preco = paraCentavos(item.price)
    const prazo = Number(item.delivery_time)

    if (!Number.isFinite(preco) || preco <= 0) {
      return []
    }

    return [
      {
        servico,
        nome: ROTULOS[servico],
        preco,
        prazo: Number.isFinite(prazo) && prazo > 0 ? prazo : 0,
      },
    ]
  })
}


export function textoDoPrazo(dias: number): string {
  if (!dias || dias <= 0) {
    return "prazo a confirmar"
  }

  return `até ${dias} ${dias === 1 ? "dia útil" : "dias úteis"}`
}
