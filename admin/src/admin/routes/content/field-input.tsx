/**
 * Renderizador de campo do editor de conteúdo.
 *
 * Um ramo por `FieldKind`. Os campos vêm do `schema.fields` que a API
 * admin devolve — gerado a partir de
 * `backend/src/modules/content/contract.ts` —, então adicionar um campo
 * no contrato faz ele aparecer aqui sem mexer neste arquivo.
 *
 * Nada aqui é espelhado do contrato, nem mesmo os itens de lista: o
 * `schema` traz `fields` (os campos de cada seção) e `itemFields` (os campos
 * de cada item de lista, com as opções e a tradução delas), e os dois saem de
 * `backend/src/modules/content/contract.ts`. Um campo dentro de um item é uma
 * linha no `ITEM_FIELDS` do contrato — não uma edição neste arquivo. Quem lê
 * `group` é a página, que monta os trilhos de aparência.
 *
 * Os dois `kind` de aparência (`color`, `font`) têm ramo aqui, mas quem os
 * desenha é o `appearance-controls.tsx`: bolinha de cor com tooltip e lista
 * de fontes com prévia. Este arquivo só passa o campo adiante, com a paleta
 * e as fontes que vieram no `schema` — o resto dos `kind` é formulário
 * comum.
 */
import { Button, Input, Label, Text, Textarea } from "@medusajs/ui"
import { ArrowDownMini, ArrowUpMini } from "@medusajs/icons"
import { useLayoutEffect, useRef, type ReactNode } from "react"

import {
  ColorPicker,
  FontPicker,
  type Fonts,
  type Palette,
} from "./appearance-controls"
import { parseTextList } from "./form-draft"
import { ImageInput } from "./image-input"
import { itemSummary, move } from "./list-order"
import { markExample, toggleMark, type MarkSelection } from "./markdown-bar"

/**
 * Os tipos do campo vem do **contrato**, não são declarados aqui.
 *
 * O painel é outro pacote (ele roda no navegador, servido pelo Medusa) e por
 * isso o *dado* do formulário chega pelo `schema` da API. Mas o *tipo* é
 * conhecimento de compilação e pode ser importado: `import type` desaparece no
 * build, então não há dependência de runtime nem de empacotamento.
 *
 * O espelho existia porque a diferença de pacote parecia exigir cópia. Com a
 * importação, um campo novo no contrato é erro de compilação aqui, e não um
 * item que some da tela em silêncio — que é o defeito que a guarda de paridade
 * procurava com texto.
 *
 * O `import type` vem pelo alias `@conteudo/*` (`admin/tsconfig.json`), que aponta
 * para o módulo do conteúdo no backend — o vínculo tem nome em vez de cinco
 * níveis de `..` (ver docs/plano-centralizacao.md, R2).
 */
import type {
  CategoryRef,
  FieldKind,
  FieldSpec,
  ItemFieldSpec,
  ItemFields,
  MarkdownMark,
} from "@conteudo/contract"

export type { FieldKind, FieldSpec, ItemFieldSpec, ItemFields }

/**
 * Os `kind` que este editor sabe desenhar.
 *
 * `list:${string}` cobre todos os `list:*` de uma vez, porque caem no mesmo
 * ramo (`spec.kind.startsWith("list:")`); `text` cobre o ramo padrão, que é o
 * input simples. Os demais têm ramo próprio.
 */
type HandledKind =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "image"
  | "color"
  | "font"
  // Cor **literal** (`#RRGGBB`): a paleta da estação. Não confundir com o
  // `color` acima — ali o valor é o **papel** ("dourado") e o tema resolve o
  // hex; aqui o valor **é** o hex, e por isso o editor é uma roda de cores com
  // o texto ao lado (o `pattern` do contrato cobra o formato, e um campo em
  // branco significa "herda o tema padrão").
  | "hex"
  // Texto **formatado** (o `prose`): a caixa de texto com a barra de marcas
  // acima, alimentada pelo `schema.markdownMarks` (`MARKDOWN_MARKS` no
  // contrato). O valor continua sendo texto — o que o botão insere são as
  // marcas, e quem as interpreta é o render da loja.
  | "markdown"
  | "list:text"
  // Lista de textos formatados (as linhas de uma lista do `prose`): uma caixa
  // com barra por item. Como o `list:text`, **sem** sub-formulário — e por isso
  // sem entrada em `ITEM_FIELDS`: o ramo genérico dos `list:*` desenharia um
  // cartão de item vazio no lugar da caixa.
  | "list:markdown"
  // Referência ao catálogo: a lista de ids de categoria que vira chip na
  // vitrine. Tem ramo próprio (`CategoryChipsInput`) porque o valor não é texto
  // nem objeto editável — é uma escolha dentro do catálogo, que chega pelo
  // payload em `categories`.
  | "list:category"
  | `list:${string}`

