/**
 * Página custom do admin: Conteúdo da vitrine.
 * -------------------------------------------------------------------------
 * A convenção é o nome do diretório: tudo em `src/admin/routes/**` vira rota no
 * dashboard, com a URL derivada do caminho do arquivo. Por isso a página abre em
 * `/painel/content` e aparece na sidebar principal.
 *
 * Fica FORA de `routes/settings/` de propósito: o dashboard classifica o item
 * pelo prefixo do path (`DashboardApp.populateMenus`), e tudo sob `/settings` cai
 * nas extensões da sidebar de Configurações em vez do menu principal.
 *
 * A tela tem **três abas** (`MAIN_NAVIGATION`): as seções da vitrine, o índice
 * das páginas institucionais e as estações do tema. As duas primeiras e o tema
 * são o mesmo painel (`SurfaceSectionsPanel`) com outro `surfaceId` — o que muda
 * é o conteúdo que a API devolve, e o contrato é quem o declara.
 *
 * O schema desta página é carregado uma vez, pela superfície padrão (`home`), só
 * para a barra saber quais páginas existem (`schema.surfaces`): as seções de
 * verdade — com a ordem, o catálogo de categorias e os rascunhos — cada painel
 * busca por conta própria (`GET /admin/content?surface=…`).
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { SquaresPlus } from "@medusajs/icons"
import { Button, Container, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

import type { Schema, ViewMode } from "./types"
import { MAIN_NAVIGATION, getPageSurfaces } from "./navigation"
import { VitrineSections } from "./VitrineSections"
import { ThemeSections } from "./ThemeSections"
import { PagesAccordion } from "./PagesAccordion"
import { PagesView } from "./pages-view"

const ContentPage = () => {
  /** A aba aberta: as seções da vitrine, o índice das páginas ou o tema. */
  const [mode, setMode] = useState<ViewMode>("vitrine")
  const [schema, setSchema] = useState<Schema | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(true)
  /**
   * A página aberta no acordeão.
   *
   * O estado é daqui, e não do acordeão, porque o índice (`PagesView`) tem um
   * atalho por linha ("Editar blocos") — e o atalho é abrir o acordeão da página
   * que ele nomeia. Sem isso, o atalho teria de inventar navegação: uma rota nova
   * levaria a URL do painel junto, que o CRM não conhece (`MEDUSA_ADMIN_PATH` é
   * configuração).
   */
  const [openPage, setOpenPage] = useState<string | null>(null)

  useEffect(() => {
    const loadSchema = async () => {
      try {
        const res = await fetch("/admin/content?surface=home", {
          credentials: "include",
        })
        const json = await res.json()

        if (res.ok) {
          setSchema(json.schema ?? null)
        } else {
          toast.error(json.message ?? "Falha ao carregar o schema.")
        }
      } catch (error) {
        toast.error("Não foi possível carregar o schema.")
        console.error(error)
      } finally {
        setLoadingSchema(false)
      }
    }

    void loadSchema()
  }, [])

  // As páginas declaradas no contrato, como o **payload** as devolve: uma página
  // nova aparece no acordeão sem edição aqui.
  const pageSurfaces = getPageSurfaces(schema)

  /** O atalho do índice: mostra a aba das páginas e abre os blocos da escolhida. */
  const openSurface = (id: string) => {
    setMode("pages")
    setOpenPage(id)
  }

  return (
    <Container className="flex flex-col gap-y-6 p-6">
      {/* Barra de abas: o ícone e o rótulo de cada uma saem de `MAIN_NAVIGATION`,
          que é a única lista de modos da tela. */}
      <nav
        className="flex gap-x-2 border-b border-ui-border-base pb-4"
        aria-label="Modos de conteúdo"
      >
        {MAIN_NAVIGATION.map((nav) => (
          <Button
            key={nav.id}
            variant={mode === nav.id ? "primary" : "secondary"}
            onClick={() => setMode(nav.id)}
            disabled={loadingSchema}
            className="flex items-center gap-x-2"
          >
            <nav.icon className="h-4 w-4" aria-hidden="true" />
            {nav.label}
          </Button>
        ))}
      </nav>

      {loadingSchema ? (
        <Container className="flex h-64 items-center justify-center">
          <Text size="small" className="text-ui-fg-subtle">
            Carregando…
          </Text>
        </Container>
      ) : (
        <>
          {mode === "vitrine" && <VitrineSections schema={schema} />}
          {mode === "theme" && <ThemeSections schema={schema} />}
          {mode === "pages" && (
            <div className="flex flex-col gap-y-6">
              {/* O índice responde "o que está no ar?" (o estado vem pronto do
                  servidor, `GET /admin/content/pages`); o acordeão responde
                  "onde eu mexo?" — os blocos de cada página, no painel genérico. */}
              <PagesView onOpen={openSurface} />
              <PagesAccordion
                surfaces={pageSurfaces}
                openId={openPage}
                onToggle={(id, expanded) => setOpenPage(expanded ? id : null)}
              />
            </div>
          )}
        </>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Conteúdo da vitrine",
  icon: SquaresPlus,
})

export default ContentPage
