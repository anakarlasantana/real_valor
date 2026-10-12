/**
 * A barra "Ordem alterada — ainda não salva", com Salvar/Descartar.
 * -------------------------------------------------------------------------
 * Componente genérico: a vitrine, o tema e cada página usam a mesma barra, porque
 * a ordem pendente é a mesma ideia nas três — a lista já mexida na tela e ainda
 * não publicada. Quem grava é o `saveOrder` do hook (uma requisição para a lista
 * inteira, `POST /admin/content/order`).
 */
import { Button, Container, Text } from "@medusajs/ui"

import type { OrderDirtyBarProps } from "./types"

export function OrderDirtyBar({
  onSave,
  onDiscard,
  working,
}: OrderDirtyBarProps) {
  return (
    <Container className="my-4 flex items-center justify-between gap-x-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4">
      <div>
        <Text size="small" weight="plus">
          Ordem alterada — ainda não salva
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          A loja continua mostrando a ordem anterior até você salvar. As demais
          edições desta tela não dependem disto.
        </Text>
      </div>
      <div className="flex shrink-0 items-center gap-x-2">
        <Button
          variant="secondary"
          size="small"
          disabled={working !== null}
          onClick={onDiscard}
        >
          Descartar
        </Button>
        <Button
          size="small"
          isLoading={working === "order"}
          disabled={working !== null && working !== "order"}
          onClick={() => void onSave()}
        >
          Salvar ordem
        </Button>
      </div>
    </Container>
  )
}
