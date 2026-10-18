/** A leitura do corpo de um pacote, compartilhada por POST e PUT. */

import { problemasDaCaixa } from "../../../../modules/fulfillment/pacotes/pacotes"

export function lerCaixa(corpo: Record<string, any>) {
  const problemas = problemasDaCaixa(corpo as any)

  if (problemas.length > 0) {
    return { ok: false as const, problemas }
  }

  if (!String(corpo.nome ?? "").trim()) {
    return { ok: false as const, problemas: ["Dê um nome à caixa."] }
  }

  return {
    ok: true as const,
    caixa: {
      nome: String(corpo.nome).trim(),
      peso_gramas: Number(corpo.peso_gramas),
      altura_cm: Number(corpo.altura_cm),
      largura_cm: Number(corpo.largura_cm),
      comprimento_cm: Number(corpo.comprimento_cm),
      padrao: Boolean(corpo.padrao),
      ativo: corpo.ativo === undefined ? true : Boolean(corpo.ativo),
    },
  }
}
