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
 * O formulário respeita a **ordem** do contrato: cada campo de conteúdo sai
 * na posição dele, e cada trilho de aparência (os campos que têm `group`)
 * sai logo abaixo do campo que ele veste — o `attachedTo` do contrato é a
 * âncora declarada disso, conferida por `scripts/check-contract-parity.mjs`.
 * É a ordem do array, e não um mapa montado aqui, que decide onde a fonte do
 * título aparece na tela: uma escolha de tema só faz sentido junto da
 * coisa que ela muda.
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

import { AppearanceRail } from "./appearance-controls"
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
  /** Papel da cor → hex, para a bolinha de cor. */
  palette?: Record<string, string>
  /** Papel da fonte → { family, stack }, para a prévia da fonte. */
  fonts?: Record<string, { family: string; stack: string }>
  /** Cores de fundo que o storefront trata como escuras. */
  darkTokens?: readonly string[]
}

/** Rótulo curto por tipo de seção, para a listagem. */
const TYPE_LABELS: Record<string, string> = {
  announcement: "Barra de anúncio",
  hero: "Hero",
  benefits: "Faixa de benefícios",
  collections: "Coleções em destaque",
  featured: "Peças em destaque",
  // O nome é o do item do menu, não o do protótipo: é este bloco que o
  // "Sobre" da navbar rola (a âncora é o `id` da seção, não o rótulo).
  editorial: "Sobre",
  instagram: "Instagram",
  // Cabeçalho e rodapé não são seções da home — aparecem em todas as
  // rotas, desenhados pelo layout —, mas viajam no mesmo payload. Sem
  // rótulo aqui a listagem mostraria o `type` cru.
  nav: "Cabeçalho",
  footer: "Rodapé",
}

/**
 * Uma linha do formulário: um campo de conteúdo solto, ou um trilho de
 * aparência (o grupo de campos que veste o campo anterior).
 */
type FormRow =
  | { kind: "field"; spec: FieldSpec }
  | { kind: "rail"; group: string; specs: FieldSpec[] }

/**
 * O trilho do fundo da seção.
 *
 * Espelha `APPEARANCE_GROUPS` do contrato (`backend/src/modules/content/
 * contract.ts`) e existe só para o aviso de fundo escuro: é o único trilho
 * onde uma escolha tem um efeito automático que o lojista não escolheu —
 * o texto do bloco vira claro (`appearanceVars`, no storefront). A guarda de
 * paridade confere que este rótulo é um dos trilhos do contrato, então
 * renomear o trilho no contrato não deixa o aviso apontando para o nada.
 */
const BACKGROUND_RAIL = "Fundo"

/**
 * Percorre os campos do contrato na ordem e devolve as linhas do formulário.
 *
 * É uma varredura sequencial, e não um agrupamento por tipo de campo, porque
 * a ordem é o que o contrato promete: o trilho "Títulos" vem logo depois do
 * campo que ele veste, e não numa seção "Aparência" no fim. O contrato
 * garante isso declarando os trilhos em ordem, no mesmo array (`attachedTo`
 * + a guarda de paridade), então aqui basta seguir.
 *
 * Um `rail` em andamento fecha quando o conteúdo volta ou o grupo muda; um
 * mesmo grupo aparecendo em dois trechos viraria dois trilhos com o mesmo
 * rótulo, que é o que a âncora do contrato existe para impedir.
 */
function toRows(specs: readonly FieldSpec[]): FormRow[] {
  const rows: FormRow[] = []

  for (const spec of specs) {
    const group = spec.group
    const last = rows[rows.length - 1]

    // Trilho em aberto: o campo é do mesmo grupo do último trilho empilhado.
    // Um campo de conteúdo no meio (por isso o `last.kind === "rail"`) fecha
    // o trilho — e um mesmo grupo voltando mais adiante viraria dois trilhos
    // de mesmo nome, que é o que a âncora do contrato existe para impedir.
    if (group && last?.kind === "rail" && last.group === group) {
      last.specs.push(spec)
      continue
    }

    if (group) {
      rows.push({ kind: "rail", group, specs: [spec] })
      continue
    }

    rows.push({ kind: "field", spec })
  }

  return rows
}

