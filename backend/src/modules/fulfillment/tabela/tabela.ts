/**
 * A tabela de frete da Real Valor.
 * -------------------------------------------------------------------------
 * **Os números aqui são FICTÍCIOS.** São valores de exemplo, escolhidos
 * apenas para deixar o cálculo verificável de ponta a ponta antes de existir
 * transportadora escolhida. Trocá-los é uma edição deste arquivo — nada mais
 * em nenhum outro lugar precisa mudar, porque é o único lugar onde a regra
 * comercial está escrita.
 *
 * A regra é "peso × região", que é a forma que qualquer transportadora
 * brasileira usa de algum jeito: quase todas tarifam por faixa de peso e por
 * região de destino. Escolher isso agora é o que permite validar a
 * arquitetura antes da decisão comercial.
 *
 * **Por que um arquivo só, sem provider.** O cálculo é função pura sobre
 * números — é o que se quer testar sem banco, sem Medusa e sem carrinho. O
 * provider (`service.ts`) só traduz a entrada do Medusa para esta função e a
 * saída de volta. Separar as duas coisas é o que faz a regra poder ser testada
 * e conferida contra a transportadora escolhida quando ela vier.
 *
 * **Em centavos.** O Medusa trabalha em centavos, e um erro de unidade aqui é
 * um frete 100× errado — a classe de erro mais difícil de enxergar numa tela.
 */

/** As regiões de destino que a tabela cobre. */
export const REGIOES = [
  "sudeste",
  "sul",
  "centro-oeste",
  "nordeste",
  "norte",
] as const

export type Regiao = (typeof REGIOES)[number]

/** Faixas de peso, em gramas. A última é o "ou mais". */
export const FAIXAS_PESO = [
  { ate: 500, nome: "Até 500g" },
  { ate: 1000, nome: "Até 1kg" },
  { ate: 2000, nome: "Até 2kg" },
  { ate: 5000, nome: "Até 5kg" },
  { ate: Infinity, nome: "Acima de 5kg" },
] as const

/**
 * O preço em centavos por (região, faixa de peso).
 *
 * ⚠️ **VALORES FICTÍCIOS.** Foi feito para parecer uma tabela de transportadora
 * real — da ordem de grandeza certa, arredondada de meio em meio real — mas
 * **não é preço de ninguém**. Estão marcados para não sobrar dúvida.
 */
export const TABELA: Record<Regiao, Record<string, number>> = {
  sudeste: { "500": 1690, "1000": 2190, "2000": 2890, "5000": 4290, infty: 5990 },
  sul: { "500": 1990, "1000": 2590, "2000": 3390, "5000": 4990, infty: 6990 },
  "centro-oeste": {
    "500": 2190,
    "1000": 2890,
    "2000": 3790,
    "5000": 5490,
    infty: 7690,
  },
  nordeste: {
    "500": 2590,
    "1000": 3390,
    "2000": 4490,
    "5000": 6490,
    infty: 8990,
  },
  norte: { "500": 2990, "1000": 3890, "2000": 5190, "5000": 7490, infty: 10490 },
}

/** Acima disto não há tabela: uma encomenda desse peso precisa de negociação. */
export const PESO_MAXIMO_GRAMAS = 20_000

/**
 * A região de destino, pelo **primeiro dígito do CEP**.
 *
 * É a regra dos Correios e a que as transportadoras brasileiras seguem: o
 * primeiro dígito do CEP é a faixa geográfica do endereço. Não existe a região
 * do Medusa para isso — o carrinho só entrega `country_code`, e o CEP é o que
 * está no endereço da cliente.
 *
 * @param cep sem máscara ("01310100") ou com ("01310-100").
 */
export function regiaoDoCep(cep: string): Regiao {
  const primeiro = String(cep ?? "").replace(/\D/g, "").charAt(0)

  // 0-2: SP, RJ/ES, MG — Sudeste.
  if (primeiro >= "0" && primeiro <= "2") {
    return "sudeste"
  }

  // 3-4: PR/SC, RS — Sul.
  if (primeiro === "3" || primeiro === "4") {
    return "sul"
  }

  // 5-6: Nordeste.
  if (primeiro === "5" || primeiro === "6") {
    return "nordeste"
  }

  // 8-9: Norte (AM, PA, RO, AC, RR...).
  if (primeiro === "8" || primeiro === "9") {
    return "norte"
  }

  /**
   * O 7 é a **colisão conhecida** do método: ele cobre BA e SE (Nordeste),
   * mas também GO, MT, MS e DF (Centro-Oeste) — nenhum outro dígito separa
   * os dois.
   *
   * Escolher Nordeste para o 7 é uma simplificação **declarada**, e não um
   * esquecimento: a alternativa é uma tabela de faixas de CEP de duas casas,
   * que é o que a transportadora escolhida vai fornecer de qualquer jeito.
   * Para os valores fictícios, tratar o 7 como Nordeste é suficiente — e o
   * ponto de troca fica isolado nesta função.
   */
  return "nordeste"
}
/**
 * A faixa de peso, e a chave dela na tabela.
 *
 * Peso **zero ou ausente** cai na primeira faixa: um produto sem peso
 * cadastrado não pode custar mais que um leve — e a faixa mais barata é
 * também a mais honesta para "não sabemos".
 */
export function faixaDoPeso(pesoGramas: number): {
  nome: string
  chave: string
} {
  const peso = Number.isFinite(pesoGramas) && pesoGramas > 0 ? pesoGramas : 0

  for (const faixa of FAIXAS_PESO) {
    if (peso <= faixa.ate) {
      return {
        nome: faixa.nome,
        chave: faixa.ate === Infinity ? "infty" : String(faixa.ate),
      }
    }
  }

  const ultima = FAIXAS_PESO[FAIXAS_PESO.length - 1]
  return { nome: ultima.nome, chave: "infty" }
}

/** O que a tabela sabe responder, e o que não sabe. */
export type ResultadoTabela =
  | {
      ok: true
      preco: number
      regiao: Regiao
      faixa: string
      pesoGramas: number
    }
  | { ok: false; motivo: string }

/**
 * O preço do frete para um CEP e um peso.
 *
 * Devolve um resultado **explícito** em vez de lançar: o provider (ou o
 * chamador) transforma o motivo em mensagem, e é essa mensagem que a cliente
 * vê. Um `throw` aqui viraria 500 no checkout por um CEP mal digitado — a
 * forma mais cara de dizer "faltou um número".
 */
export function calcularFrete(
  cep: string,
  pesoGramas: number
): ResultadoTabela {
  const digitos = String(cep ?? "").replace(/\D/g, "")

  if (digitos.length !== 8) {
    return { ok: false, motivo: "Informe um CEP com 8 dígitos." }
  }

  const peso =
    Number.isFinite(pesoGramas) && pesoGramas > 0 ? pesoGramas : 0

  if (peso > PESO_MAXIMO_GRAMAS) {
    // Acima do limite a tabela não vale: o preço real depende de volume e
    // negotiated. Falhar é melhor que devolver um número que não será cobrado.
    return {
      ok: false,
      motivo: `O peso de ${peso}g excede o limite de ${PESO_MAXIMO_GRAMAS}g. Fale com a gente para este envio.`,
    }
  }

  const regiao = regiaoDoCep(cep)
  const faixa = faixaDoPeso(peso)
  const preco = TABELA[regiao]?.[faixa.chave]

  if (typeof preco !== "number") {
    return { ok: false, motivo: "Não temos cobertura para este destino." }
  }

  return {
    ok: true,
    preco,
    regiao,
    faixa: faixa.nome,
    pesoGramas: peso,
  }
}