/**
 * **A exaustividade é do compilador.**
 *
 * Se o contrato ganhar um `kind` que este editor não desenha, `UNHANDLED_KINDS`
 * deixa de ser `true` e o `tsc` reprova — com o nome do `kind` na mensagem. É o
 * que substitui as cinco asserções "X tem ramo no FieldInput", que faziam a
 * mesma coisa em texto e mais tarde: quem descobrisse o `kind` novo era o
 * `make check`, ou seja, depois de a mudança já estar no código.
 *
 * O `kind` novo cai no ramo de texto, que é o fallback: o campo **aparece** e
 * é editável (uma caixa de texto) — degradar assim é melhor do que sumir —,
 * mas o erro de compilação impede de deixar isso passar em silêncio.
 */
export type UnhandledKind = Exclude<FieldKind, HandledKind>
export const UNHANDLED_KINDS: [UnhandledKind] extends [never]
  ? true
  : UnhandledKind = true

/**
 * Editor de uma lista de objetos (itens, coleções, imagens, links).
 *
 * Os campos de dentro do item não são decididos aqui: vêm de
 * `schema.itemFields` (`itemFields[kind]`), com as opções e a tradução. Um
 * campo novo dentro de um item é uma linha no `ITEM_FIELDS` do contrato.
 *
 * É recursivo de propósito: um item pode conter outra lista — a coluna do
 * rodapé (`list:column`) guarda os links dela —, então o mesmo componente
 * desenha os níveis internos em vez de um ramo por profundidade. O
 * `addLabel` existe para o botão do nível de dentro não repetir
 * "Adicionar item" logo abaixo do rótulo "Links".
 *
 * O cabeçalho de cada item diz **o que ele é** (`Item 3 · Vestidos de festa`) e
 * é onde a ordem se mexe: as setas trocam o item com o vizinho, como nos chips
 * de categoria. As duas coisas saem de `list-order.ts` (`itemSummary`, `move`),
 * com teste próprio — são regra, não desenho, e a lista de itens é o campo em
 * que o lojista passa mais tempo.
 */
