import type { MetadataRoute } from "next"

import { getBaseURL } from "@lib/util/env"

/**
 * `/robots.txt` — o par do `sitemap.ts` (a F1 do doc 14 trouxe os dois).
 *
 * O que ele diz é curto de propósito: **tudo é rastreável, menos o que é da
 * cliente**. Não há `Disallow` para seção de conteúdo — página institucional
 * existe para ser encontrada —, e as três famílias barradas são as que só fazem
 * sentido com sessão (conta, carrinho/checkout, pedido) mais a busca, que é uma
 * tela por consulta e não conteúdo.
 *
 * ⚠️ **O curinga no primeiro segmento das regras não é enfeite.** A loja é
 * localizada: o `middleware.ts` põe todo caminho em `/<país>/…`, então uma regra
 * escrita apenas como `/checkout` não casaria com `/br/checkout` — o arquivo
 * pareceria certo e não barraria nada. Por isso cada `disallow` começa com o
 * segmento do país escrito como curinga, e a regra continua valendo para um
 * caminho mais fundo (o robots casa por prefixo: `/br/checkout/pix` também está
 * barrado).
 *
 * O `sitemap` aponta para o índice (`sitemap.ts`, que é quem sabe quais páginas
 * estão no ar). Anunciá-lo aqui é o que faz a busca achar o índice sem adivinhar
 * o endereço.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/*/checkout",
          "/*/cart",
          "/*/account",
          "/*/order",
          "/*/pedido",
          "/*/search",
        ],
      },
    ],
    sitemap: `${getBaseURL()}/sitemap.xml`,
  }
}
