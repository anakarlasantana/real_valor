"use client"

/**
 * "Estamos confirmando seu pagamento" — o destino do `MP_BACK_URL`.
 * -------------------------------------------------------------------------
 * Esta é a página em que a cliente cai quando volta do Mercado Pago. Ela existe
 * porque, no Checkout Pro, **o pedido ainda não existe** quando a cliente volta:
 * quem o cria é o webhook, e o webhook chega em paralelo ao navegador — às vezes
 * depois. Redirecionar direto para `/order/{id}` seria redirecionar para um id
 * que ninguém conhece do lado do navegador.
 *
 * Então a página pergunta ao servidor "o pedido do meu carrinho já existe?"
 * (`/api/pedido/status`, que resolve o carrinho pelo **cookie httpOnly**) e,
 * quando a resposta é sim, troca a URL pela página real do pedido.
 *
 * **Por que uma tela, e não um erro.** O caso normal dura de um a três segundos.
 * Mostrar "não encontramos seu pedido" nesse intervalo seria mentir para toda
 * cliente que pagou — e é o tipo de mentira que gera chamado de suporte às
 * pressas. A tela diz o que está acontecendo, que é a verdade.
 *
 * **O que esta página NÃO faz:** completar o carrinho, criar o pedido, ou
 * confirmar o pagamento. Ela **pergunta**. Quem decide é o backend, a partir da
 * notificação assinada do Mercado Pago — e a página não tem como forçar isso nem
 * se quisesse, porque não fala com o backend usando nada além do próprio cookie.
 */
import { useEffect, useRef, useState } from "react"

import { useParams, useRouter } from "next/navigation"

/** A cada quanto tempo perguntar. Curto o bastante para parecer imediato. */
const INTERVALO_MS = 3_000

/**
 * Quantas vezes tentar antes de oferecer saída manual.
 *
 * Vinte tentativas são um minuto. Se em um minuto o webhook não processou, o
 * problema é real (variável faltando, URL de notificação errada, sigla de
 * webhook desligada no painel) — e insistir para sempre só esconde isso de quem
 * pode resolver. Aqui a cliente recebe uma explicação e um caminho.
 */
const TENTATIVAS = 20

type Estado = "verificando" | "demorando" | "mal-configurado"

export default function PagamentoEmProcessamento() {
  const router = useRouter()
  const params = useParams<{ countryCode?: string }>()
  const [estado, setEstado] = useState<Estado>("verificando")

  // `useRef` e não `useState`: o contador **não desenha**. Guardá-lo no estado
  // faria cada tique renderizar a página inteira de novo por nada.
  const tentativas = useRef(0)

  useEffect(() => {
    let vivo = true
    let timer: ReturnType<typeof setTimeout>

    const perguntar = async () => {
      tentativas.current += 1

      let resposta: Response

      try {
        resposta = await fetch("/api/pedido/status", { cache: "no-store" })
      } catch {
        // A rede caiu entre o navegador e o storefront. Não é a mesma coisa que
        // "não há pedido" — mas a ação é a mesma: tentar de novo.
        return agendar()
      }

      if (!vivo) {
        return
      }

      if (resposta.status === 200) {
        const dados = (await resposta.json()) as { id?: string }

        if (dados.id) {
          // `replace` e não `push`: a página de espera não deve ficar no
          // histórico. Voltar para ela seria voltar para uma tela que pergunta
          // por um pedido que já foi encontrado.
          const prefixo = params?.countryCode ? `/${params.countryCode}` : ""
          router.replace(`${prefixo}/order/${dados.id}/confirmed`)
          return
        }
      }

      if (resposta.status === 503) {
        // O storefront está sem `INTERNAL_API_SECRET`. Nenhuma tentativa vai
        // resolver isto, e insistir por um minuto só atrasaria a informação.
        setEstado("mal-configurado")
        return
      }

      // 404 é o caso normal enquanto o webhook não chega; 502 é o backend fora.
      // Os dois pedem a mesma coisa: esperar.
      return agendar()
    }

    const agendar = () => {
      if (!vivo) {
        return
      }

      if (tentativas.current >= TENTATIVAS) {
        setEstado("demorando")
        return
      }

      timer = setTimeout(perguntar, INTERVALO_MS)
    }

    void perguntar()

    return () => {
      vivo = false
      clearTimeout(timer)
    }
  }, [params?.countryCode, router])

  if (estado === "mal-configurado") {
    return (
      <div className="content-container py-24 text-center" data-testid="pagamento-indisponivel">
        <h1 className="text-2xl font-semibold text-ui-fg-base">
          Não conseguimos consultar seu pedido
        </h1>
        <p className="mt-4 text-ui-fg-subtle">
          Seu pagamento não foi perdido. Fale com a gente pelo WhatsApp com o
          comprovante do Mercado Pago e resolvemos na hora.
        </p>
      </div>
    )
  }

  if (estado === "demorando") {
    return (
      <div className="content-container py-24 text-center" data-testid="pagamento-demorando">
        <h1 className="text-2xl font-semibold text-ui-fg-base">
          Estamos quase lá
        </h1>
        <p className="mt-4 text-ui-fg-subtle">
          O Mercado Pago ainda não nos avisou sobre este pagamento. Isso costuma
          levar só alguns segundos. Se você já pagou, seu pedido aparece em
          instantes na sua conta — e você recebe o e-mail de confirmação.
        </p>
        <p className="mt-2 text-sm text-ui-fg-muted">
          Guarde o comprovante do Mercado Pago. Se algo der errado, ele é o que
          resolve.
        </p>
      </div>
    )
  }

  return (
    <div className="content-container py-24 text-center" data-testid="pagamento-verificando">
      <h1 className="text-2xl font-semibold text-ui-fg-base">
        Confirmando seu pagamento…
      </h1>
      <p className="mt-4 text-ui-fg-subtle">
        Só um instante — estamos esperando a confirmação do Mercado Pago.
      </p>
      <p className="mt-2 text-sm text-ui-fg-muted">
        Não feche esta página.
      </p>
    </div>
  )
}