function ObjectListInput({
  kind,
  itemFields,
  value,
  onChange,
  marks,
  addLabel = "Adicionar item",
}: {
  kind: FieldKind
  itemFields: ItemFields
  value: unknown
  onChange: (value: unknown) => void
  /** As marcas do texto formatado (`schema.markdownMarks`) — o item pode ter campo `markdown`. */
  marks: readonly MarkdownMark[]
  addLabel?: string
}) {
  const fields = itemFields[kind] ?? []
  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : []

  // O que cada item diz de si mesmo no cabeçalho (`list-order.ts`): é o que faz
  // a lista ser navegável sem abrir os itens um a um.
  const summaries = items.map((item) => itemSummary(fields, item))

  const update = (index: number, name: string, next: unknown) => {
    onChange(
      items.map((item, i) => (i === index ? { ...item, [name]: next } : item))
    )
  }

  return (
    <div className="flex flex-col gap-y-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="flex flex-col gap-y-3 rounded-md border border-ui-border-base p-3"
        >
          <div className="flex items-center justify-between gap-x-2">
            <div className="flex min-w-0 flex-1 items-baseline gap-x-2">
              <Text size="xsmall" weight="plus" className="whitespace-nowrap">
                Item {index + 1}
              </Text>
              {summaries[index] && (
                <Text size="xsmall" className="min-w-0 truncate text-ui-fg-subtle">
                  {summaries[index]}
                </Text>
              )}
            </div>

            <div className="flex flex-none items-center gap-x-1">
              {/* A ordem é da lista: a posição do item é o `position` que a API
                  grava, e as setas são o jeito de mexer nela — as mesmas do
                  seletor de categorias, que já funcionava assim. */}
              <Button
                variant="transparent"
                size="small"
                disabled={index === 0}
                aria-label={`Mover o item ${index + 1} para cima`}
                onClick={() => onChange(move(items, index, -1))}
              >
                <ArrowUpMini />
              </Button>
              <Button
                variant="transparent"
                size="small"
                disabled={index === items.length - 1}
                aria-label={`Mover o item ${index + 1} para baixo`}
                onClick={() => onChange(move(items, index, 1))}
              >
                <ArrowDownMini />
              </Button>
              <Button
                variant="transparent"
                size="small"
                aria-label={`Remover o item ${index + 1}`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                Remover
              </Button>
            </div>
          </div>

          {fields.map((field) => {
            // Constante local: é o que faz o TypeScript estreitar `kind`
            // para `FieldKind` no ramo da sub-lista.
            const nested = field.kind

            // Todo campo com escolha vira um `<select>`: as opções vêm do
            // contrato (`source`, `icon`), junto com a tradução delas.
            const choices = field.options ?? []

            return (
              <div key={field.name} className="flex flex-col gap-y-1">
                <Label size="xsmall">{field.label}</Label>
                {field.help && (
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {field.help}
                  </Text>
                )}

                {nested === "markdown" ? (
                  // O campo de texto formatado dentro de um item (o `text` de um
                  // bloco do `prose`): a mesma caixa com a barra do formulário
                  // da seção, porque é o mesmo campo.
                  <FormattedTextarea
                    value={item[field.name]}
                    onChange={(next) => update(index, field.name, next)}
                    marks={marks}
                    rows={5}
                  />
                ) : nested === "list:markdown" ? (
                  // Uma caixa por linha — e **antes** do ramo genérico dos
                  // `list:*`, que desenharia um cartão de item vazio (esta lista
                  // não tem sub-formulário: a caixa é o formulário).
                  <MarkdownListInput
                    value={item[field.name]}
                    onChange={(next) => update(index, field.name, next)}
                    marks={marks}
                    addLabel={`Adicionar ${field.label.toLowerCase()}`}
                  />
                ) : nested && nested.startsWith("list:") ? (
                  <ObjectListInput
                    kind={nested}
                    itemFields={itemFields}
                    value={item[field.name]}
                    onChange={(next) => update(index, field.name, next)}
                    marks={marks}
                    addLabel={`Adicionar ${field.label.toLowerCase()}`}
                  />
                ) : nested === "image" ? (
                  // O mesmo controle do formulário da seção: item de lista com
                  // foto (coleção, Instagram) também precisa de envio, e não de
                  // uma caixa de texto que só aceita chave — a chave é
                  // consequência do envio, não algo que se digita.
                  <ImageInput
                    value={item[field.name]}
                    onChange={(next) => update(index, field.name, next)}
                  />
                ) : choices.length > 0 ? (
                  <select
                    className="h-8 rounded-md border border-ui-border-base bg-ui-bg-field px-2 text-sm"
                    value={String(item[field.name] ?? "")}
                    onChange={(e) => update(index, field.name, e.target.value)}
                  >
                    {field.allowEmpty && <option value="">—</option>}
                    {choices.map((key) => {
                      const translation = field.optionLabels?.[key]

                      return (
                        <option key={key} value={key}>
                          {translation ? `${key} — ${translation}` : key}
                        </option>
                      )
                    })}
                  </select>
                ) : (
                  <Input
                    value={String(item[field.name] ?? "")}
                    onChange={(e) => update(index, field.name, e.target.value)}
                  />
                )}
              </div>
            )
          })}
        </div>
      ))}

      <Button
        variant="secondary"
        size="small"
        className="self-start"
        onClick={() =>
          onChange([
            ...items,
            // Sub-lista nasce como `[]`, não como `""`: string vazia
            // viraria item inválido na validação da API. Um `<select>`
            // nasce na primeira opção — a que tem significado (ex.:
            // `source: "links"`), não numa opção vazia.
            Object.fromEntries(
              fields.map((f) => [
                f.name,
                f.kind?.startsWith("list:") ? [] : f.options?.[0] ?? "",
              ])
            ),
          ])
        }
      >
        {addLabel}
      </Button>
    </div>
  )
}

