/**
 * A cache do conteúdo: uma tag e uma janela, para todas as leituras do CMS.
 * -------------------------------------------------------------------------
 * A tag `content` é global de propósito (`getCacheOptions` prefixa a dele com um
 * id de visitante por cookie, e o conteúdo é o mesmo para todo mundo): o
 * `revalidateTag("content")` que o CRM dispara depois de gravar invalida **todas**
 * as leituras de uma vez, e não só a sessão de quem editou.
 *
 * Ela mora aqui, e não dentro de `lib/data/content.ts`, por dois motivos: um
 * arquivo `"use server"` só pode exportar função `async` (uma constante quebraria
 * o build), e desde a F3a do doc 14 existe **mais de um** leitor do conteúdo — o
 * das seções (`getSurfaceSections`) e o do índice de páginas
 * (`lib/data/pages.ts`). Escrita em dois lugares, a tag divergiria no dia em que
 * alguém renomeasse uma — em silêncio, e o sintoma seria "a edição não apareceu
 * na loja", que é o defeito 5 do doc 14 (a leitura paralela que fica fora do
 * `revalidateTag`).
 *
 * A janela é a mesma promessa de todo o CMS: "editar no CRM muda a loja em até um
 * minuto". Ela anda junto da tag porque as duas são a mesma decisão — quanto o
 * site pode atrasar, e o que força o atraso a zero.
 */
export const CONTENT_CACHE_TAG = "content"

/** A janela (segundos) da promessa "a edição aparece em até um minuto". */
export const CONTENT_CACHE_WINDOW = 60
