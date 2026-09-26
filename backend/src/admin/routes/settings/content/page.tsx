/**
 * Página custom do admin: Conteúdo da vitrine.
 *
 * A convenção é o nome do diretório: tudo em `src/admin/routes/**` vira
 * rota no dashboard, com a URL derivada do caminho do arquivo. Por isso
 * a página abre em `/app/settings/content`.
 *
 * A lista de campos de cada tipo NÃO é reescrita aqui: vem do
 * `schema.fields` que `GET /admin/content` devolve, gerado a partir de
 * `backend/src/modules/content/contract.ts`. Adicionar um campo no
 * contrato já o faz aparecer no formulário.
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { SquaresPlus } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

import { FieldInput, type FieldSpec } from "./field-input"

type Section = {
  id: string
  type: string
  enabled: boolean
  position: number
  [key: string]: unknown
}

type Schema = {
  types: readonly string[]
  fields: Record<string, readonly FieldSpec[]>
}

/** Rótulo curto por tipo de seção, para a listagem. */
const TYPE_LABELS: Record<string, string> = {
  announcement: "Barra de anúncio",
  hero: "Hero",
  benefits: "Faixa de benefícios",
  collections: "Coleções em destaque",
  featured: "Peças em destaque",
  editorial: "Bloco editorial",
  instagram: "Instagram",
}

const ContentPage = () => {
  const [sections, setSections] = useState<Section[]>([])
  const [schema, setSchema] = useState<Schema | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>(
    {}
  )
  const [openId, setOpenId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/admin/content", { credentials: "include" })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.message ?? "Falha ao carregar o conteúdo.")
        return
      }

      const loaded: Section[] = json.sections ?? []
      setSections(loaded)
      setSchema(json.schema ?? null)
      setDrafts(
        Object.fromEntries(
          loaded.map((s) => [s.id, { ...s } as Record<string, unknown>])
        )
      )
    } catch (error) {
      toast.error("Não foi possível carregar o conteúdo.")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const ordered = useMemo(
    () => [...sections].sort((a, b) => a.position - b.position),
    [sections]
  )

  const setField = (id: string, name: string, value: unknown) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [name]: value } }))
  }

  const save = async (section: Section) => {
    setSavingId(section.id)

    try {
      const draft = drafts[section.id] ?? {}
      const specs = schema?.fields[section.type] ?? []

      // `id` e `type` são imutáveis: só colunas + campos de `data` vão
      // no corpo. A rota admin rejeita campo desconhecido.
      const body: Record<string, unknown> = {
        enabled: draft.enabled,
        position: draft.position,
      }
      for (const spec of specs) {
        body[spec.name] = draft[spec.name]
      }

      const res = await fetch(
        `/admin/content?id=${encodeURIComponent(section.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        }
      )
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.message ?? "Falha ao salvar.")
        return
      }

      toast.success("Conteúdo salvo.")
      await load()
    } catch (error) {
      toast.error("Falha ao salvar.")
      console.error(error)
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <Container>
        <Text size="small">Carregando conteúdo…</Text>
      </Container>
    )
  }

  return (
    <Container className="flex flex-col gap-y-4">
      <div className="flex items-start justify-between">
        <div>
          <Heading level="h1">Conteúdo da vitrine</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Estas seções montam a página inicial, na ordem definida pelo
            campo “Ordem”.
          </Text>
        </div>
        <Button variant="secondary" size="small" onClick={load}>
          Recarregar
        </Button>
      </div>

      {ordered.map((section) => {
        const draft = drafts[section.id] ?? {}
        const specs = schema?.fields[section.type] ?? []
        const isOpen = openId === section.id

        return (
          <Container key={section.id} className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-x-4 p-4">
              <div className="flex items-center gap-x-3">
                <Badge size="2xsmall">{section.position}</Badge>
                <div>
                  <Text weight="plus" size="small">
                    {TYPE_LABELS[section.type] ?? section.type}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {section.id} · {section.type}
                  </Text>
                </div>
              </div>

              <div className="flex items-center gap-x-3">
                <Badge
                  size="2xsmall"
                  color={section.enabled ? "green" : "grey"}
                >
                  {section.enabled ? "Visível" : "Oculta"}
                </Badge>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setOpenId(isOpen ? null : section.id)}
                >
                  {isOpen ? "Fechar" : "Editar"}
                </Button>
              </div>
            </div>

            {isOpen && (
              <div className="flex flex-col gap-y-4 border-t border-ui-border-base p-4">
                {specs.map((spec) => (
                  <FieldInput
                    key={spec.name}
                    spec={spec}
                    value={draft[spec.name]}
                    onChange={(value) => setField(section.id, spec.name, value)}
                  />
                ))}

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-y-2">
                    <Label size="small" weight="plus">
                      Ordem
                    </Label>
                    <Input
                      type="number"
                      value={String(draft.position ?? 0)}
                      onChange={(e) =>
                        setField(section.id, "position", Number(e.target.value))
                      }
                    />
                  </div>

                  <div className="flex items-center gap-x-3 pt-6">
                    <Switch
                      checked={Boolean(draft.enabled)}
                      onCheckedChange={(checked) =>
                        setField(section.id, "enabled", checked)
                      }
                    />
                    <Label size="small" weight="plus">
                      Visível na loja
                    </Label>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="small"
                    isLoading={savingId === section.id}
                    onClick={() => save(section)}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            )}
          </Container>
        )
      })}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Conteúdo da vitrine",
  icon: SquaresPlus,
})

export default ContentPage