/**
 * O editor da lista de textos simples (`list:text`) — as mensagens do ticker.
 *
 * **Uma caixa por mensagem**, e não uma caixa com vírgulas. O campo antigo era
 * um `<Input>` só, remontado a cada tecla (`join(", ")` para exibir, `split(",")`
 * para gravar): a vírgula que o lojista acabava de digitar sumia na remontagem,
 * e duas mensagens chegavam à API coladas numa só. Sem duas mensagens o ticker
 * não rola (`tickerMessages`) — a barra ficava parada, e o campo parecia
 * funcionar. Com uma caixa por item não há separador para perder, e o gesto é o
 * dos outros itens do painel (slides, benefícios, links).
 *
 * A vírgula continua valendo como gesto de **colagem**: colar um texto com
 * vírgulas ou quebras de linha abre várias caixas de uma vez (`parseTextList`).
 * Digitar não separa — quem digita uma vírgula fica com ela no texto, que é o
 * que se espera de uma caixa de texto.
 */
function TextListInput({
  label,
  value,
  onChange,
  addLabel,
}: {
  label: ReactNode
  value: unknown
  onChange: (value: unknown) => void
  addLabel: string
}) {
  // O valor vem do banco, onde campo é texto livre: item que não é texto vira
  // caixa vazia em vez de quebrar o formulário da seção inteira.
  const items = Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item : ""))
    : []

  const replace = (index: number, parts: string[]) =>
    onChange([...items.slice(0, index), ...parts, ...items.slice(index + 1)])

  return (
    <div className="flex flex-col gap-y-2">
      {label}

      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-x-2">
          <Input
            value={item}
            placeholder={`Mensagem ${index + 1}`}
            onChange={(e) =>
              onChange(
                items.map((current, i) => (i === index ? e.target.value : current))
              )
            }
            // A colagem de uma lista abre em várias caixas: é entrada em lote, e
            // a caixa onde se colou dá lugar às partes. Colar uma parte só é
            // colagem comum — o campo a recebe como qualquer texto digitado.
            onPaste={(event) => {
              const parts = parseTextList(event.clipboardData.getData("text"))

              if (parts.length < 2) {
                return
              }

              event.preventDefault()
              replace(index, parts)
            }}
          />
          <Button
            variant="transparent"
            size="small"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            Remover
          </Button>
        </div>
      ))}

      {/* A caixa nova nasce vazia e é do formulário: o `wireValue` descarta
          branco no corpo, então deixá-la sem preencher não grava nada. */}
      <Button
        variant="secondary"
        size="small"
        className="self-start"
        onClick={() => onChange([...items, ""])}
      >
        {addLabel}
      </Button>
    </div>
  )
}

/**
 * A barra de marcas de uma caixa de texto formatado.
 *
 * Os botões **não** são declarados aqui: saem do `schema.markdownMarks`
 * (`MARKDOWN_MARKS`, no contrato) pelo mesmo motivo dos campos e do
 * sub-formulário dos itens — o painel desenha o que o registro diz, e uma marca
 * nova no contrato aparece nesta barra sem edição de React. O que o clique faz
 * também não se decide aqui: é o `toggleMark` (`markdown-bar.ts`), que devolve o
 * texto e a seleção novos.
 */
function MarkdownBar({
  marks,
  onMark,
}: {
  marks: readonly MarkdownMark[]
  onMark: (mark: MarkdownMark) => void
}) {
  // Sem marca nenhuma — um registro gravado antes da v11 do schema — a barra
  // não existe e a caixa continua sendo o que ela é: uma área de texto.
  if (!marks.length) {
    return null
  }

  return (
    <div
      role="toolbar"
      aria-label="Formatação do texto"
      className="flex flex-wrap items-center gap-x-1"
    >
      {marks.map((mark) => (
        <Button
          key={mark.label}
          type="button"
          variant="transparent"
          size="small"
          // O rótulo é o nome da marca ("Negrito") e a dica mostra o que vai
          // aparecer no texto (`**texto**`): quem não conhece as marcas é quem
          // mais precisa ver que o negrito fica escrito assim.
          title={markExample(mark)}
          aria-label={`${mark.label} — ${markExample(mark)}`}
          onClick={() => onMark(mark)}
        >
          {mark.label}
        </Button>
      ))}
    </div>
  )
}

