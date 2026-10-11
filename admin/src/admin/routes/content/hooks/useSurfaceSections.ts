/**
 * Hook genérico para gerenciar seções de UMA superfície (vitrine, página ou tema).
 *
 * Encapsula toda a lógica de:
 * - Carregamento (GET /admin/content?surface=...)
 * - Criação (POST /admin/content)
 * - Atualização (PATCH /admin/content?id=...)
 * - Remoção (DELETE /admin/content?id=...)
 * - Reordenação (POST /admin/content/order)
 * - Restauração padrão (POST /admin/content/restore)
 * - Gerenciamento de rascunhos (form-draft)
 * - Ordem pendente (drag-drop antes de salvar)
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "@medusajs/ui"
import { creatableTypes, freeAnchor, numeralFor } from "../utils"
import type { ContentSurfaceSpec, Schema, OrderFaixa, Section } from "@conteudo/contract"
import type { SurfaceState, Draft } from "../types"
import { isDirty } from "./form-draft"

interface UseSurfaceSectionsOptions {
  surfaceId: string
  initialSections?: Section[]
  initialSchema?: Schema | null
}

export function useSurfaceSections(
  surfaceId: string,
  options: UseSurfaceSectionsOptions
) {
  const { initialSections = [], initialSchema = null } = options

  // Estado principal
  const [sections, setSections] = useState<Section[]>(initialSections)
  const [schema, setSchema] = useState<Schema | null>(initialSchema)
  const [order, setOrder] = useState<OrderFaixa | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newType, setNewType] = useState("")
  const [newId, setNewId] = useState("")
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  // Superfície atual (para creatableTypes)
  const currentSurface = useMemo(
    () => schema?.surfaces?.find((s) => s.id === surfaceId) ?? null,
    [schema, surfaceId]
  )

// Tipos que podem ser criados nesta superfície (exclui singletons já presentes)
  const types = useMemo(
    () => (schema ? creatableTypes(schema, sections, currentSurface) : []),
    [schema, sections, currentSurface]
  )

  // Sugere primeiro tipo e anchor livre quando schema/sections mudam
  useEffect(() => {
    if (!schema || newType) return
    const first = creatableTypes(schema, sections, currentSurface)[0] ?? ""
    setNewType(first)
    setNewId(first ? freeAnchor(first, sections) : "")
  }, [schema, sections, newType, currentSurface])

  // Carrega seções + schema da API
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/admin/content?surface=${encodeURIComponent(surfaceId)}`, {
        credentials: "include",
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.message ?? "Falha ao carregar o conteúdo.")
        return
      }

      const loaded: Section[] = json.sections ?? []
      setSections(loaded)
      setSchema(json.schema ?? null)
      setOrder(json.order ?? null)
      setDrafts(
        Object.fromEntries(loaded.map((s) => [s.id, { ...s } as Draft]))
      )

      // Preserva ordem pendente se as seções não mudaram drasticamente
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
    }
  }, [surfaceId])

  // Carrega inicial se há dados iniciais
  useEffect(() => {
    if (initialSections.length === 0 && initialSchema === null) {
      load()
    }
  }, [initialSections.length, initialSchema, load])

  // Cria nova seção
  const create = useCallback(async () => {
    if (!newType) return
    setWorking("create")
    try {
      const res = await fetch("/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: newType,
          surface: surfaceId,
          ...(newId.trim() ? { id: newId.trim() } : {}),
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.message ?? "Falha ao criar a seção.")
        return
      }

      toast.success("Seção criada. Edite o conteúdo e salve.")
      setCreating(false)
      setNewType("")
      setNewId("")
      setOpenId(json.section?.id ?? null)
      await load()
    } catch (error) {
      toast.error("Falha ao criar a seção.")
      console.error(error)
    } finally {
      setWorking(null)
    }
  }, [newType, newId, surfaceId, load])

  // Atualiza dados de uma seção
  const update = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      const draft = drafts[id] ?? {}
      const merged = { ...draft, ...data }
      setDrafts((prev) => ({ ...prev, [id]: merged }))
    },
    [drafts]
  )

  // Remove uma seção
  const remove = useCallback(async (id: string) => {
    if (!window.confirm("Remover esta seção? A ação não pode ser desfeita.")) return
    setWorking(id)
    let success = false
    try {
      const res = await fetch(`/admin/content?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.message ?? "Falha ao remover a seção.")
      } else {
        toast.success("Seção removida.")
        setOpenId(null)
        await load()
        success = true
      }
    } catch (error) {
      toast.error("Falha ao remover a seção.")
      console.error(error)
    } finally {
      setWorking(null)
    }
  }, [load])

  // Restaura padrão da superfície
  const restore = useCallback(async () => {
    const label = currentSurface?.label ?? surfaceId
    if (
      !window.confirm(
        `Criar o que estiver faltando do padrão de "${label}"? O que já existe não é alterado.`
      )
    ) {
      return
    }
    setWorking("restore")
    try {
      const res = await fetch("/admin/content/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ surface: surfaceId }),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.message ?? "Falha ao restaurar o padrão.")
        return
      }

      const created = json.created ?? []
      toast.success(
        created.length
          ? `Criadas: ${created.join(", ")}.`
          : `Nada a restaurar em "${label}": o padrão já está no lugar.`
      )
      await load()
    } catch (error) {
      toast.error("Falha ao restaurar o padrão.")
      console.error(error)
    } finally {
      setWorking(null)
    }
  }, [currentSurface, surfaceId, load])

  // Reordena localmente (drag-drop)
  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setPendingOrder((current) => {
      const base = current ?? sections.map((s) => s.id)
      const [moved] = base.splice(fromIndex, 1)
      base.splice(toIndex, 0, moved)
      return base
    })
  }, [sections])

  // Salva ordem no servidor
  const saveOrder = useCallback(async () => {
    if (!pendingOrder) return
    setWorking("order")
    try {
      const res = await fetch("/admin/content/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ surface: surfaceId, ids: pendingOrder }),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.message ?? "Falha ao salvar a ordem.")
        return
      }

      toast.success("Ordem salva.")
      setPendingOrder(null)
      await load()
    } catch (error) {
      toast.error("Falha ao salvar a ordem.")
      console.error(error)
    } finally {
      setWorking(null)
    }
  }, [pendingOrder, surfaceId, load])

  // Ordem "suja" (diferente da salva)
  const orderDirty = pendingOrder !== null

  return {
    // Estado
    sections,
    schema,
    order,
    drafts,
    openId,
    setOpenId,
    creating,
    setCreating,
    newType,
    setNewType,
    newId,
    setNewId,
    pendingOrder,
    setPendingOrder,
    working,
    orderDirty,
    // Ações
    load,
    create,
    update,
    remove,
    restore,
    saveOrder,
    reorder,
  }
}