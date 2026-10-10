/**
 * A tela "Páginas" — o índice das páginas declaradas, dentro de "Conteúdo".
 * -------------------------------------------------------------------------
 * É a F3a, item 2, do doc 14: o lojista pergunta "o que está no ar?" e a
 * resposta, antes disto, exigia abrir as seis abas uma a uma e traduzir o
 * interruptor de cada bloco. Aqui é uma linha por página, com o estado que o
 * **servidor** calculou (`GET /admin/content/pages`) e um atalho para os blocos
 * dela.
 *
 * **Por que uma view, e não uma rota nova.** O atalho "Editar blocos" é a troca
 * de aba que já existe (`switchSurface`, na tela de conteúdo). Uma rota própria
 * teria de carregar a URL do painel junto para linkar de volta — e o painel não
 * conhece essa URL: `MEDUSA_ADMIN_PATH` é configuração (hoje `/painel`), e o
 * único endereço que o CRM escreve é o da **API** (`/admin/...`, absoluto). Uma
 * segunda tela seria também um segundo lugar para manter em dia com as abas.
 *
 * **O estado não é calculado aqui.** Ele chega pronto (`rows.state`) da mesma
 * régua que a rota `[slug]` da loja aplica antes de responder 404
 * (`publishedSections` + `pageState`, no contrato) — o painel desenha o rótulo e
 * a frase que vieram no payload (`pageStates`), e não conta seção nem compara
 * tipo. Contar aqui seria uma segunda resposta para "esta página está no ar", e
 * a que a cliente vê é a da loja.
 *
 * **O que ele não faz.** Não cria página — é a entidade `content_page` (a
 * estratégia B, 14.6.4, que segue com gatilho) — e não publica nem despublica
 * página inteira: esse pedido é justamente um dos gatilhos da F3b. O que se
 * edita nesta tela é o bloco, na aba dele; o que esta tela responde é o estado.
 */
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

// Tipo do payload do servidor (`modules/content/pages.ts`), como os outros do
// painel: o valor chega pela API, o nome do campo é conferido pelo compilador.
import type { PageStateSpec } from "@conteudo/contract"

/** Uma linha do índice, como a API a manda. */
type PageRow = {
  id: string
  label: string
  /** O endereço da página na loja (`/sobre`), sem o país. */
  path: string
  blocks: number
  published: number
  state: PageStateSpec["id"]
}

export function PagesView({ onOpen }: { onOpen: (id: string) => void }) {
  const [pages, setPages] = useState<PageRow[]>([])
  const [states, setStates] = useState<PageStateSpec[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const res = await fetch("/admin/content/pages", {
        credentials: "include",
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.message ?? "Falha ao carregar as páginas.")
        return
      }

      setPages(json.pages ?? [])
      setStates(json.pageStates ?? [])
    } catch (error) {
      toast.error("Não foi possível carregar as páginas.")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** O vocabulário por `id` — o rótulo, o tom e a frase de cada estado. */
  const byState = useMemo(
    () => new Map(states.map((spec) => [spec.id, spec])),
    [states]
  )

  return (
    <Container className="flex flex-col gap-y-4">
      <div className="flex items-start justify-between gap-x-4">
        <div>
          <Heading level="h2">Páginas</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            O estado é o do endereço na loja: uma página publicada responde, e
            uma sem bloco publicado responde 404 — nunca a vitrine.
          </Text>
        </div>
        <Button
          variant="secondary"
          size="small"
          isLoading={loading}
          onClick={load}
        >
          Recarregar
        </Button>
      </div>

      {loading && (
        <Text size="small" className="text-ui-fg-subtle">
          Carregando páginas…
        </Text>
      )}

      {!loading &&
        pages.map((page) => {
          const state = byState.get(page.state)

          return (
            <div
              key={page.id}
              className="flex items-start justify-between gap-x-4 border-t border-ui-border-base pt-3"
            >
              <div className="flex flex-col gap-y-1">
                <div className="flex items-center gap-x-2">
                  <Text size="small" weight="plus">
                    {page.label}
                  </Text>
                  <Badge size="2xsmall" color={state?.tone}>
                    {state?.label ?? page.state}
                  </Badge>
                </div>

                <Text size="xsmall" className="text-ui-fg-subtle">
                  {`${page.path} · ${page.blocks} ${
                    page.blocks === 1 ? "bloco" : "blocos"
                  } · ${page.published} ${
                    page.published === 1 ? "publicado" : "publicados"
                  }`}
                </Text>

                {/* A frase do estado só aparece quando há o que avisar: em cinco
                    linhas verdes, "o endereço responde" é ruído — o que o
                    lojista precisa ler é a linha laranja. */}
                {state && page.state !== "published" && (
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {state.meaning}
                  </Text>
                )}
              </div>

              <Button
                variant="secondary"
                size="small"
                onClick={() => onOpen(page.id)}
              >
                Editar blocos
              </Button>
            </div>
          )
        })}
    </Container>
  )
}