/**
 * A caixa de um texto formatado: a área de digitação com a barra acima.
 *
 * O valor é **texto** — o que a barra insere são as marcas, e quem as
 * interpreta é o render da loja (`renderInline`). Nada de HTML passa por aqui, e
 * é por isso que o campo não precisa de sanitizador: o que o lojista digita é o
 * que a página mostra.
 *
 * **A seleção é do DOM, não do React.** O `toggleMark` recebe as posições do
 * `<textarea>` e devolve as novas, e quem as reaplica é o `useLayoutEffect`,
 * depois de o React escrever o valor. Sem isso o cursor pularia para o fim do
 * texto a cada botão apertado — o defeito clássico de um campo controlado, e o
 * que faria o lojista marcar a palavra errada.
 */
function FormattedTextarea({
  value,
  onChange,
  marks,
  placeholder,
  rows,
}: {
  value: unknown
  onChange: (value: unknown) => void
  marks: readonly MarkdownMark[]
  placeholder?: string
  rows: number
}) {
  const box = useRef<HTMLTextAreaElement | null>(null)
  const pending = useRef<MarkSelection | null>(null)
  const text = typeof value === "string" ? value : ""

  useLayoutEffect(() => {
    const selection = pending.current

    if (!selection || !box.current) {
      return
    }

    pending.current = null
    box.current.focus()
    box.current.setSelectionRange(selection.start, selection.end)
  })

  const apply = (mark: MarkdownMark) => {
    const element = box.current
    const result = toggleMark(
      text,
      {
        // Sem o `<textarea>` na mão (não deveria acontecer), a seleção é o fim
        // do texto: o par entra depois do que já existe, que é previsível.
        start: element?.selectionStart ?? text.length,
        end: element?.selectionEnd ?? text.length,
      },
      mark
    )

    // A seleção nova vai por `ref` porque o valor novo ainda não está na tela:
    // quem a aplica é o efeito acima, depois do render.
    pending.current = result.selection
    onChange(result.text)
  }

  return (
    <div className="flex flex-col gap-y-1">
      <MarkdownBar marks={marks} onMark={apply} />
      <Textarea
        ref={box}
        rows={rows}
        placeholder={placeholder}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

/**
 * O editor da lista de textos formatados (`list:markdown`) — as linhas de uma
 * lista do `prose`.
 *
 * Como o `TextListInput`, é **uma caixa por item**, e pelo mesmo motivo: um
 * campo único com os itens separados por vírgula ou por linha perde o separador
 * a cada tecla. A diferença é a barra em cada caixa — a linha de uma lista
 * aceita o mesmo negrito e o mesmo link do parágrafo.
 *
 * Uma diferença **deliberada** em relação ao `list:text`: colar um texto com
 * quebras aqui não abre uma caixa por linha. Num texto formatado, a quebra
 * colada pode ser o parágrafo inteiro de um documento de origem (a cláusula
 * copiada do contrato), e dividir seria adivinhar o que o lojista quis.
 */
function MarkdownListInput({
  label,
  value,
  onChange,
  marks,
  addLabel,
}: {
  /** Ausente dentro de um item de lista: o rótulo já é do sub-formulário. */
  label?: ReactNode
  value: unknown
  onChange: (value: unknown) => void
  marks: readonly MarkdownMark[]
  addLabel: string
}) {
  // O valor vem do banco, onde campo é texto livre: item que não é texto vira
  // caixa vazia em vez de quebrar o formulário da seção inteira.
  const items = Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item : ""))
    : []

  return (
    <div className="flex flex-col gap-y-2">
      {label}

      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-x-2">
          <div className="min-w-0 flex-1">
            <FormattedTextarea
              value={item}
              onChange={(next) =>
                onChange(
                  items.map((current, i) => (i === index ? next : current))
                )
              }
              marks={marks}
              placeholder={`Item ${index + 1}`}
              rows={2}
            />
          </div>
          <Button
            variant="transparent"
            size="small"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            Remover
          </Button>
        </div>
      ))}

      {/* A linha nova nasce vazia e é do formulário: o `wireValue` descarta
          branco no corpo, então deixá-la sem preencher não grava nada. */}
      <Button
        variant="secondary"
        size="small"
        className="self-start"
        onClick={() => onChange([...items, ""])}
      >
        {addLabel}
      </Button>
    </div>
  )
}