/**
 * O aviso do trilho, quando ele se aplica.
 *
 * Só o trilho do fundo tem aviso, e só quando a cor escolhida é uma das
 * escuras (`schema.darkTokens`): é a regra do storefront de legibilizar o
 * texto em off white quando o fundo é escuro e ninguém escolheu uma cor de
 * texto. Não é um campo para o lojista preencher — é a loja fazendo sozinha
 * algo que ele precisa saber que vai acontecer, porque escolher "Preto" e
 * ler o texto da seção em grafite na tela o faria desconfiar do CRM.
 *
 * Aviso que está sempre escrito vira ruído, então só aparece na escolha
 * escura.
 */
function railNote(
  row: Extract<FormRow, { kind: "rail" }>,
  draft: Record<string, unknown>,
  darkTokens?: readonly string[]
): string | undefined {
  if (row.group !== BACKGROUND_RAIL || !darkTokens?.length) {
    return undefined
  }

  const isDark = row.specs.some((spec) =>
    darkTokens.includes(String(draft[spec.name] ?? ""))
  )

  return isDark
    ? "Fundo escuro: o texto do bloco fica claro automaticamente, para não ficar ilegível. Escolher uma cor de texto tem efeito por cima."
    : undefined
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

  const setFields = (id: string, patch: Record<string, unknown>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  const setField = (id: string, name: string, value: unknown) => {
    setFields(id, { [name]: value })
  }

  /**
   * Devolve um trilho inteiro ao padrão do tema.
   *
   * O valor gravado é a opção vazia — o contrato já define `""` como
   * "segue o tema da loja" —, então restaurar não apaga o campo: grava a
   * escolha que não sobrescreve nada. Como no resto da página, a mudança
   * fica no rascunho até o "Salvar"; é o que permite conferir os campos
   * antes de publicar.
   *
   * Um botão por trilho, e não um só para a seção toda: voltar a fonte dos
   * títulos ao padrão não tem por que desfazer a cor de fundo que o lojista
   * escolheu a três linhas de distância.
   */
  const resetFields = (id: string, fields: readonly FieldSpec[]) => {
    setFields(id, Object.fromEntries(fields.map((field) => [field.name, ""])))
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
            Estas seções montam a página inicial, na ordem definida pelo campo
            “Ordem”. A aparência entra junto do campo que ela muda: em branco, a
            seção segue o tema da loja — inclusive quando o tema é sazonal.
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
                    {/* `#id` é a âncora que o menu usa: um Destino
                        `/#editorial` rola até esta seção. */}
                    #{section.id} · {section.type}
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
              <div className="flex flex-col gap-y-5 border-t border-ui-border-base p-4">
                {toRows(specs).map((row) => {
                  // Um campo de conteúdo e um campo de trilho se desenham do
                  // mesmo jeito: quem muda o desenho é o `kind`, que veio do
                  // contrato.
                  const field = (spec: FieldSpec) => (
                    <FieldInput
                      key={spec.name}
                      spec={spec}
                      value={draft[spec.name]}
                      onChange={(value) =>
                        setField(section.id, spec.name, value)
                      }
                      palette={schema?.palette}
                      fonts={schema?.fonts}
                    />
                  )

                  return row.kind === "field" ? (
                    field(row.spec)
                  ) : (
                    <AppearanceRail
                      key={`rail:${row.group}`}
                      title={row.group}
                      note={railNote(row, draft, schema?.darkTokens)}
                      onReset={() => resetFields(section.id, row.specs)}
                    >
                      {row.specs.map(field)}
                    </AppearanceRail>
                  )
                })}

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
