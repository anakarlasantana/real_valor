/**
 * O estado de UMA superfície de conteúdo (vitrine, página ou tema).
 * -------------------------------------------------------------------------
 * Um hook para as três abas porque o que muda entre elas é o conteúdo que a API
 * devolve, não o comportamento: a mesma lista de seções, os mesmos rascunhos, a
 * mesma ordem pendente e as mesmas portas de gravação (`POST`, `PATCH`,
 * `DELETE`, `POST /order`, `POST /restore`).
 *
 * O que ele **não** faz é gravar a cada tecla. O formulário edita o rascunho
 * (`update`), e o rascunho vira corpo só no `save` — o "Salvar" da barra de
 * alterações pendentes. A ordem é a mesma ideia com outra porta: as setas mexem
 * `pendingOrder` e quem publica é o `saveOrder` (uma requisição para a lista
 * inteira, como manda `POST /admin/content/order`).
 *
 * O corpo do `PATCH` é montado **dos campos do contrato**, e não do rascunho
 * cru: o rascunho carrega as colunas (`id`, `type`, `fixed`) e as referências
 * lidas (a curadoria, os chips), e a rota recusa o que não é campo do tipo.
 * `position` não entra nunca — quem manda na ordem é a lista.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "@medusajs/ui"

import type { CategoryRef } from "@conteudo/contract"
import type { OrderFaixa } from "@conteudo/order"

import { wireValue } from "../form-draft"
import type { Draft, Schema, Section } from "../types"

interface UseSurfaceSectionsOptions {
  /** Primeira pintura, quando o pai já carregou (o acordeão de páginas). */
  initialSections?: Section[]
  initialSchema?: Schema | null
}