/**
 * O seletor dos chips de categoria (`list:category`).
 *
 * O valor é a **referência**: uma lista ordenada de `CategoryRef`. Não há campo
 * de digitação aqui, e é o ponto da fase — o que se escolhe é uma categoria que
 * existe, e o nome do chip é o nome dela, lido ao vivo pela API. O que estava
 * aqui antes era uma caixa de texto com rótulos separados por vírgula, e um
 * rótulo sem categoria por trás (o "Blazers" do padrão) virava um chip que
 * devolvia zero peças em silêncio.
 *
 * Duas ausências deliberadas:
 *
 * - **"Todos" não aparece na lista.** Ele não é categoria, é o gesto de limpar o
 *   filtro, e quem o desenha é a loja. Antes ele era um item da lista, e a
 *   posição (`filters[0]`) dizia que era ele — reordenar os chips trocava o
 *   significado de cada um sem nada acusar.
 * - **Nada de texto livre.** O catálogo vem no `categories` do payload: uma
 *   categoria nova no Medusa aparece aqui sem ninguém mexer neste arquivo.
 *
 * A ordem é da lista (as setas), e a API grava `position` a partir dela — o
 * lojista não digita número, como na ordem das seções.
 */
function CategoryChipsInput({
  label,
  value,
  onChange,
  categories,
}: {
  label: ReactNode
  value: unknown
  onChange: (value: unknown) => void
  categories: readonly CategoryRef[]
}) {
  const chips = Array.isArray(value) ? (value as CategoryRef[]) : []
  const chosen = new Set(chips.map((chip) => chip.categoryId))
  const available = categories.filter(
    (category) => !chosen.has(category.categoryId)
  )

  // A troca de lugar é a mesma do editor de itens (`list-order.ts`): um só
  // lugar decide o que "mover para cima" quer dizer, e o de fora da faixa não
  // acende o "Salvar".
  const swap = (index: number, delta: number) =>
    onChange(move(chips, index, delta))

  return (
    <div className="flex flex-col gap-y-2">
      {label}

      {chips.map((chip, index) => (
        <div
          key={chip.categoryId}
          className="flex items-center gap-x-2 rounded-md border border-ui-border-base p-2"
        >
          <Text size="small" className="flex-1 truncate">
            {chip.label}
          </Text>
          <Button
            variant="transparent"
            size="small"
            disabled={index === 0}
            aria-label={`Mover ${chip.label} para cima`}
            onClick={() => swap(index, -1)}
          >
            <ArrowUpMini />
          </Button>
          <Button
            variant="transparent"
            size="small"
            disabled={index === chips.length - 1}
            aria-label={`Mover ${chip.label} para baixo`}
            onClick={() => swap(index, 1)}
          >
            <ArrowDownMini />
          </Button>
          <Button
            variant="transparent"
            size="small"
            aria-label={`Remover ${chip.label}`}
            onClick={() => onChange(chips.filter((_, i) => i !== index))}
          >
            Remover
          </Button>
        </div>
      ))}

      {available.length ? (
        <select
          className="h-8 rounded-md border border-ui-border-base bg-ui-bg-field px-2 text-sm"
          // O `<select>` é de adicionar: escolher uma categoria a acrescenta no
          // fim da lista e ele volta ao rótulo. Editar a lista é pelas setas e
          // pelo "Remover", que é onde a ordem se mexe.
          value=""
          onChange={(e) => {
            const picked = categories.find(
              (category) => category.categoryId === e.target.value
            )

            if (picked) {
              onChange([...chips, picked])
            }
          }}
        >
          <option value="">Adicionar categoria…</option>
          {available.map((category) => (
            <option key={category.categoryId} value={category.categoryId}>
              {category.label}
            </option>
          ))}
        </select>
      ) : (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {categories.length
            ? "Todas as categorias do catálogo já estão na lista."
            : "Nenhuma categoria no catálogo — crie uma no painel de produtos."}
        </Text>
      )}
    </div>
  )
}

