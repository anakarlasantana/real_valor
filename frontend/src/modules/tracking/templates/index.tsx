/**
 * A tela de consulta de rastreio da loja.
 * -------------------------------------------------------------------------
 * É a página pública do RV-044. Ela **não** valida nada: pede o número do
 * pedido e o CPF **ou** o e-mail, entrega os dois para `consultarRastreio`, e
 * desenha a situação que voltar.
 *
 * A separação é deliberada e é a mesma do resto do storefront:
 * `data/tracking.ts` decide **o que** a resposta significa (as quatro
 * situações), e este componente decide **como** isso aparece. A tela não
 * conhece status HTTP, e o data layer não conhece React — cada um testável
 * sozinho.
 *
 * **Por que não há máscara de CPF nem validação de 11 dígitos aqui.** A máscara
 * atrapalha quem digita o número em outro formato, e recusar o documento no
 * navegador rejeita a pessoa_errar duas vezes. Quem decide se o dado serve é o
 * backend, comparando com o que está gravado no pedido.
 */
"use client"

import { useState, useTransition } from "react"

import { consultarRastreio, type ResultadoRastreio } from "@lib/data/tracking"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * A mensagem de cada situação, escrita para a cliente que está esperando.
 *
 * "não encontrado" e "recusado" são mensagens **de quem digitou errado**, não
 * de sistema quebrado — por isso o texto diz o que conferir, em vez de
 * pedir desculpa e suggestir tentar mais tarde.
 */
const MENSAGENS: Record<
  Exclude<ResultadoRastreio["situacao"], "encontrado">,
  { titulo: string; texto: string }
> = {
  "nao-encontrado": {
    titulo: "Pedido não encontrado",
    texto: "Confira o número do pedido. Ele aparece na confirmação da compra e no e-mail que você recebeu.",
  },
  recusado: {
    titulo: "Não deu para conferir",
    texto: "O CPF ou e-mail não bate com o pedido. Confira os dados e tente de novo.",
  },
  erro: {
    titulo: "Algo deu errado",
    texto: "Não foi possível consultar agora. Tente de novo em instantes.",
  },
  pendente: {
    titulo: "Pedido recebido",
    texto: "Assim que o envio for registrado, o código de rastreio aparece aqui.",
  },
}

export default function RastreioTemplate() {
  const [numero, setNumero] = useState("")
  const [cpf, setCpf] = useState("")
  const [email, setEmail] = useState("")
  const [resultado, setResultado] = useState<ResultadoRastreio | null>(null)
  const [pending, startTransition] = useTransition()

  const consultar = (evento: React.FormEvent) => {
    evento.preventDefault()

    startTransition(async () => {
      setResultado(await consultarRastreio(numero, cpf, email))
    })
  }

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between border-b border-ui-border-base pb-8">
        <h1 className="heading-core text-3xl md:text-4xl">Rastrear pedido</h1>
      </div>

      <div className="w-full max-w-prose pb-24 pt-8">
        <p className="text-base text-ui-fg-base">
          Informe o número do pedido e o CPF ou o e-mail usado na compra.
        </p>

        <form
          className="flex w-full max-w-xl flex-col gap-4 pt-6"
          onSubmit={consultar}
          noValidate
        >
          <div className="flex w-full flex-col gap-1">
            <label htmlFor="numero-pedido" className="text-sm text-ui-fg-subtle">
              Número do pedido
            </label>
            <input
              id="numero-pedido"
              name="display_id"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              className="h-10 w-full border border-ui-border-base px-3 outline-none focus:border-ui-border-strong"
              placeholder="123"
            />
          </div>

          <div className="flex w-full flex-col gap-1">
            <label htmlFor="cpf" className="text-sm text-ui-fg-subtle">
              CPF
            </label>
            <input
              id="cpf"
              name="cpf"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              className="h-10 w-full border border-ui-border-base px-3 outline-none focus:border-ui-border-strong"
              placeholder="000.000.000-00"
            />
          </div>

          <div className="flex w-full flex-col gap-1">
            <label htmlFor="email" className="text-sm text-ui-fg-subtle">
              ou e-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full border border-ui-border-base px-3 outline-none focus:border-ui-border-strong"
              placeholder="voce@email.com"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="h-10 w-full max-w-[160px] bg-ui-bg-inverted text-ui-fg-inverted disabled:opacity-50"
          >
            {pending ? "Consultando…" : "Consultar"}
          </button>
        </form>

        {resultado && (
          <Resultado resultado={resultado} />
        )}
      </div>
    </div>
  )
}
/**
 * O que a tela mostra para cada situação.
 *
 * O `aria-live="polite"` é o que faz o resultado ser **falado** por quem usa
 * leitor de tela: sem ele, a pessoa preenche o formulário, aperta o botão, e
 * não acontece nada — do ponto de vista dela a página simplesmente não
 * respondeu.
 */
function Resultado({ resultado }: { resultado: ResultadoRastreio }) {
  if (resultado.situacao === "encontrado") {
    return <PedidoEncontrado resultado={resultado} />
  }

  // A mensagem do erro técnico vem do data layer (que a leu); as demais são as
  // daqui. A mistura é proposital: "não foi possível consultar" é a única coisa
  // que o servidor sabe dizer, e as outras três é a tela que sabe explicar.
  const erro =
    resultado.situacao === "erro"
      ? { titulo: MENSAGENS.erro.titulo, texto: resultado.mensagem }
      : MENSAGENS[resultado.situacao]

  return (
    <section
      aria-live="polite"
      className="mt-10 border-t border-ui-border-base pt-8"
    >
      <h2 className="heading-core text-xl">{erro.titulo}</h2>
      <p className="text-sm text-ui-fg-subtle">{erro.texto}</p>

      <LocalizedClientLink
        href="/"
        className="mt-4 inline-block text-sm underline"
      >
        Voltar para a loja
      </LocalizedClientLink>
    </section>
  )
}

/** O pedido com rastreio: número, situação, transportadora, código e link. */
function PedidoEncontrado({ resultado }: { resultado: Extract<ResultadoRastreio, { situacao: "encontrado" }> }) {
  const pedido = resultado.dados.order
  const rastreio = pedido.tracking

  return (
    <section
      aria-live="polite"
      className="mt-10 border-t border-ui-border-base pt-8"
    >
      <h2 className="heading-core text-xl">Pedido #{pedido.display_id}</h2>
      <p className="text-sm text-ui-fg-subtle">
        {pedido.metadata.order_status_label}
      </p>

      <dl className="mt-4 flex flex-col gap-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
          <dt className="text-sm text-ui-fg-subtle sm:w-40">Transportadora</dt>
          <dd className="text-sm">{rastreio.carrier}</dd>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
          <dt className="text-sm text-ui-fg-subtle sm:w-40">Código</dt>
          <dd className="text-sm">{rastreio.tracking_number}</dd>
        </div>
      </dl>

      {/* O link só aparece quando existe. Um botão "acompanhar" apontando para
          lugar nenhum seria pior do que não ter botão nenhum — a cliente
          clica, abre uma página vazia e conclui que o código está errado. */}
      {rastreio.tracking_url && (
        <a
          href={rastreio.tracking_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-sm underline"
        >
          Acompanhar na transportadora
        </a>
      )}
    </section>
  )
}
