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
  // usa e o que ela grava. Um CDN de terceiro fica intacto: os hosts liberados
  // estão em `images.remotePatterns`, e reescrever um deles trocaria um erro
  // previsível ("host não liberado") por uma imagem que some sem explicação.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(src)) {
    const url = safeUrl(src)

    if (!url) {
      return src
    }

    if (url.pathname.startsWith(BACKEND_FILE_PATH)) {
      return `${UPLOAD_PATH}${url.pathname.slice(BACKEND_FILE_PATH.length)}`
    }

    if (url.pathname.startsWith(UPLOAD_PATH)) {
      return url.pathname
    }

    return src
  }

  // Sobrou a chave crua do provider de arquivos.
  return `${UPLOAD_PATH}${src}`
}

/** `null` em vez de exceção: um valor estranho no conteúdo não pode derrubar a página. */
function safeUrl(src: string): URL | null {
  try {
    return new URL(src)
  } catch {
    return null
  }
}
