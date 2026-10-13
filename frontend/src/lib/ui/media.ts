/**
 * O endereço de um arquivo do conteúdo — da imagem e do anexo.
 * -------------------------------------------------------------------------
 * O mesmo campo (`imageUrl`) guarda coisas diferentes conforme quem o
 * preencheu:
 *
 *   `1699999999-hero.jpg`   a **chave** do arquivo que o CRM enviou — é o que
 *                           `POST /admin/uploads` devolve em `id` e o que o
 *                           provider local grava em disco;
 *   `/uploads/<chave>`      o caminho do site já resolvido (o que esta função
 *                           produz, e o que fica gravado quando alguém edita
 *                           pelo painel);
 *   `/brand/hero.jpg`       imagem que vem no repositório
 *                           (`frontend/public/brand`), usada pelo conteúdo
 *                           padrão do seed;
 *   `http://localhost:9000/static/<chave>`  URL absoluta do backend, que é o
 *                           que o painel nativo da Medusa grava em alguns
 *                           lugares (foto de produto) — vira `/uploads/<chave>`;
 *   `https://<tunel>/painel-api/static/<chave>`  a MESMA URL quando a loja é
 *                           publicada por um endereço só (`make tunnel`): o
 *                           backend passa a se ver nesse endereço, com o prefixo
 *                           do painel na frente — idem;
 *   `https://cdn.awsli.com.br/...`          a foto colada do **site antigo da
 *                           loja** no CRM: terceiro, sai intacta e sem otimizar;
 *   `https://images.unsplash.com/...`       imagem de terceiro, colada à mão,
 *                           que sai daqui intacta.
 *
 * **Por que trazer para o próprio site em vez de devolver a URL do backend.**
 * O otimizador do `next/image` roda no SERVIDOR — dentro do container do
 * storefront —, onde `localhost:9000` é o próprio container: uma URL apontando
 * para o backend publicado só funciona no navegador de quem está na mesma
 * máquina. Com `/uploads/<chave>` a imagem passa a ser servida pelo domínio da
 * página (o rewrite de `frontend/next.config.js` faz a ponte), então funciona
 * no navegador E no otimizador, em DEV e em produção.
 *
 * **Por que a chave crua é aceita.** Trocar o provider local por S3 é mudar o
 * bloco do módulo em `backend/medusa-config.ts`: o que está gravado no banco
 * continua sendo a chave do arquivo, e nenhum conteúdo precisa migrar. Quem
 * traduz chave → URL é esta função — um lugar só.
 *
 * **Serve à imagem e ao anexo.** O `imageUrl` de um bloco e o `documentUrl` do
 * `prose` guardam a mesma coisa — a chave que o CRM recebeu no envio —, e o que
 * muda é o que se faz com o endereço: um vai para o `src` do `next/image`, o
 * outro para o `href` de um `<a download>`. Traduzir os dois aqui é o que
 * impede uma segunda regra de chave → endereço no storefront — e é por isso que
 * o cabeçalho deste arquivo não fala mais só de imagem.
 *
 * A função é pura e não lê ambiente de propósito: a URL absoluta do backend
 * não é conhecida aqui (e nem deve ser — o caminho `/uploads/...` é resolvido
 * pelo servidor do Next, não pelo navegador).
 */
const UPLOAD_PATH = "/uploads/"
/** A rota pública de arquivos do Medusa — ver `express-loader` do framework. */
const BACKEND_FILE_PATH = "/static/"

export function resolveMediaUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const src = value.trim()

  if (!src) {
    return undefined
  }

  // Caminho do próprio site (`/brand/...`, `/uploads/...`, `/static/...`): já
  // está no formato certo, e reescrever aqui só introduziria divergência com o
  // que está gravado.
  if (src.startsWith("/")) {
    return src
  }

  // URL absoluta. A do backend vira o caminho canônico do site — `/uploads/`,
  // que é o que a loja grava, e não `/static/`: uma forma só para o que a loja
  // usa e o que ela grava. Um CDN de terceiro fica intacto, e reescrevê-lo
  // esconderia a foto que o lojista escolheu. É o `mediaImageProps` abaixo — e
  // não esta função — que responde o que fazer com ele: um host que o otimizador
  // do `next/image` não conhece **lança** no SSR e derrubava a página inteira.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(src)) {
    const url = safeUrl(src)

    if (!url) {
      return src
    }

    const chave = chaveDoBackend(url.pathname)

    if (chave !== undefined) {
      return `${UPLOAD_PATH}${chave}`
    }

    if (url.pathname.startsWith(UPLOAD_PATH)) {
      return url.pathname
    }

    return src
  }

  // Sobrou a chave crua do provider de arquivos.
  return `${UPLOAD_PATH}${src}`
}

