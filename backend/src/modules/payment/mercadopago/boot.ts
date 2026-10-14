/**
 * O log de boot, numa passada só: o que está configurado e o veredito dele.
 * Cada veredito é de `credenciais.ts`; o porquê, do README do módulo.
 */
import {
  alertaDaNotificacao,
  descreverConfiguracao,
  divergenciaDeAmbiente,
  pagamentoDisponivel,
} from "./credenciais"
import { METODOS, type Metodo } from "./preferencia"

/** O logger do container do Medusa — só os três níveis que se usa aqui. */
export type Registrador = {
  info: (m: string) => void
  warn: (m: string) => void
  error: (m: string) => void
}

/**
 * Anuncia a configuração do meio e o veredito dela — a divergência **no nível
 * do desfecho**, que é onde o caso caro aparece em voz alta.
 */
export function anunciarBoot(logger: Registrador, metodo: Metodo): void {
  const rotulo = `[mercadopago/${metodo}] ${METODOS[metodo].rotulo}`

  // Uma linha só, e não uma por variável: o boot já é barulhento, e o que se
  // faz com isto é `grep mercadopago` no log.
  logger.info(
    `${rotulo} ${Object.entries(descreverConfiguracao())
      .map(([nome, valor]) => `${nome}=${valor}`)
      .join(" · ")}`
  )

  const { erro, aviso } = divergenciaDeAmbiente()

  if (erro) {
    logger.error(`${rotulo} CONFIGURAÇÃO RECUSADA — ${erro}`)
  } else if (aviso) {
    logger.warn(`${rotulo} ${aviso}`)
  }

  const alertaNotificacao = alertaDaNotificacao()

  if (alertaNotificacao) {
    logger.warn(`${rotulo} ${alertaNotificacao}`)
  }

  const configuracao = pagamentoDisponivel()

  logger.info(
    `${rotulo} ` +
      (configuracao.ok ? "pronto." : `INDISPONÍVEL — ${configuracao.motivo}`)
  )
}
