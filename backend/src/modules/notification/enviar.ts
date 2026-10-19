import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

/**
 * O ponto único de envio de e-mail. Registra a origem, engole o erro (o pedido
 * já existe) e deduplica pela chave de idempotência. Ver doc 15, §15.10.
 */
export type EmailParaEnviar = {
  /** O destinatário. Obrigatório; sem ele, a função só avisa e volta. */
  to: string | null | undefined
  template: string
  data: Record<string, unknown>
  /** Uma por **fato**: `order-placed:<id>`, `order-shipped:<id>:<código>:<situação>`. */
  idempotencyKey?: string
  triggerType?: string
  resourceId?: string
}

/** `ana.silva@exemplo.com` → `a***@exemplo.com`. */
export function mascararEmail(email: string | null | undefined): string {
  const texto = String(email ?? "").trim()

  if (!texto) {
    return "(sem e-mail)"
  }

  const [usuario, dominio] = texto.split("@")

  if (!dominio) {
    return "***"
  }

  const primeira = usuario.slice(0, 1) || "*"
  return `${primeira}***@${dominio}`
}

function mensagemDoErro(erro: unknown): string {
  if (erro instanceof Error) {
    return erro.message
  }

  return String(erro)
}

export async function enviarEmail(
  container: MedusaContainer,
  email: EmailParaEnviar
): Promise<boolean> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const destinatario = String(email.to ?? "").trim()

  if (!destinatario) {
    logger.warn(
      `[email] "${email.template}" não saiu: o pedido não tem e-mail de contato.`
    )
    return false
  }

  try {
    const notificacoes = container.resolve<{
      createNotifications: (dados: Record<string, unknown>) => Promise<unknown>
    }>(Modules.NOTIFICATION)

    const criada = await notificacoes.createNotifications({
      to: destinatario,
      channel: "email",
      template: email.template,
      data: email.data,
      idempotency_key: email.idempotencyKey,
      trigger_type: email.triggerType,
      resource_id: email.resourceId,
      resource_type: email.resourceId ? "order" : undefined,
    })

    // `undefined` = a chave já existia com sucesso; o módulo pulou o envio.
    return Boolean(criada)
  } catch (erro) {
    logger.warn(
      `[email] "${email.template}" para ${mascararEmail(
        destinatario
      )} não saiu: ${mensagemDoErro(erro)}`
    )
    return false
  }
}
