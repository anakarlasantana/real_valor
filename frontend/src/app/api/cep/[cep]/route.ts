/**
 * Proxy de CEP: o ViaCEP não manda `Access-Control-Allow-Origin`, então o
 * navegador bloqueia a resposta cross-origin e o `fetch` falha em silêncio.
 * Aqui a consulta roda no servidor e volta no formato de `ResultadoCep`.
 */
import { NextResponse } from "next/server"

import { apenasDigitos, CEP_DIGITOS } from "@rv/contrato"
import type { EnderecoDoCep, ResultadoCep } from "@rv/contrato"

const VIACEP = "https://viacep.com.br/ws"
const BRASILAPI = "https://brasilapi.com.br/api/cep/v2"

/** Curto: não pode segurar o campo. */
const TIMEOUT_CEP_MS = 2500

type Ler = (corpo: unknown) => ResultadoCep | "fora"

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : ""
}

async function consultar(
  url: string,
  ler: Ler
): Promise<ResultadoCep | "fora"> {
  const controle = new AbortController()
  const prazo = setTimeout(() => controle.abort(), TIMEOUT_CEP_MS)

  try {
    const resposta = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controle.signal,
    })

    if (resposta.status === 404) {
      return { encontrado: false, motivo: "cep-inexistente" }
    }

    if (!resposta.ok) return "fora"

    return ler(await resposta.json())
  } catch {
    return "fora"
  } finally {
    clearTimeout(prazo)
  }
}

function doViaCep(corpo: unknown): ResultadoCep | "fora" {
  if (!corpo || typeof corpo !== "object") return "fora"

  const dados = corpo as Record<string, unknown>

  if (dados.erro === true || dados.erro === "true") {
    return { encontrado: false, motivo: "cep-inexistente" }
  }

  const estado = texto(dados.uf).toUpperCase()
  const cidade = texto(dados.localidade)

  if (!estado && !cidade) return "fora"

  const endereco: EnderecoDoCep = {
    logradouro: texto(dados.logradouro),
    bairro: texto(dados.bairro),
    cidade,
    estado,
  }

  return { encontrado: true, endereco }
}

function daBrasilApi(corpo: unknown): ResultadoCep | "fora" {
  if (!corpo || typeof corpo !== "object") return "fora"

  const dados = corpo as Record<string, unknown>

  if (Array.isArray(dados.errors) && dados.errors.length > 0) {
    return { encontrado: false, motivo: "cep-inexistente" }
  }

  const estado = texto(dados.state).toUpperCase()
  const cidade = texto(dados.city)

  if (!estado && !cidade) return "fora"

  const endereco: EnderecoDoCep = {
    logradouro: texto(dados.street),
    bairro: texto(dados.neighborhood),
    cidade,
    estado,
  }

  return { encontrado: true, endereco }
}

type Provedor = readonly [url: (cep: string) => string, ler: Ler]

const PROVEDORES: readonly Provedor[] = [
  [(cep) => `${VIACEP}/${cep}/json/`, doViaCep],
  [(cep) => `${BRASILAPI}/${cep}`, daBrasilApi],
]

function resposta(corpo: ResultadoCep, status: number) {
  return NextResponse.json(corpo, {
    status,
    headers: { "Cache-Control": "no-store" },
  })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cep: string }> }
) {
  const { cep } = await params
  const digitos = apenasDigitos(cep).slice(0, CEP_DIGITOS)

  if (digitos.length !== CEP_DIGITOS) {
    return resposta({ encontrado: false, motivo: "cep-incompleto" }, 400)
  }

  for (const [url, ler] of PROVEDORES) {
    const resultado = await consultar(url(digitos), ler)

    if (resultado !== "fora") return resposta(resultado, 200)
  }

  return resposta({ encontrado: false, motivo: "provedor-fora" }, 502)
}
