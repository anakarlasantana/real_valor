

import {
  caixaValida,
  padraoUnico,
  pesoTaxavel,
  type Pacote,
} from "./pacotes"


export type ItemDoPedido = {
  quantidade: number
  peso_gramas?: number | null
}


export type Volume = {
  peso_gramas: number
  altura_cm: number
  largura_cm: number
  comprimento_cm: number
  caixa: string
}

export type CalculoDeVolumes =
  | { ok: true; volumes: Volume[]; pesoGramas: number }
  | { ok: false; motivo: string }

// Cada item ocupa a menor caixa que cabe nele; o peso é o taxável da caixa.
export function calcularVolumes(
  itens: ItemDoPedido[],
  pacotes: Pacote[]
): CalculoDeVolumes {
  const elegiveis = (pacotes || [])
    .filter((pacote) => pacote?.ativo)
    .filter(caixaValida)
    .sort((a, b) => a.peso_gramas - b.peso_gramas)

  if (elegiveis.length === 0) {
    return {
      ok: false,
      motivo: "Nenhuma caixa ativa serve para os Correios. Confira os pacotes.",
    }
  }

  const padrao = padraoUnico(elegiveis) ?? elegiveis[0]
  const volumes: Volume[] = []

  for (const item of itens || []) {
    const quantidade = Math.floor(Number(item?.quantidade) || 0)

    if (quantidade <= 0) {
      continue
    }

    const pesoDaVariante = Number(item?.peso_gramas)
    const porPeso =
      Number.isFinite(pesoDaVariante) && pesoDaVariante > 0
        ? elegiveis.find((pacote) => pacote.peso_gramas >= pesoDaVariante)
        : undefined
    const caixa = porPeso ?? padrao

    for (let i = 0; i < quantidade; i++) {
      volumes.push({
        peso_gramas: pesoTaxavel(caixa),
        altura_cm: caixa.altura_cm,
        largura_cm: caixa.largura_cm,
        comprimento_cm: caixa.comprimento_cm,
        caixa: caixa.nome,
      })
    }
  }

  if (volumes.length === 0) {
    return { ok: false, motivo: "O pedido não tem itens para enviar." }
  }

  return {
    ok: true,
    volumes,
    pesoGramas: volumes.reduce((soma, volume) => soma + volume.peso_gramas, 0),
  }
}
