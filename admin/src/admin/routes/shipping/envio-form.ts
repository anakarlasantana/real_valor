/**
 * O corpo que o painel manda para `POST /admin/shipping/:id`.
 * -------------------------------------------------------------------------
 * A distinção de **ausente** contra **vazio** é o heart da função, e é o que
 * permite corrigir a transportadora sem redigitar o código de rastreio:
 *
 * | o lojista... | o campo... | o pedido... |
 * | :--- | :--- | :--- |
 * | mudou só a situação | `status_label` | mantém código e transportadora |
 * | apagou o código | `tracking_number: ""` | fica sem rastreio |
 * | não tocou no campo | (não vai no corpo) | não é mexido |
 *
 * Sem isso, salvar a situação apagaria o código — e a cliente que já tinha o
 * rastreio passaria a ver "ainda não enviado".
 *
 * Esta parte é uma função pura, não um componente: é a lógica que vale
 * testar, e testar por dentro de um `<form>` não diria o que aconteceu.
 */
import type { ResumoEnvio } from "./types"

/** Os nomes do formulário → os nomes que a rota de envio lê. */
export const CAMPOS_ENVIO = [
  "carrier",
  "tracking_number",
  "tracking_url",
  "status_label",
] as const

export type CampoEnvio = (typeof CAMPOS_ENVIO)[number]

export type EstadoEnvio = Record<CampoEnvio, string>

/** O formulário em branco, para um pedido que ainda não foi enviado. */
export function estadoVazio(): EstadoEnvio {
  return {
    carrier: "",
    tracking_number: "",
    tracking_url: "",
    status_label: "",
  }
}

/** O formulário preenchido a partir do que a rota de listagem devolveu. */
export function estadoDoResumo(resumo: ResumoEnvio): EstadoEnvio {
  return {
    carrier: resumo.carrier,
    tracking_number: resumo.trackingNumber,
    tracking_url: resumo.trackingUrl,
    status_label: resumo.statusLabel,
  }
}

/**
 * O corpo do POST: **só o que mudou** em relação ao que o pedido já tem.
 *
 * É essa função que evita o pior erro possível na tela — salvar a situação do
 * pedido e, junto, apagar o código de rastreio que a cliente já tinha.
 */
export function corpoDoEnvio(
  atual: EstadoEnvio,
  editado: EstadoEnvio
): Record<string, string> {
  const corpo: Record<string, string> = {}

  for (const campo of CAMPOS_ENVIO) {
    if (editado[campo] !== atual[campo]) {
      corpo[campo] = editado[campo]
    }
  }

  return corpo
}

/** A situação que o painel mostra na lista, a partir do resumo da rota. */
export function rotuloDaFila(resumo: ResumoEnvio): {
  texto: string
  cor: "green" | "orange" | "grey"
} {
  if (!resumo.enviado) {
    return { texto: "Aguardando envio", cor: "orange" }
  }

  // Só "entregue" conta como entregue, e a palavra precisa ser INTEIRA:
  // "Saiu para entrega" e "Em rota de entrega" são o pedido ainda a caminho,
  // e marcá-los como entregues na tela é affirmar à loja que a cliente já
  // recebeu algo que não recebeu.
  if (/entregue/.test(resumo.statusLabel.toLowerCase())) {
    return { texto: "Entregue", cor: "green" }
  }

  return { texto: resumo.statusLabel, cor: "grey" }
}