/**
 * O `src` e a decisão de otimização de uma imagem do **conteúdo**.
 * -------------------------------------------------------------------------
 * É o par que todo bloco da vitrine espalha no `<Image>`:
 *
 *     const image = mediaImageProps(section.imageUrl)
 *     {image && <Image {...image} alt={...} fill sizes={...} />}
 *
 * `undefined` quando não há endereço — o bloco continua de pé, com o fundo da
 * régua no lugar da foto, que é a degradação de sempre. Com endereço, o objeto
 * diz também se o otimizador do `next/image` **pode** buscá-lo.
 *
 * **Por que a segunda metade existe.** O `defaultLoader` do `next/image` não
 * devolve a URL de um host que não está em `images.remotePatterns`
 * (`frontend/next.config.js`): ele **lança** — `Invalid src prop (...) is not
 * configured under images`. E ele roda no servidor, durante a renderização: o
 * estrago não é daquela foto, é da **página**. Medido com o conteúdo real da
 * loja: uma foto colada do site antigo (`https://cdn.awsli.com.br/...`, no bloco
 * de coleções) fazia a home inteira responder **HTTP 500**. Um campo que o CRM
 * aceita digitar não pode ter esse poder.
 *
 * A regra é a mais estreita que resolve, e é a que o otimizador consegue cumprir
 * sem host nenhum liberado: **arquivo do próprio site é otimizado**
 * (`/uploads/...`, `/brand/...` — o que a função acima existe para produzir) e
 * **o resto vai como veio** (`unoptimized`), buscado pelo navegador de quem
 * visita. A foto aparece, a página fica de pé, e o que se perde é só o
 * redimensionamento de um arquivo que já vem pronto do site antigo.
 */
export function mediaImageProps(
  value: unknown
): { src: string; unoptimized: boolean } | undefined {
  const src = resolveMediaUrl(value)

  return src === undefined
    ? undefined
    : { src, unoptimized: !canOptimize(src) }
}

/**
 * A chave de um arquivo do backend a partir de um caminho — `/static/<chave>`.
 *
 * O `/static/` é procurado como SEGMENTO em qualquer posição, e não apenas no
 * começo: com a loja publicada por um endereço só (`make tunnel`),
 * `MEDUSA_BACKEND_URL` do backend ganha o prefixo do painel
 * (`https://<tunel>/painel-api`) e o provider de arquivos passa a devolver
 * `https://<tunel>/painel-api/static/<chave>` — o mesmo arquivo, com um
 * namespace na frente. Ancorar no começo do caminho deixaria essa URL passar
 * intacta e a foto sumiria no otimizador do `next/image` (que roda no servidor e
 * não alcança o endereço público), que é exatamente o desfecho que este arquivo
 * existe para impedir.
 *
 * A inclusão das duas barras na busca é o que a mantém sendo um *segmento*:
 * `.../mystatic/<chave>` não casa.
 */
function chaveDoBackend(pathname: string): string | undefined {
  const marcador = pathname.indexOf(BACKEND_FILE_PATH)

  return marcador < 0
    ? undefined
    : pathname.slice(marcador + BACKEND_FILE_PATH.length)
}

/** `null` em vez de exceção: um valor estranho no conteúdo não pode derrubar a página. */
function safeUrl(src: string): URL | null {
  try {
    return new URL(src)
  } catch {
    return null
  }
}

/**
 * O otimizador do `next/image` alcança o arquivo deste endereço?
 *
 * Caminho do próprio site é o que ele alcança: `/uploads/...` (o rewrite de
 * `next.config.js` traz o arquivo do backend) e `/brand/...` (vem no
 * repositório). É para eles que a otimização existe, e é o que a loja grava.
 *
 * As **duas** barras na frente são o caso que passaria por "caminho do site" e
 * não é: `//cdn.externo.com/foto.jpg` é host de terceiro sem esquema. O
 * `resolveMediaUrl` o devolve intacto — ele começa com `/` —, e o loader do
 * `next/image` o trata como externo, com a mesma exceção de host não liberado.
 */
function canOptimize(src: string): boolean {
  return src.startsWith("/") && !src.startsWith("//")
}
