/**
 * Consulta de rastreio do storefront.
 * -------------------------------------------------------------------------
 * Fala com `GET /store/orders/track`, que já existe no backend e já está certa:
 * exige o **número do pedido + CPF ou e-mail**, e devolve 403 quando a
 * identidade não bate com o pedido. Esta camada não repete essa regra — ela
 * traduz a resposta HTTP em uma situação que a página sabe desenhar, e é só
 * isso.
 *
 * **Três decisões que valem explicar.**
 *
 * **1. `cache: "no-store"`.** É a única função do storefront que não usa
 * cache. As outras respostas são públicas e iguais para todo mundo; esta tem o
 * CPF da cliente dentro. Com qualquer cache — do Next ou do CDN na frente —,
 * uma consulta poderia ser servida para outra pessoa, e o dado errado aqui é o
 * pedido de outra pessoa.
 *
 * **2. `"use server"` — requisito, não estilo.** Quem importa isto por valor é
 * um componente `"use client"` (`modules/tracking/templates/index.tsx`), e um
 * módulo comum arrastaria o `sdk` do `@lib/config` — junto com o `next/headers`
 * de onde ele lê o idioma — para o bundle do cliente: o `next build` morre
 * antes de emitir CSS (`RV-050`). É a mesma diretiva de `cart`, `orders` e
 * `customer`.
 *
 * **3. O CPF não aparece em lugar nenhum.** Não vai para a URL do Next, não vai
 * para log, não vai para mensagem de erro: uma página que passa a cliente pelo
 * `searchParams` tem histórico no navegador e no servidor. Por isso a consulta
 * só acontece **depois que a cliente aperta o botão** — e a URL da página
 * nunca carrega o CPF.
 */
"use server"

import { sdk } from "@lib/config"
import type { RespostaRastreio, SituacaoRastreio } from "./tracking-types"

/**
 * O que a página precisa saber, em vez do JSON cru do backend: o "não
 * encontrado" e o "recusado" são separados de propósito — a resposta 403
 * **existe** e não muda o status do pedido no Medusa.
 */
export type ResultadoRastreio =
  | { situacao: "nao-encontrado" }
  | { situacao: "recusado" }
  | { situacao: "erro"; mensagem: string }
  | { situacao: "pendente" }
  | { situacao: "encontrado"; dados: RespostaRastreio }

/** A rota que o backend expõe. */
const ROTA = "/store/orders/track"

/**
 * Consulta um pedido.
 *
 * Recebe o CPF **ou** o e-mail; os dois vazios são recusados aqui, antes da
 * rede, pelo mesmo motivo do backend: um pedido sem identidade não é uma
 * consulta, é uma tentativa de listar pedidos.
 */
export async function consultarRastreio(
  displayId: string,
  cpf: string,
  email: string
): Promise<ResultadoRastreio> {
  const numero = displayId.trim()
  const documento = cpf.trim()
  const contato = email.trim()

  if (!numero || (!documento && !contato)) {
    return { situacao: "erro", mensagem: "Preencha o pedido e o CPF ou e-mail." }
  }

  try {
    const resposta = await sdk.client.fetch<RespostaRastreio>(ROTA, {
      method: "GET",
      // Sem cache: a resposta tem o CPF da cliente dentro.
      cache: "no-store",
      query: {
        display_id: numero,
        ...(documento ? { cpf: documento } : {}),
        ...(contato ? { email: contato } : {}),
      },
    })

    return interpretar(resposta)
  } catch (erro) {
    // O erro do SDK carrega o status. Quando é 404 ou 403, a resposta VEM —
    // não é exceção — então este caminho é mesmo só para rede quebrada.
    const status = statusDoErro(erro)

    if (status === 404) {
      return { situacao: "nao-encontrado" }
    }

    if (status === 403) {
      return { situacao: "recusado" }
    }

    return {
      situacao: "erro",
      mensagem: "Não foi possível consultar agora. Tente de novo em instantes.",
    }
  }
}

/** O que a resposta 200 significa: existe, mas a loja ainda não preencheu. */
function interpretar(resposta: RespostaRastreio): ResultadoRastreio {
  const codigo = resposta?.order?.tracking?.tracking_number

  // Sem código é o caso comum do dia a dia: o pedido existe e está pago, e a
  // transportadora ainda não foi registrada no painel. Não é erro, e a tela
  // diz isso explicitamente em vez de mostrar um formulário vazio.
  if (!codigo) {
    return { situacao: "pendente" }
  }

  return { situacao: "encontrado", dados: resposta }
}

/**
 * O status HTTP de um erro do SDK do Medusa.
 *
 * O `client.js` do `@medusajs/js-sdk` lança `FetchError` com o status em
 * `.status` para **toda** resposta >= 300 — inclusive 404 e 403. É por isso que
 * "não encontrado" e "identidade não confere" chegam aqui como exceção, e não
 * como um valor devolvido: quem chama não pode assumir que o `try` só pega
 * falha de rede.
 */
function statusDoErro(erro: unknown): number | null {
  const e = erro as { response?: { status?: number }; status?: number }

  return e?.response?.status ?? e?.status ?? null
}

export type { SituacaoRastreio }