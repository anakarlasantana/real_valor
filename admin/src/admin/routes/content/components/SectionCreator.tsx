/**
 * O diálogo "Nova seção" — escolhe o tipo e a âncora, e cria na superfície da aba.
 * -------------------------------------------------------------------------
 * O diálogo é **burro** de propósito: quem cria é o `onCreate(type, id)` que o
 * painel passa (o `create` do `useSurfaceSections`) e quem fecha é o `onClose`.
 * Sem isso o diálogo teria a própria cópia do `POST /admin/content` — uma segunda
 * resposta para "como se cria uma seção", que é exatamente o que a tela
 * monolítica criava antes de ser dividida.
 *
 * A lista de tipos sai de `creatableTypes` (`../lib/utils`), com a superfície da aba:
 * o diálogo do tema oferece as estações, o da vitrine oferece as seções, e os
 * tipos únicos que já existem somem da lista porque a API recusaria o segundo.
 */
import { Plus } from "@medusajs/icons"
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Text,
} from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

import { creatableTypes, freeAnchor } from "../lib/utils"
import type { SectionCreatorProps } from "../lib/types"

export function SectionCreator({
  surface,
  schema,
  sections,
  isOpen,
  onClose,
  onCreate,
}: SectionCreatorProps) {
  const [newType, setNewType] = useState("")
  const [newId, setNewId] = useState("")
  const [loading, setLoading] = useState(false)
  /** A sugestão já foi semeada nesta abertura? (ver o efeito abaixo) */
  const [seeded, setSeeded] = useState(false)

  const types = schema ? creatableTypes(schema, sections, surface) : []

  /**
   * O tipo inicial e a âncora sugerida, uma vez por abertura.
   *
   * Só fazem sentido depois que o schema chegou: antes disso a lista está vazia e
   * o `Select` não teria onde pousar. A semente é uma por abertura (o `seeded`)
   * porque re-sugerir a cada mudança da lista apagaria o que o lojista acabou de
   * digitar na âncora.
   */
  useEffect(() => {
    if (!isOpen) {
      setSeeded(false)
      return
    }

    if (seeded) return

    const first = schema
      ? (creatableTypes(schema, sections, surface)[0] ?? "")
      : ""

    setNewType(first)
    setNewId(first ? freeAnchor(first, sections) : "")
    setSeeded(true)
  }, [isOpen, seeded, schema, sections, surface])

  /** Trocar o tipo re-sugere a âncora livre: a antiga era do tipo anterior. */
  const pickType = useCallback(
    (type: string) => {
      setNewType(type)
      setNewId(freeAnchor(type, sections))
    },
    [sections],
  )

  const handleCreate = useCallback(async () => {
    if (!newType) return

    setLoading(true)

    try {
      // Quem fecha é o sucesso: uma criação recusada pela API (âncora repetida,
      // por exemplo) deixa o diálogo aberto com o que foi digitado.
      if (await onCreate(newType, newId.trim() || undefined)) {
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }, [newType, newId, onCreate, onClose])

  if (!isOpen) return null

  return (
    <Container className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Container className="relative w-full max-w-md rounded-lg bg-ui-bg-base p-6 shadow-xl">
        <Heading level="h2" className="mb-4">
          Nova {surface.blockLabel ?? "seção"}
        </Heading>
        <Text size="small" className="mb-4 text-ui-fg-subtle">
          A {surface.blockLabel ?? "seção"} nasce com o conteúdo padrão do tipo
          e entra no fim da lista: crie, edite e salve.
        </Text>

        <div className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Tipo
            </Label>
            <Select
              value={newType}
              onValueChange={pickType}
              disabled={types.length === 0}
            >
              <Select.Trigger aria-label="Tipo">
                <Select.Value placeholder="Tipo" />
              </Select.Trigger>
              {/*
                O `z-[60]` não é enfeite: as opções do Radix nascem num **portal**
                (`document.body`), com `z-index: auto` — quem diz o valor é o
                `Select.Content`, e o wrapper `[data-radix-popper-content-wrapper]`
                copia o computado dele (react-popper). O diálogo, por sua vez, é um
                `fixed inset-0 z-50` montado dentro do painel: sem um z-index
                próprio, a lista fica **atrás** do cartão e o clique em "Tipo"
                parece não fazer nada — as opções existem no DOM, mas ninguém as
                vê. Um passo acima do modal resolve (e segue abaixo dos avisos do
                dashboard, que moram mais alto).
              */}
              <Select.Content className="z-[60]">
                {types.map((type) => (
                  <Select.Item key={type} value={type}>
                    {schema?.typeLabels?.[type] ?? type}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Âncora (id da {surface.blockLabel ?? "seção"})
            </Label>
            <Input
              value={newId}
              placeholder="hero"
              onChange={(e) => setNewId(e.target.value)}
              disabled={!newType}
            />
            <Text size="xsmall" className="text-ui-fg-subtle">
              É o id da seção e o destino que o menu usa (ex.: /#hero):
              minúsculas, números e hífen. Já vem sugerida livre.
            </Text>
          </div>

          <div className="flex justify-end gap-x-2 pt-2">
            <Button variant="secondary" size="small" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              size="small"
              isLoading={loading}
              disabled={!newType}
              onClick={() => void handleCreate()}
            >
              <Plus /> Criar {surface.blockLabel ?? "seção"}
            </Button>
          </div>
        </div>
      </Container>
    </Container>
  )
}
