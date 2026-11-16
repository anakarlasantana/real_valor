import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { defineMiddlewares } from "@medusajs/medusa"
import { MedusaError } from "@medusajs/framework/utils"

import { recusaDoPedido } from "../utils/arquivo-enviado"
import {
  chaveDoPedido,
  criarLimitador,
  regraPara,
  type Janela,
} from "../utils/limite-de-requisicoes"

/** O que o `multer` põe em `req.files` para cada arquivo. */
type ArquivoDoMulter = {
  originalname?: string
  mimetype?: string
  size?: number
}

/**
 * RV-024 (teto do envio) e RV-025 (rate limiting), no servidor. Não lê o
 * corpo: o `multer` nativo roda antes e entrega `req.files`; o teto absoluto
 * vem do `content-length` — ver RV-024 no doc 19.
 */
function receberArquivos(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const arquivos = ((req as MedusaRequest & { files?: ArquivoDoMulter[] })
    .files ?? []) as ArquivoDoMulter[]

  const recusa = recusaDoPedido(req.headers["content-length"], arquivos)

  if (recusa) {
    return next(new MedusaError(MedusaError.Types.INVALID_DATA, recusa))
  }

  next()
}

/** Um limitador por janela: prefixos com a mesma janela dividem o contador. */
const limitadores = new Map<Janela, ReturnType<typeof criarLimitador>>()

function limitadorDa(janela: Janela) {
  const existente = limitadores.get(janela)

  if (existente) {
    return existente
  }

  const novo = criarLimitador(janela)
  limitadores.set(janela, novo)

  return novo
}

function limitarPedidos(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const caminho = (req as MedusaRequest & { path?: string }).path ?? req.url
  const janela = caminho ? regraPara(caminho) : undefined

  if (!janela) {
    return next()
  }

  const chave = chaveDoPedido({
    forwarded: req.headers["x-forwarded-for"],
    ip: (req as MedusaRequest & { ip?: string }).ip,
  })

  const veredito = limitadorDa(janela).tentar(`${caminho} ${chave}`)

  res.setHeader("X-RateLimit-Limit", String(janela.limite))
  res.setHeader("X-RateLimit-Remaining", String(veredito.restantes))

  // O 429 é escrito à mão: o `MedusaError` não tem tipo que responda 429.
  if (!veredito.permitido) {
    res.setHeader("Retry-After", String(veredito.esperarSegundos))

    return res.status(429).json({
      type: "not_allowed",
      code: "rate_limit_exceeded",
      message: `Muitas requisições. Tente de novo em ${veredito.esperarSegundos} segundo(s).`,
    })
  }

  next()
}

export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/admin/uploads",
      middlewares: [receberArquivos],
    },
    // Uma rota curinga só: `regraPara` decide, no caminho, se há limite.
    { matcher: "/{*caminho}", middlewares: [limitarPedidos] },
  ],
})