/**
 * Rótulo de uma opção de `<select>`, com a tradução que veio do contrato
 * (`optionLabels`, como nos itens de lista): sem ela o seletor mostra a chave
 * crua — que é o que o lojista veria ao escolher a fonte da estação
 * (`Playfair Display` sem saber que é a dos títulos).
 *
 * A opção vazia não tem chave para prefixar: ela significa "herda o padrão do
 * tema", então sai só com o rótulo.
 */
function optionLabel(spec: FieldSpec, option: string): string {
  const translation = spec.optionLabels?.[option]

  if (!translation) {
    return option
  }

  return option === "" ? translation : `${option} — ${translation}`
}

type FieldInputProps = {
  spec: FieldSpec
  value: unknown
  onChange: (value: unknown) => void
  /**
   * `schema.itemFields` — os campos de dentro de cada item de lista, por
   * `kind`. Vem do `schema` da API como o resto (o contrato é quem decide o
   * sub-formulário), e só os `kind` de objeto aparecem: uma seção sem lista
   * passa `{}`.
   */
  itemFields: ItemFields
  /**
   * `schema.palette` / `schema.fonts` — as prévias dos campos `color` e
   * `font` (hex de cada cor, família de cada fonte). Vêm do `schema` da API,
   * e não de uma cópia aqui, pelo mesmo motivo do resto do arquivo: o admin
   * é um pacote separado e não importa o contrato. São opcionais porque
   * só os dois `kind` de aparência os usam.
   */
  palette?: Palette
  fonts?: Fonts
  /**
   * O catálogo de categorias — as opções do seletor de chips (`list:category`).
   *
   * Vem no payload do `GET /admin/content` (`categories`), e não de um `options`
   * no contrato: categoria nasce e morre no painel do Medusa, e uma lista
   * fechada no contrato ofereceria o que não existe — o "Blazers" do padrão era
   * exatamente isso. Opcional porque só esse `kind` o usa, como a paleta.
   */
  categories?: readonly CategoryRef[]
  /**
   * `schema.markdownMarks` — as marcas do botão da barra (`MARKDOWN_MARKS`, no
   * contrato). Vêm no payload pelo mesmo motivo dos outros: o painel é um pacote
   * separado e **não importa valor** do contrato, então a barra do CRM e o
   * parser da loja leem a mesma lista por caminhos diferentes. Opcional porque
   * só os dois `kind` de texto formatado a usam — e porque um registro gravado
   * antes da v11 do schema não a tem (a caixa continua funcionando sem barra).
   */
  marks?: readonly MarkdownMark[]
}

