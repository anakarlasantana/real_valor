import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import type { Logger, NotificationTypes } from "@medusajs/framework/types"

import { lerDetalhe } from "../../../utils/erro-de-plataforma"

/**
 * O e-mail transacional pelo Resend. O texto mora no template publicado (editor
 * do painel); aqui só vão o alias e as variáveis, por `POST /emails`.
 * Ver README.md nesta pasta e docs/real-valor/15-arquitetura-modular.md §15.10.
 */
export type OpcoesDoResend = {
  /** A API key (`re_...`). Obrigatória; sem ela o provider nem é registrado. */
  apiKey?: string
  /** O remetente, com nome e domínio verificado: `Real Valor <...>`. */
  from?: string
  /** Um `Reply-To` opcional para toda a loja. */
  replyTo?: string
  /** Para testes e para o espelho da API. */
  baseUrl?: string
  /** Teto de espera da chamada. O padrão são 10s. */
  timeoutMs?: number
}

type OpcoesResolvidas = OpcoesDoResend & { channels?: string[] }

type RespostaDoResend = {
  id?: string
  message?: string
  name?: string
  statusCode?: number
}

const BASE_URL_PADRAO = "https://api.resend.com"
const TIMEOUT_PADRAO_MS = 10_000

/** O Resend aceita string, número e booleano; o resto vira texto. */
function variaveis(
  dados: Record<string, unknown> | null | undefined
): Record<string, string | number | boolean> {
  const saida: Record<string, string | number | boolean> = {}

  for (const [chave, valor] of Object.entries(dados ?? {})) {
    if (valor === null || valor === undefined) {
      // Presente e vazio: o Resend recusa variável ausente sem fallback.
      saida[chave] = ""
    } else if (
      typeof valor === "string" ||
      typeof valor === "number" ||
      typeof valor === "boolean"
    ) {
      saida[chave] = valor
    } else {
      saida[chave] = String(valor)
    }
  }

  return saida
}

export class ResendNotificationService extends AbstractNotificationProviderService {
  static identifier = "resend"

  protected logger_: Logger
  protected options_: OpcoesResolvidas

  constructor({ logger }: { logger: Logger }, options: OpcoesResolvidas) {
    super()

    this.logger_ = logger
    this.options_ = options
  }

  static validateOptions(options: Record<string, unknown>): void {
    if (!String(options.apiKey ?? "").trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "O provider de e-mail precisa de RESEND_API_KEY."
      )
    }

    if (!String(options.from ?? "").trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "O provider de e-mail precisa de RESEND_FROM (o remetente com o domínio verificado)."
      )
    }
  }

  async send(
    notification: NotificationTypes.ProviderSendNotificationDTO
  ): Promise<NotificationTypes.ProviderSendNotificationResultsDTO> {
    const destinatario = String(notification.to ?? "").trim()

    if (!destinatario) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "O e-mail não tem destinatário."
      )
    }

    const template = String(notification.template ?? "").trim()

    if (!template) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "O e-mail não diz qual template do Resend usar."
      )
    }

    const remetenteDoPedido = String(
      notification.provider_data?.from ?? ""
    ).trim()

    const corpo: Record<string, unknown> = {
      from: remetenteDoPedido || String(this.options_.from ?? "").trim(),
      to: [destinatario],
      template: {
        id: template,
        variables: variaveis(notification.data),
      },
    }

    const replyTo = String(
      notification.provider_data?.reply_to ?? this.options_.replyTo ?? ""
    ).trim()

    if (replyTo) {
      corpo.reply_to = replyTo
    }

    const base = String(this.options_.baseUrl ?? BASE_URL_PADRAO).replace(
      /\/+$/,
      ""
    )
    const timeout = Number(this.options_.timeoutMs) || TIMEOUT_PADRAO_MS
    const controller = new AbortController()
    const relogio = setTimeout(() => controller.abort(), timeout)

    try {
      const resposta = await fetch(`${base}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options_.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(corpo),
        signal: controller.signal,
      })

      const texto = await resposta.text()
      let json: RespostaDoResend = {}

      try {
        json = texto ? (JSON.parse(texto) as RespostaDoResend) : {}
      } catch {
        json = { message: texto.slice(0, 300) }
      }

      if (!resposta.ok) {
        const detalhe = lerDetalhe(json) ?? "sem detalhe"
        const sufixo =
          resposta.status === 429
            ? " Limite de envios atingido (o plano gratuito permite 100 por dia)."
            : ""

        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `O Resend recusou "${template}" (HTTP ${resposta.status})${sufixo}: ${detalhe}`
        )
      }

      if (!json.id) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `O Resend aceitou "${template}" mas não devolveu o id do e-mail.`
        )
      }

      return { id: json.id }
    } catch (erro) {
      if (erro instanceof MedusaError) {
        throw erro
      }

      const nome = (erro as Error)?.name

      if (nome === "AbortError") {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `O Resend não respondeu em ${Math.round(timeout / 1000)}s.`
        )
      }

      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Não foi possível falar com o Resend: ${(erro as Error)?.message ?? erro}`
      )
    } finally {
      clearTimeout(relogio)
    }
  }
}

export default ResendNotificationService
