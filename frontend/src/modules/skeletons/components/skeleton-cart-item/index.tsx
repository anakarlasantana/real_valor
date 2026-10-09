import { Table } from "@medusajs/ui"

/**
 * A linha da sacola em esqueleto.
 *
 * A caixa da foto **não tem moldura** — ela era `w-24 h-24 p-4 rounded-large`,
 * que é a moldura que o `Thumbnail` usava (off-white da superfície, respiro de
 * 1rem e raio grande) e que o redesenho tirou de todos os lugares em que a loja
 * mostra uma peça. O esqueleto não pode prometer a moldura que a peça não traz:
 * quem chega depois entra numa caixa de outro tamanho e a linha pula.
 *
 * A caixa é a do item de verdade: `w-16` (a célula) com a foto 1/1 dentro, que é
 * o que `size="square"` desenha (ver `thumbnail/index.tsx`).
 */
const SkeletonCartItem = () => {
  return (
    <Table.Row className="w-full m-4">
      <Table.Cell className="!pl-0 p-4 w-24">
        <div className="flex w-16">
          <div className="w-full aspect-[1/1] bg-gray-100 animate-pulse" />
        </div>
      </Table.Cell>
      <Table.Cell className="text-left">
        <div className="flex flex-col gap-y-2">
          <div className="w-32 h-4 bg-gray-200 animate-pulse" />
          <div className="w-24 h-4 bg-gray-200 animate-pulse" />
        </div>
      </Table.Cell>
      <Table.Cell>
        <div className="flex gap-2 items-center">
          <div className="w-6 h-8 bg-gray-200 animate-pulse" />
          <div className="w-14 h-10 bg-gray-200 animate-pulse" />
        </div>
      </Table.Cell>
      <Table.Cell>
        <div className="flex gap-2">
          <div className="w-12 h-6 bg-gray-200 animate-pulse" />
        </div>
      </Table.Cell>
      <Table.Cell className="!pr-0 text-right">
        <div className="flex gap-2 justify-end">
          <div className="w-12 h-6 bg-gray-200 animate-pulse" />
        </div>
      </Table.Cell>
    </Table.Row>
  )
}

export default SkeletonCartItem