export const FieldInput = ({
  spec,
  value,
  onChange,
  itemFields,
  palette,
  fonts,
  categories,
  marks,
}: FieldInputProps) => {
  const label = (
    <div className="flex flex-col">
      <Label size="small" weight="plus">
        {spec.label}
        {spec.required ? " *" : ""}
      </Label>
      {spec.help && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {spec.help}
        </Text>
      )}
    </div>
  )

  /* ---- chips de categoria (referência ao catálogo) ---- */
  if (spec.kind === "list:category") {
    return (
      <CategoryChipsInput
        label={label}
        value={value}
        onChange={onChange}
        categories={categories ?? []}
      />
    )
  }

  /* ---- listas de texto simples (as mensagens do ticker) ---- */
  if (spec.kind === "list:text") {
    return (
      <TextListInput
        label={label}
        value={value}
        onChange={onChange}
        // "mensagem" e não "item": o único `list:text` do contrato é o ticker da
        // barra de anúncio (`announcement.messages`), e o botão diz o que ele
        // cria. Um segundo campo deste `kind` traz o rótulo dele para cá.
        addLabel="Adicionar mensagem"
      />
    )
  }

  /* ---- texto formatado: a caixa com a barra de marcas ---- */
  if (spec.kind === "markdown") {
    return (
      <div className="flex flex-col gap-y-2">
        {label}
        <FormattedTextarea
          value={value}
          onChange={onChange}
          marks={marks ?? []}
          // Oito linhas: um texto longo (o aviso, a política) se escreve lendo o
          // parágrafo, e numa caixa de duas linhas o lojista rola o tempo todo.
          rows={8}
        />
      </div>
    )
  }

  /* ---- listas de texto formatado (as linhas de uma lista do `prose`) ---- */
  if (spec.kind === "list:markdown") {
    return (
      <MarkdownListInput
        label={label}
        value={value}
        onChange={onChange}
        marks={marks ?? []}
        // "linha" e não "item": o único `list:markdown` do contrato são as
        // linhas de uma lista do texto longo, e o botão diz o que ele cria.
        addLabel="Adicionar linha"
      />
    )
  }

  /* ---- listas de objetos (itens, coleções, imagens, links) ---- */
  if (spec.kind.startsWith("list:")) {
    return (
      <div className="flex flex-col gap-y-3">
        {label}
        <ObjectListInput
          kind={spec.kind}
          itemFields={itemFields}
          value={value}
          onChange={onChange}
          marks={marks ?? []}
        />
      </div>
    )
  }

  /* ---- imagem (envio de arquivo) ---- */
  if (spec.kind === "image") {
    return (
      <div className="flex flex-col gap-y-2">
        {label}
        <ImageInput value={value} onChange={onChange} />
      </div>
    )
  }

  /* ---- textarea ---- */
  if (spec.kind === "textarea") {
    return (
      <div className="flex flex-col gap-y-2">
        {label}
        <Textarea
          rows={3}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }

  /* ---- número ---- */
  if (spec.kind === "number") {
    return (
      <div className="flex flex-col gap-y-2">
        {label}
        {/*
          A faixa vem do CAMPO (`min`/`max`/`step` no contrato), não deste
          editor: era daqui que todo número herdava a faixa do primeiro campo
          numérico que a tivesse — o scrim da capa, 0 a 1 —, e um campo novo (o
          limite de itens de uma vitrine, por exemplo) ficaria impossível de
          preencher. Campo sem faixa é um número livre; a rota admin cobra
          exatamente a mesma faixa.
        */}
        <Input
          type="number"
          step={spec.step ?? 1}
          min={spec.min}
          max={spec.max}
          value={String(value ?? "")}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    )
  }

  /* ---- select ---- */
  if (spec.kind === "select") {
    return (
      <div className="flex flex-col gap-y-2">
        {label}
        <select
          className="h-8 rounded-md border border-ui-border-base bg-ui-bg-field px-2 text-sm"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {(spec.options ?? []).map((option) => (
            <option key={option} value={option}>
              {optionLabel(spec, option)}
            </option>
          ))}
        </select>
      </div>
    )
  }

  /* ---- cor literal (`hex`): a paleta da estação ---- */
  if (spec.kind === "hex") {
    const current = String(value ?? "")

    return (
      <div className="flex flex-col gap-y-2">
        {label}
        <div className="flex items-center gap-x-2">
          {/*
            A roda de cores é a do navegador: o valor dela é `#rrggbb`, o mesmo
            formato que o `pattern` do contrato cobra, e o texto ao lado é o que
            se lê e se cola. Vazio (herda o tema padrão) não tem cor para
            mostrar e o campo nativo não aceita "" — daí o branco como ponto de
            partida do seletor, sem gravar nada até alguém mexer nele.
          */}
          <input
            type="color"
            aria-label={spec.label}
            className="h-8 w-12 shrink-0 cursor-pointer rounded-md border border-ui-border-base bg-ui-bg-field"
            value={current || "#ffffff"}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
          />
          <Input
            value={current}
            placeholder="#B97872"
            onChange={(e) => onChange(e.target.value)}
          />
          {current ? (
            <Button
              variant="transparent"
              size="small"
              onClick={() => onChange("")}
            >
              Herdar
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  /* ---- cor do tema (bolinha) ---- */
  if (spec.kind === "color") {
    return (
      <ColorPicker
        spec={spec}
        value={value}
        onChange={onChange}
        palette={palette}
      />
    )
  }

  /* ---- fonte do tema (lista com prévia) ---- */
  if (spec.kind === "font") {
    return (
      <FontPicker spec={spec} value={value} onChange={onChange} fonts={fonts} />
    )
  }

  /* ---- texto (padrão) ---- */
  return (
    <div className="flex flex-col gap-y-2">
      {label}
      <Input
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