export function useSurfaceSections(
  surfaceId: string,
  { initialSections = [], initialSchema = null }: UseSurfaceSectionsOptions = {}
) {
  const [sections, setSections] = useState<Section[]>(initialSections)
  const [schema, setSchema] = useState<Schema | null>(initialSchema)
  /** O catálogo de categorias do `list:category` — do catálogo, não do contrato. */
  const [categories, setCategories] = useState<readonly CategoryRef[]>([])
  /** A faixa da numeração (`{ first, step, reserved }`), como o servidor a manda. */
  const [order, setOrder] = useState<OrderFaixa | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  /** A ordem da vitrine **na tela**, ainda não publicada (`null` = a da loja). */
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null)
  /** Operação em andamento além do "Salvar" do formulário: criar, remover, ordem. */
  const [working, setWorking] = useState<string | null>(null)
  /** O id em gravação — o "Salvar" daquela seção entra em espera. */
  const [savingId, setSavingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/admin/content?surface=${encodeURIComponent(surfaceId)}`,
        { credentials: "include" }
      )
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.message ?? "Falha ao carregar o conteúdo.")
        return
      }

      const loaded: Section[] = json.sections ?? []
      setSections(loaded)
      setSchema(json.schema ?? null)
      setCategories(json.categories ?? [])
      setOrder(json.order ?? null)
      // O rascunho nasce do que está gravado: a seção chega **achatada**
      // (`toSection`, em `modules/content/view.ts`), então `{ ...section }` já é
      // o formulário inteiro — não há `data` aninhado para desfazer.
      setDrafts(
        Object.fromEntries(loaded.map((s) => [s.id, { ...s } as Draft]))
      )

      // A ordem pendente sobrevive a uma releitura que não mudou o conjunto de
      // seções: salvar um texto recarrega a lista, e descartar a ordem que o
      // lojista acabou de montar por causa disso seria perder trabalho sem
      // aviso. Um id que desapareceu sai da ordem, e uma seção criada entra no
      // fim — que é exatamente onde ela cabe (a posição da seção nova é decisão
      // do `POST /admin/content`).
      setPendingOrder((current) => {
        if (!current) return null
        const ids = new Set(loaded.map((s) => s.id))
        const kept = current.filter((id) => ids.has(id))
        const added = loaded.map((s) => s.id).filter((id) => !kept.includes(id))
        return [...kept, ...added]
      })
    } catch (error) {
      toast.error("Não foi possível carregar o conteúdo.")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [surfaceId])

  // Uma leitura por superfície. `initialSections` é primeira pintura, não a
  // verdade: as referências que só o payload traz (a faixa da ordem, o catálogo
  // de categorias) vêm daqui.
  useEffect(() => {
    void load()
  }, [load])

  /** A lista na ordem gravada: `position` é a casa da seção na loja. */
  const ordered = useMemo(
    () => [...sections].sort((a, b) => a.position - b.position),
    [sections]
  )

  /**
   * O cromo e a vitrine, separados pela **coluna** `fixed` — o que está gravado
   * —, e não por uma lista de tipos escrita aqui: a seção que a loja não
   * reordena é exatamente a que nasceu fixa (o seed/`Restaurar padrão` e o
   * `POST /admin/content` gravam a coluna a partir do tipo), então a tela não
   * tem como oferecer seta para o que a vitrine não move.
   */
  const chrome = useMemo(() => ordered.filter((s) => s.fixed), [ordered])
  const vitrine = useMemo(() => ordered.filter((s) => !s.fixed), [ordered])

  /** A vitrine na ordem que está na tela: a pendente, quando existe. */
  const shown = useMemo(() => {
    if (!pendingOrder) return vitrine
    const byId = new Map(vitrine.map((s) => [s.id, s]))
    return pendingOrder
      .map((id) => byId.get(id))
      .filter((section): section is Section => Boolean(section))
  }, [vitrine, pendingOrder])

  /**
   * A lista como ela aparece na tela: o bloco fixo primeiro, depois a vitrine.
   *
   * O bloco fixo vem antes porque as casas dele estão no começo da numeração —
   * 1, 2, 3 e 4, mais o rodapé em 10 (`FIXED_SECTION_POSITIONS`) — e a ordem dele
   * não há o que reordenar.
   */
  const rows = useMemo(() => [...chrome, ...shown], [chrome, shown])

  /**
   * Em que casa da vitrine cada seção está — o índice que as setas usam.
   *
   * Existe porque a lista da tela inclui o cromo: o índice do `map` de `rows`
   * não é o da vitrine, e a última seção da vitrine não é a última da lista.
   */
  const vitrineIndex = useMemo(
    () => new Map(shown.map((section, index) => [section.id, index])),
    [shown]
  )

  /**
   * A ordem pendente difere da que está na loja?
   *
   * Comparar (e não só "existe uma pendente") é o que faz a barra de aviso sumir
   * sozinha quando o lojista desfaz o movimento na mão: subir e descer a mesma
   * seção não é uma alteração a publicar, e um aviso que pede para salvar o que
   * já está salvo ensina o lojista a ignorar o aviso.
   */
  const orderDirty = useMemo(() => {
    if (!pendingOrder) return false
    const current = vitrine.map((s) => s.id)
    return (
      current.length !== pendingOrder.length ||
      pendingOrder.some((id, index) => current[index] !== id)
    )
  }, [pendingOrder, vitrine])

  /** Cria a seção e abre o formulário dela: criar é o começo de editar. */
  const create = useCallback(
    async (type: string, id?: string): Promise<boolean> => {
      if (!type) return false
      setWorking("create")

      try {
        const res = await fetch("/admin/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            type,
            // A superfície da aba: quem **decide** é a API (o bloco de tema mora
            // em `theme`, sempre), mas mandar o que a tela mostra deixa a
            // intenção explícita.
            surface: surfaceId,
            // Sem âncora, quem gera é o banco — e aí o link do menu (`/#…`) não
            // tem como apontar para a seção. Por isso o campo vem sugerido.
            ...(id?.trim() ? { id: id.trim() } : {}),
            // `position` não vai: quem põe a seção nova no FIM é a regra do
            // servidor (`nextPosition`, em `modules/content/order.ts`).
          }),
        })
        const json = await res.json()

        if (!res.ok) {
          toast.error(json.message ?? "Falha ao criar a seção.")
          return false
        }

        toast.success("Seção criada. Edite o conteúdo e salve.")
        setOpenId(json.section?.id ?? null)
        await load()

        return true
      } catch (error) {
        toast.error("Falha ao criar a seção.")
        console.error(error)

        return false
      } finally {
        setWorking(null)
      }
    },
    [surfaceId, load]
  )

  /**
   * Edita o **rascunho** — a tela, não o banco.
   *
   * Sem esta separação cada tecla seria um `PATCH`: N gravações, N avisos à loja
   * e uma seção publicada pela metade enquanto o lojista ainda escreve. Quem
   * grava é o `save`, e é ele quem sabe a hora.
   */
  const update = useCallback((id: string, patch: Record<string, unknown>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }, [])

  /** Devolve o formulário ao que está gravado (o "Descartar" da seção). */
  const discard = useCallback((section: Section) => {
    setDrafts((prev) => ({ ...prev, [section.id]: { ...section } }))
  }, [])

  /**
   * Grava o rascunho da seção (`PATCH /admin/content?id=…`).
   *
   * O corpo é montado **dos campos do contrato**: `enabled` (a coluna) e cada
   * campo do tipo, com o valor convertido por `wireValue` (os chips
   * `list:category` viajam como a lista de ids). O resto do rascunho — `id`,
   * `type`, `fixed`, a curadoria e os chips lidos — não vai: o que a tela mostra
   * não é o que a rota aceita. `position` **não** entra: quem manda na ordem é a
   * lista (setas + "Salvar ordem"), e mandar a posição daqui reescreveria a
   * ordem gravada com o número que o formulário leu quando abriu.
   */
  const save = useCallback(
    async (id: string) => {
      const draft = drafts[id] ?? {}
      const section = sections.find((s) => s.id === id)

      if (!section) return

      const specs = schema?.fields[section.type] ?? []
      const body: Record<string, unknown> = { enabled: draft.enabled }

      for (const spec of specs) {
        body[spec.name] = wireValue(spec.kind, draft[spec.name])
      }

      setSavingId(id)

      try {
        const res = await fetch(`/admin/content?id=${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        })
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
    },
    [drafts, sections, schema, load]
  )

  /**
   * Remove a seção, com confirmação.
   *
   * A confirmação é do navegador de propósito: não há desfazer (a linha sai do
   * banco) e recriar a seção não devolve o que havia nela — a seção nova nasce
   * com o conteúdo padrão do tipo.
   */
  const remove = useCallback(
    async (id: string) => {
      const section = sections.find((s) => s.id === id)
      const label = schema?.typeLabels?.[section?.type ?? ""] ?? section?.type ?? id

      if (
        !window.confirm(
          `Remover a seção "${label}" (#${id})? Não há como desfazer.`
        )
      ) {
        return
      }

      setWorking(id)

      try {
        const res = await fetch(`/admin/content?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "include",
        })
        const json = await res.json().catch(() => ({}))

        if (!res.ok) {
          toast.error(json.message ?? "Falha ao remover a seção.")
          return
        }

        toast.success("Seção removida.")
        setOpenId(null)
        await load()
      } catch (error) {
        toast.error("Falha ao remover a seção.")
        console.error(error)
      } finally {
        setWorking(null)
      }
    },
    [sections, schema, load]
  )

  /**
   * Recria as seções padrão que faltam.
   *
   * Dois casos reais: o banco novo — o CRM abre vazio e não há de onde copiar o
   * conteúdo padrão — e a seção apagada por engano, que volta de fábrica. Não
   * apaga nada: só cria o que não existe, então o clique é seguro para quem já
   * tem a vitrine montada. A superfície vai na **query** (`?surface=`), que é
   * como a rota a lê.
   */
  const restore = useCallback(
    async (label?: string) => {
      const surfaceLabel = label ?? surfaceId

      if (
        !window.confirm(
          `Criar o que estiver faltando do padrão de "${surfaceLabel}"? O que já existe não é alterado.`
        )
      ) {
        return
      }

      setWorking("restore")

      try {
        const res = await fetch(
          `/admin/content/restore?surface=${encodeURIComponent(surfaceId)}`,
          { method: "POST", credentials: "include" }
        )
        const json = await res.json().catch(() => ({}))

        if (!res.ok) {
          toast.error(json.message ?? "Falha ao restaurar o padrão.")
          return
        }

        const created: string[] = json.created ?? []

        toast.success(
          created.length
            ? `Criadas: ${created.join(", ")}.`
            : `Nada a restaurar em "${surfaceLabel}": o padrão já está no lugar.`
        )
        await load()
      } catch (error) {
        toast.error("Falha ao restaurar o padrão.")
        console.error(error)
      } finally {
        setWorking(null)
      }
    },
    [surfaceId, load]
  )

  /**
   * Move uma seção uma casa para cima ou para baixo — **na tela**.
   *
   * Não grava: a ordem é uma decisão da lista inteira, então ela é conferida
   * antes de virar verdade na loja. O clique reordena o estado local e acende a
   * barra de "ordem não salva"; quem grava é o `saveOrder`.
   *
   * A base é `shown` (a vitrine na ordem da tela), e não `rows`: o cromo não tem
   * ordem, então as setas nunca sugerem que o cabeçalho pode descer na página.
   * Movimento fora da faixa devolve o estado anterior — sem re-render.
   */
  const reorder = useCallback(
    (id: string, direction: -1 | 1) => {
      setPendingOrder((current) => {
        const base = current ?? vitrine.map((section) => section.id)
        const from = base.indexOf(id)
        const to = from + direction

        if (from < 0 || to < 0 || to >= base.length) {
          return current
        }

        const next = [...base]
        const [moved] = next.splice(from, 1)

        next.splice(to, 0, moved)

        return next
      })
    },
    [vitrine]
  )

  /**
   * Publica a ordem da vitrine: uma requisição, uma gravação, um aviso.
   *
   * O corpo é a vitrine inteira na ordem da tela — **só** a vitrine: o cromo não
   * tem ordem, e a rota recusa uma lista que o traga ou que não a traga inteira.
   * Quem renumera é o servidor (`POST /admin/content/order`, com a regra de
   * `modules/content/order.ts`).
   */
  const saveOrder = useCallback(async () => {
    if (!orderDirty || !pendingOrder) return

    setWorking("order")

    try {
      const res = await fetch("/admin/content/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          surface: surfaceId,
          ids: shown.map((section) => section.id),
        }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(json.message ?? "Falha ao salvar a ordem.")
        return
      }

      setPendingOrder(null)
      await load()
      toast.success("Ordem salva. A loja publica em segundos.")
    } catch (error) {
      toast.error("Falha ao salvar a ordem.")
      console.error(error)
    } finally {
      setWorking(null)
    }
  }, [orderDirty, pendingOrder, shown, surfaceId, load])

  return {
    // Estado
    schema,
    categories,
    order,
    drafts,
    openId,
    setOpenId,
    creating,
    setCreating,
    pendingOrder,
    setPendingOrder,
    working,
    savingId,
    loading,
    orderDirty,
    // A lista, como a tela a desenha
    rows,
    shown,
    vitrineIndex,
    // Ações
    load,
    create,
    update,
    discard,
    save,
    remove,
    restore,
    reorder,
    saveOrder,
  }
}
