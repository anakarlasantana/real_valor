import { TruckFast } from "@medusajs/icons"

import {
  descreverOpcao,
  formatarCep,
  type OpcaoDeEntrega,
} from "@lib/util/shipping-quote"

/**
 * A caixa de frete e prazo da página da peça — "Entrega padrão · 3 a 5 dias úteis
 * · Grátis", abaixo do botão de comprar.
 *
 * **O que a referência desenha aqui é um campo de CEP que responde sempre.** Ela
 * pede o CEP, e para qualquer CEP digitado escreve "3 a 5 dias úteis, grátis". Isso
 * não é cálculo: é a loja prometendo prazo e preço que ela não conferiu, e é a
 * razão de este bloco não ter sido portado antes.
 *
 * Aqui ele é **o contrário**: a caixa só existe com **opção de entrega real** — a
 * lista que o backend calcula para o CEP informado, com prazo e preço da região —,
 * e sem ela o componente devolve `null`. O que se desenha não é um convite a
 * digitar: é a resposta.
 *
 *   - **`opcoes` é o dado**, e é ele que liga a caixa (uma linha por modalidade,
 *     escrita por `descreverOpcao`, com teste);
 *   - **`cep` é contexto**, e só entra na frase quando ele é um CEP de verdade
 *     (`formatarCep` devolve `null` para meio CEP) — a caixa também descreve uma
 *     entrega já calculada, sem o número à vista.
 *
 * O campo de CEP em si (`rv-shipping-quote-row`, `rv-shipping-quote-validation`)
 * está desenhado no `brand.css` e entra com a ilha de cliente do próximo lote, que
 * é quem tem o estado da digitação. Enquanto ela não existe, o campo não é
 * desenhado: um campo que não calcula nada é pior do que campo nenhum.
 */
export default function ShippingQuote({
  cep,
  opcoes,
}: {
  /** O CEP consultado, como a cliente digitou. Só aparece se estiver completo. */
  cep?: string | null
  /** As modalidades calculadas para esse CEP. Sem elas, a caixa não existe. */
  opcoes?: OpcaoDeEntrega[] | null
}) {
  const linhas = (opcoes ?? [])
    .map((opcao) => descreverOpcao(opcao))
    .filter((linha): linha is string => linha !== null)

  if (linhas.length === 0) {
    return null
  }

  const cepFormatado = formatarCep(cep)

  return (
    <div className="rv-shipping-quote" data-testid="shipping-quote">
      <TruckFast aria-hidden="true" focusable="false" />

      <div className="rv-shipping-quote-text">
        <strong>Frete e prazo</strong>

        <span>
          {cepFormatado
            ? `Opções de entrega para o CEP ${cepFormatado}`
            : "Opções de entrega disponíveis"}
        </span>

        <ul className="rv-shipping-quote-options">
          {linhas.map((linha, posicao) => (
            <li key={posicao} className="rv-shipping-quote-result">
              {linha}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
