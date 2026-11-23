"use client"

import { TruckFast } from "@medusajs/icons"
import { useState } from "react"

import {
  estadoAoConsultar,
  estadoDaResposta,
  mensagemDoEstado,
  type EstadoDoCep,
} from "@lib/checkout/cep-frete"
import { descreverOpcao } from "@lib/checkout/shipping-quote"
import { cotarNaPeca } from "@lib/data/frete"

export default function ShippingQuote({ variantId }: { variantId: string }) {
  const [digitado, setDigitado] = useState("")
  const [estado, setEstado] = useState<EstadoDoCep>({ fase: "vazio" })

  const consultar = async (evento: React.FormEvent) => {
    evento.preventDefault()

    const proximo = estadoAoConsultar(digitado)
    setEstado(proximo)

    if (proximo.fase !== "carregando") {
      return
    }

    setEstado(
      estadoDaResposta(await cotarNaPeca({ cep: proximo.cep, variantId }), proximo.cep)
    )
  }

  const linhas =
    estado.fase === "ok"
      ? estado.opcoes
          .map(descreverOpcao)
          .filter((linha): linha is string => linha !== null)
      : []

  const aviso = mensagemDoEstado(estado)

  return (
    <div className="rv-shipping-quote" data-testid="shipping-quote">
      <TruckFast aria-hidden="true" focusable="false" />

      <div className="rv-shipping-quote-text">
        <strong>Frete e prazo</strong>

        <form className="rv-shipping-quote-form" onSubmit={consultar} noValidate>
          <label className="rv-shipping-quote-label" htmlFor="cep-frete">
            CEP
          </label>

          <input
            id="cep-frete"
            data-testid="cep-frete-input"
            className="rv-shipping-quote-input"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={digitado}
            onChange={(evento) => setDigitado(evento.target.value)}
          />

          <button
            type="submit"
            data-testid="cep-frete-calcular"
            className="rv-btn rv-btn-secondary"
            disabled={estado.fase === "carregando"}
          >
            {estado.fase === "carregando" ? "Calculando…" : "Calcular"}
          </button>
        </form>

        {aviso && (
          <p
            className={
              estado.fase === "erro"
                ? "rv-shipping-quote-validation"
                : "rv-shipping-quote-aviso"
            }
            data-testid="cep-frete-aviso"
          >
            {aviso}
          </p>
        )}

        {linhas.length > 0 && (
          <ul className="rv-shipping-quote-options" data-testid="cep-frete-opcoes">
            {linhas.map((linha, posicao) => (
              <li key={posicao} className="rv-shipping-quote-result">
                {linha}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
