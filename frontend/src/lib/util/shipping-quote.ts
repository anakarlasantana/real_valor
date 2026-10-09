/**
 * O CEP e as opções de entrega da página da peça.
 * -------------------------------------------------------------------------
 * A referência desenha, abaixo do botão de comprar, uma caixa com um campo de CEP
 * e um botão "Calcular" que responde **"Entrega padrão · 3 a 5 dias úteis ·
 * Grátis" para qualquer CEP digitado**. Isso não é um cálculo: é uma promessa por
 * escrito, e é a razão de a página da peça não ter esse campo hoje.
 *
 * O que este módulo faz é separar as duas metades dessa caixa:
 *
 *   1. **regra** — o que conta como um CEP digitável, como ele se escreve e como
 *      uma opção de entrega vira uma linha de texto. É o que está aqui, e o que se
 *      testa sem renderizar nada;
 *   2. **dado** — o prazo e o preço de cada modalidade, que são das opções de frete
 *      da região (backend). Sem eles, o componente devolve `null` e a caixa não
 *      existe. O campo que responde sempre é pior do que campo nenhum.
 *
 * O **prazo em palavras** ("3 a 5 dias úteis") é o que a loja escreve na opção de
 * entrega; o que a tabela de frete dá é preço por região e peso, sem prazo. Uma
 * modalidade sem prazo continua entrando na linha — sem a parte do meio.
 */
import { convertToLocale } from "./money"

/** Uma modalidade de entrega com preço calculado, como o backend a devolve. */
export type OpcaoDeEntrega = {
  /** O nome da modalidade ("Entrega padrão", "Retirada na loja"). */
  titulo: string
  /** O prazo em palavras ("3 a 5 dias úteis"), quando a loja souber. */
  prazo?: string | null
  /**
   * O preço **em reais**, como o resto da loja (`calculated_amount`). `0` é frete
   * grátis, e `null` é uma modalidade que não fala de preço (a retirada, por
   * exemplo) — as duas coisas são diferentes, e a linha as escreve diferentes.
   */
  preco?: number | null
  /** A moeda do preço, para o `convertToLocale`. Sem ela, não há preço a mostrar. */
  moeda?: string | null
}

/** Os oito dígitos de um CEP: `00000-000`. */
export const CEP_DIGITOS = 8

/**
 * Só os dígitos do que a cliente digitou (ou colou), no máximo oito.
 *
 * É o que permite aceitar as três formas que chegam: "01310100", "01310-100" e
 * "01310 100" — as duas últimas são como o CEP é escrito no Brasil, e recusá-las
 * seria pedir que a cliente traduzisse o endereço dela. O corte em oito descarta o
 * que sobrar de uma colagem (um CEP com o número do imóvel junto).
 */
export function normalizarCep(valor: string | null | undefined): string {
  if (typeof valor !== "string") {
    return ""
  }

  return valor.replace(/\D/g, "").slice(0, CEP_DIGITOS)
}

/** O CEP está completo? */
export function cepValido(valor: string | null | undefined): boolean {
  return normalizarCep(valor).length === CEP_DIGITOS
}

/**
 * O CEP escrito como o Brasil o escreve: "01310100" → "01310-100".
 *
 * `null` enquanto o CEP não estiver completo — um "0131-0" no meio da digitação é
 * pior do que nada, e quem chama precisa distinguir "ainda não dá" de "já dá".
 */
export function formatarCep(valor: string | null | undefined): string | null {
  const digitos = normalizarCep(valor)

  if (digitos.length !== CEP_DIGITOS) {
    return null
  }

  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`
}

/**
 * Uma modalidade de entrega em uma linha: "Entrega padrão · 3 a 5 dias úteis ·
 * Grátis".
 *
 * O separador é o `·` do resto da loja, e cada parte só entra se ela existir — a
 * modalidade sem prazo não fica com um separador solto. `null` quando não há
 * título: uma linha começando por "·" não diz nada.
 *
 * Preço zerado é **"Grátis"**, e não "R$ 0,00": é como a loja fala, e é o que a
 * referência escreve. E ele vale mesmo sem a moeda declarada — zero não é valor
 * monetário, é a informação de que o frete é grátis. Preço **com** valor e sem
 * moeda é omitido: o `convertToLocale` devolveria o número cru, e "24.9" não é
 * preço.
 */
export function descreverOpcao(opcao: OpcaoDeEntrega): string | null {
  const titulo = (opcao?.titulo ?? "").trim()

  if (titulo === "") {
    return null
  }

  const prazo = (opcao.prazo ?? "").trim()

  const preco =
    opcao.preco === 0
      ? "Grátis"
      : opcao.preco !== null && opcao.preco !== undefined && opcao.moeda
        ? formatarPreco(opcao.preco, opcao.moeda)
        : ""

  return [titulo, prazo, preco].filter((parte) => parte !== "").join(" · ")
}

/**
 * O preço da modalidade, no formato da loja — a mesma função de dinheiro do resto
 * do storefront. Preço inválido (não numérico) não vira parte da linha.
 */
function formatarPreco(preco: number, moeda: string): string {
  if (!Number.isFinite(preco) || preco < 0) {
    return ""
  }

  return convertToLocale({ amount: preco, currency_code: moeda })
}
