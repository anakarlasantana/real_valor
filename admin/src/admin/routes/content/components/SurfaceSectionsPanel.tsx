/**
 * O painel de seções de UMA superfície (vitrine, tema ou página).
 * -------------------------------------------------------------------------
 * Junta o hook (`useSurfaceSections`), a linha (`SectionRow`), o diálogo
 * (`SectionCreator`) e a barra de ordem (`OrderDirtyBar`) — e é o único lugar
 * que decide os dois números que a linha mostra:
 *
 *   - o **numeral** que a seção vai ter depois de publicar a ordem pendente
 *     (`numeralFor`, a mesma conta do `applyOrder` no backend) e a casa na
 *     vitrine (`vitrineIndex`, que ignora o cromo);
 *   - o **índice** da vitrine (`place`) e o tamanho dela (`shown.length`), que é
 *     o que desabilita a seta na ponta.
 *
 * O cromo vem primeiro e fora das setas: `rows` é `chrome + shown`, e `movable`
 * sai da coluna `fixed`. Sem essa separação o cabeçalho aparecia no meio da
 * vitrine, e as setas ofereciam mover o que a loja não move.
 */
import { Button, Text } from "@medusajs/ui"

import { useSurfaceSections } from "../hooks/useSurfaceSections"
import { SectionRow } from "./SectionRow"
import { SectionCreator } from "./SectionCreator"
import { OrderDirtyBar } from "./OrderDirtyBar"
import { numeralFor } from "../lib/utils"
import type { SurfaceSectionsPanelProps } from "../lib/types"

export function SurfaceSectionsPanel({
  surfaceId,
  surface,
  initialSections = [],
  initialSchema = null,
  creating,
  setCreating,
  embedded = false,
}: SurfaceSectionsPanelProps) {
  const {
    rows,
    shown,
    vitrineIndex,
    drafts,
    schema,
    categories,
    order,
    orderDirty,
    working,
    savingId,
    openId,
    setOpenId,
    load,
    create,
    update,
    discard,
    save,
    remove,
    restore,
    reorder,
    saveOrder,
    setPendingOrder,
    creating: localCreating,
    setCreating: setLocalCreating,
  } = useSurfaceSections(surfaceId, { initialSections, initialSchema })

  // Quem manda no diálogo pode ser este painel (as abas da vitrine e do tema) ou
  // o pai, quando ele já tem o botão no cabeçalho (o acordeão de páginas).
  const isCreating = creating ?? localCreating
  const setCreatingValue = setCreating ?? setLocalCreating

  const canUse = working === null

  return (
    <div className="flex flex-col gap-y-4">
      {/* Toolbar da superfície. O cabeçalho é do painel quando ele não está
          embutido: dentro do acordeão, o `label` da página já apareceu. */}
      <div className="flex items-center justify-between gap-x-4">
        <div className="flex items-center gap-x-2">
          {!embedded && (
            <Text size="small" className="text-ui-fg-subtle">
              Seções de <strong>{surface.label}</strong>
            </Text>
          )}
        </div>
        <div className="flex items-center gap-x-2">
          <Button
            size="small"
            variant={isCreating ? "secondary" : "primary"}
            disabled={!canUse}
            onClick={() => setCreatingValue(!isCreating)}
          >
            {isCreating ? "Fechar" : `Nova ${surface.blockLabel ?? "seção"}`}
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => void restore(surface.label)}
            isLoading={working === "restore"}
            disabled={working !== null && working !== "restore"}
          >
            Restaurar padrão
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => void load()}
            disabled={working !== null}
          >
            Recarregar
          </Button>
        </div>
      </div>

      {/* O diálogo de criação, já com a superfície e a lista da aba: os tipos são
          os dela, e os únicos que já existem saem da lista. */}
      <SectionCreator
        surface={surface}
        schema={schema}
        sections={rows}
        isOpen={isCreating}
        onClose={() => setCreatingValue(false)}
        onCreate={create}
      />

      {rows.map((section) => {
        const draft = drafts[section.id] ?? {}
        const isOpen = openId === section.id
        // Só as seções ordenáveis têm ordem: a fixa é o **bloco ancorado** — o
        // cromo do site, que a moldura desenha em todas as rotas, mais a abertura
        // da home —, e ela mora sempre na mesma casa. Quem responde é a coluna
        // (`fixed`), não o tipo, pelo mesmo motivo que a lista se separa por ela.
        const movable = !section.fixed
        const place = vitrineIndex.get(section.id) ?? 0
        // O numeral da seção: a casa gravada — ou a que ela **vai** ter. Com a
        // lista já mexida na tela e ainda não publicada, o número no banco não
        // corresponde mais ao que se vê, e um numeral que discorda da ordem
        // visível é pior do que nenhum. A previsão sai da faixa que o servidor
        // manda como dado (`order`), pulando as casas ancoradas (`numeralFor`), e
        // é a mesma numeração que o "Salvar ordem" vai gravar. Sem a faixa no
        // payload, fica o numeral gravado.
        const numeral =
          orderDirty && order ? numeralFor(place, order) : section.position

        return (
          <SectionRow
            key={section.id}
            section={section}
            draft={draft}
            schema={schema}
            surface={surface}
            categories={categories}
            numeral={numeral}
            movable={movable}
            isOpen={isOpen}
            place={place}
            shownLength={shown.length}
            working={working}
            savingId={savingId}
            onToggleOpen={setOpenId}
            onUpdate={update}
            onDiscard={discard}
            onSave={save}
            onRemove={remove}
            onMove={reorder}
          />
        )
      })}

      {/* A barra só aparece quando há diferença real entre a tela e a loja: subir
          e descer a mesma seção não é alteração a publicar. */}
      {orderDirty && (
        <OrderDirtyBar
          onSave={saveOrder}
          onDiscard={() => setPendingOrder(null)}
          working={working}
        />
      )}
    </div>
  )
}
