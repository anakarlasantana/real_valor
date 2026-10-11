/**
 * Página custom do admin: Conteúdo da vitrine.
 *
 * A convenção é o nome do diretório: tudo em `src/admin/routes/**` vira
 * rota no dashboard, com a URL derivada do caminho do arquivo. Por isso
 * a página abre em `/painel/content` e aparece na sidebar principal.
 *
 * Fica FORA de `routes/settings/` de propósito: o dashboard classifica o
 * item pelo prefixo do path (`DashboardApp.populateMenus`), e tudo sob
 * `/settings` cai nas extensões da sidebar de Configurações em vez do
 * menu principal. Aqui o item é uma entrada da sidebar principal
 * (`customizeId: main-sidebar`), então entra no "personalizar layout"
 * como qualquer menu nativo — reordenar, mover de seção e ocultar.
 *
 * A lista de campos de cada tipo NÃO é reescrita aqui: vem do
 * `schema.fields` que `GET /admin/content` devolve, gerado a partir de
 * `backend/src/modules/content/contract.ts`. Adicionar um campo no
 * contrato já o faz aparecer no formulário.
 *
 * O mesmo vale para o resto da tela: `schema.typeLabels` traz o nome de cada
 * tipo na listagem (o contrato decide que `editorial` se chama "Sobre") e
 * `schema.itemFields` o sub-formulário de cada item de lista. Não há tabela
 * de rótulos nem de campos de item neste arquivo — um tipo ou um campo novo
 * no contrato aparece aqui sem edição.
 *
 * O formulário respeita a **ordem** do contrato: cada campo de conteúdo sai
 * na posição dele, e cada trilho de aparência (os campos que têm `group`)
 * sai logo abaixo do campo que ele veste — o `attachedTo` do contrato é a
 * âncora declarada disso, conferida por `contract.unit.spec.ts` ("todo trilho
 * fica logo abaixo do campo de conteúdo que ele veste").
 * É a ordem do array, e não um mapa montado aqui, que decide onde a fonte do
 * título aparece na tela: uma escolha de tema só faz sentido junto da
 * coisa que ela muda.
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { LayoutDashboard, FileText, Palette } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

import type { ContentSurfaceSpec, Schema } from "@conteudo/contract"
import type { ViewMode } from "./types"
import { MAIN_NAVIGATION, getPageSurfaces } from "./navigation"
import { VitrineSections } from "./VitrineSections"
import { ThemeSections } from "./ThemeSections"
import { PagesAccordion } from "./PagesAccordion"

const ContentPage = () => {
  const [mode, setMode] = useState<ViewMode>("vitrine")
  const [schema, setSchema] = useState<Schema | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(true)

  // Carrega schema uma vez para o header saber as páginas
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
    loadSchema()
  }, [])

  const pageSurfaces = schema ? getPageSurfaces(schema) : []

  return (
    <Container className="flex flex-col gap-y-6 p-6">
      {/* Header Navigation */}
      <nav className="flex gap-x-2 border-b border-ui-border-base pb-4" aria-label="Modos de conteúdo">
        {MAIN_NAVIGATION.map((nav) => (
          <Button
            key={nav.id}
            variant={mode === nav.id ? "primary" : "secondary"}
            onClick={() => setMode(nav.id)}
            className="flex items-center gap-x-2"
            disabled={loadingSchema}
          >
            <nav.icon className="h-4 w-4" aria-hidden="true" />
            {nav.label}
          </Button>
        ))}
      </nav>

      {loadingSchema ? (
        <Container className="flex items-center justify-center h-64">
          <Text size="small" className="text-ui-fg-subtle">Carregando…</Text>
        </Container>
      ) : (
        <>
          {mode === "vitrine" && <VitrineSections schema={schema} />}
          {mode === "pages" && <PagesAccordion surfaces={pageSurfaces} />}
          {mode === "theme" && <ThemeSections schema={schema} />}
        </>
      )}
    </Container>
  )
}

export const config = defineRouteConfig()
export default ContentPage
