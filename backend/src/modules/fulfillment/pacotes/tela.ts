/** A caixa no formato da tela: o peso taxável vem calculado, a tela não repete a conta. */

import { pesoTaxavel } from "./pacotes"

export function caixaParaTela(pacote: Record<string, any>) {
  return {
    id: pacote.id,
    nome: pacote.nome,
    peso_gramas: pacote.peso_gramas,
    altura_cm: pacote.altura_cm,
    largura_cm: pacote.largura_cm,
    comprimento_cm: pacote.comprimento_cm,
    pesoTaxavel: pesoTaxavel(pacote as any),
    padrao: Boolean(pacote.padrao),
    ativo: Boolean(pacote.ativo),
  }
}
