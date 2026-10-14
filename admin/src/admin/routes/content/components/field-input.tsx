/**
 * Renderizador de campo do editor de conteúdo: um ramo por `FieldKind`. Os
 * campos vêm do `schema.fields`/`schema.itemFields` do contrato; os `kind` de
 * aparência (`color`, `font`) vão para o `appearance-controls.tsx`.
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
import { DocumentInput } from "./document-input"
import { parseTextList } from "../lib/form-draft"
import { HrefInput } from "./href-input"
import { ImageInput } from "./image-input"
import { itemSummary, move } from "../lib/list-order"
import { markExample, toggleMark, type MarkSelection } from "../lib/markdown-bar"

/**
 * Os tipos vêm do **contrato**, por `import type` pelo alias `@conteudo/*`
 * (`admin/tsconfig.json`): some no build, e um campo novo no contrato vira erro
 * de compilação aqui em vez de sumir da tela em silêncio.
 */
import type {
  CategoryRef,
  ContentDestination,
  FieldKind,
  FieldSpec,
  ItemFieldSpec,
  ItemFields,
  MarkdownMark,
} from "@conteudo/contract"

export type { FieldKind, FieldSpec, ItemFieldSpec, ItemFields }

/**
 * Os `kind` que este editor desenha; `list:${string}` cobre todos os `list:*`.
 */
type HandledKind =
  | "text"
  // Destino: mesmo valor do `text`; muda a lista de rotas ao lado (`HrefInput`).
  | "href"
  | "textarea"
  | "number"
  | "select"
  | "image"
  // Documento anexo (o `documentUrl` do `prose`): o mesmo upload da imagem e a
  // mesma **chave** gravada, **sem** prévia — o que se confere é o caminho.
  | "document"
  | "color"
  | "font"
  // Cor **literal** (`#RRGGBB`), não o `color` (que é o papel, "dourado").
  | "hex"
  // Texto **formatado** (o `prose`): a caixa com a barra; o valor é texto.
  | "markdown"
  | "list:text"
  // Lista de textos formatados (as linhas de um `prose`): uma caixa com barra
  // por item, **sem** sub-formulário — e sem entrada em `ITEM_FIELDS`.
  | "list:markdown"
  // Referência ao catálogo: os ids que viram chip, escolhidos em `categories`.
  | "list:category"
  | `list:${string}`

/**
 * **A exaustividade é do compilador**: um `kind` que este editor não desenha
 * deixa `UNHANDLED_KINDS` falso e o `tsc` reprova. O campo novo ainda
 * **aparece**, no ramo de texto, mas não em silêncio.
 */
export type UnhandledKind = Exclude<FieldKind, HandledKind>
export const UNHANDLED_KINDS: [UnhandledKind] extends [never]
  ? true
  : UnhandledKind = true

/**
 * Editor de uma lista de objetos (itens, coleções, imagens, links). Os campos
 * de dentro do item vêm de `schema.itemFields` (`ITEM_FIELDS`, no contrato), e
 * o `addLabel` evita repetir "Adicionar item" sob o rótulo "Links".
 *
 * É recursivo de propósito: a coluna do rodapé (`list:column`) guarda outra
 * lista. O cabeçalho de cada item diz **o que ele é** e é onde a ordem se mexe;
 * as setas e o `itemSummary` são de `list-order.ts`.
 */
function ObjectListInput({
  kind,
  itemFields,
  value,
  onChange,
  marks,
  destinations,
  addLabel = "Adicionar item",
}: {
  kind: FieldKind
  itemFields: ItemFields
  value: unknown
  onChange: (value: unknown) => void
  /** As marcas do texto formatado (`schema.markdownMarks`), para o item. */
  marks: readonly MarkdownMark[]
  /** Os destinos conhecidos (`schema.destinations`): o item tem `href`. */
  destinations?: readonly ContentDestination[]
  addLabel?: string
}) {
  const fields = itemFields[kind] ?? []
  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : []

  // O que cada item diz de si mesmo no cabeçalho, para a lista ser navegável.
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
              {/* As setas mexem no `position` que a API grava para o item. */}
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
            // Constante local: estreita `kind` para `FieldKind`.
            const nested = field.kind

            // Campo com escolha vira `<select>`: as opções vêm do contrato.
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
                  // O `markdown` do item: a mesma caixa com barra da seção.
                  <FormattedTextarea
                    value={item[field.name]}
                    onChange={(next) => update(index, field.name, next)}
                    marks={marks}
                    rows={5}
                  />
                ) : nested === "list:markdown" ? (
                  // Antes do ramo genérico dos `list:*`, que desenharia um
                  // cartão vazio: aqui a caixa **é** o formulário.
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
                    destinations={destinations}
                    addLabel={`Adicionar ${field.label.toLowerCase()}`}
                  />
                ) : nested === "image" ? (
                  // O mesmo controle da seção: o item com foto precisa de envio —
                  // a chave é consequência dele, não algo que se digita.
                  <ImageInput
                    value={item[field.name]}
                    onChange={(next) => update(index, field.name, next)}
                  />
                ) : nested === "document" ? (
                  // Idem para o anexo: o item pode trazer um PDF.
                  <DocumentInput
                    value={item[field.name]}
                    onChange={(next) => update(index, field.name, next)}
                  />
                ) : nested === "href" ? (
                  // O destino dentro do item: mesmo controle e mesma lista.
                  <HrefInput
                    value={item[field.name]}
                    onChange={(next) => update(index, field.name, next)}
                    destinations={destinations}
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
            // Sub-lista nasce como `[]`, não `""` (item inválido na API).
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
 * **Uma caixa por mensagem**: o campo antigo era um `<Input>` só, remontado a
 * cada tecla (`join`/`split`), e a vírgula recém-digitada sumia — duas
 * mensagens chegavam à API coladas numa só, o ticker não rolava e o campo
 * parecia funcionar. A vírgula ainda vale como **colagem** (`parseTextList`).
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
  // Item que não é texto vira caixa vazia em vez de quebrar o formulário.
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
            // Colar uma lista abre em várias caixas; colar uma parte é comum.
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

      {/* A caixa nova nasce vazia: o `wireValue` descarta branco no corpo. */}
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
 * A barra de marcas de uma caixa formatada: os botões saem do
 * `schema.markdownMarks` e o clique é do `toggleMark` (`markdown-bar.ts`).
 */
function MarkdownBar({
  marks,
  onMark,
}: {
  marks: readonly MarkdownMark[]
  onMark: (mark: MarkdownMark) => void
}) {
  // Sem marca nenhuma (registro anterior à v11), a barra não existe.
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
          // O rótulo é a marca e a dica mostra o que sai no texto (`**texto**`).
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
 * A caixa de um texto formatado: a área de digitação com a barra acima. O valor
 * é **texto** — a barra insere marcas e quem as interpreta é o render da loja
 * (`renderInline`) —, então nada de HTML passa e não há sanitizador.
 *
 * **A seleção é do DOM, não do React**: sem o `useLayoutEffect` reaplicando o
 * que o `toggleMark` devolve, o cursor pularia para o fim a cada botão.
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
        // Sem o `<textarea>` na mão, a seleção é o fim do texto.
        start: element?.selectionStart ?? text.length,
        end: element?.selectionEnd ?? text.length,
      },
      mark
    )

    // A seleção nova vai por `ref`: quem a aplica é o efeito acima.
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
 * O editor da lista de textos formatados (`list:markdown`): uma caixa com barra
 * por item, como no `TextListInput`.
 *
 * **Deliberado**: colar um texto com quebras aqui **não** abre uma caixa por
 * linha — a quebra colada pode ser o parágrafo inteiro de um documento, e
 * dividir seria adivinhar o que o lojista quis.
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
  // Item que não é texto vira caixa vazia em vez de quebrar o formulário.
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

      {/* A linha nova nasce vazia: o `wireValue` descarta branco no corpo. */}
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
 * O seletor dos chips de categoria (`list:category`): o valor é a
 * **referência**, uma lista ordenada de `CategoryRef`, e não texto. O nome do
 * chip é o da categoria, lido ao vivo — antes era uma caixa de texto com
 * rótulos por vírgula, e um rótulo sem categoria (o "Blazers" do padrão) virava
 * chip que devolvia zero peças em silêncio.
 *
 * **"Todos" não aparece**: não é categoria, é o gesto de limpar o filtro (antes
 * a posição `filters[0]` dizia qual chip limpava). A ordem é da lista, e a API
 * grava `position` a partir dela.
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

  // A troca de lugar é a mesma do editor de itens (`list-order.ts`).
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
          // O `<select>` é de adicionar: escolher acrescenta no fim da lista e
          // ele volta ao rótulo; editar é pelas setas e pelo "Remover".
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
 * Rótulo de uma opção de `<select>`: traduz com o `optionLabels` do contrato,
 * e a opção vazia ("herda o padrão") sai só com o rótulo.
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
  /** `schema.itemFields` — os campos de dentro de cada item, por `kind`. */
  itemFields: ItemFields
  /** `schema.palette` / `schema.fonts` — as prévias da aparência. */
  palette?: Palette
  fonts?: Fonts
  /**
   * O catálogo de categorias do `list:category`: vem no payload
   * (`categories`), não de um `options` do contrato — categoria nasce e morre
   * no painel, e uma lista fechada ofereceria o que não existe.
   */
  categories?: readonly CategoryRef[]
  /**
   * `schema.markdownMarks` — as marcas da barra, que vêm no payload (o painel
   * não importa valor do contrato). Sem elas a caixa funciona sem barra.
   */
  marks?: readonly MarkdownMark[]
  /**
   * Os destinos conhecidos (`schema.destinations`): as opções do `datalist` do
   * `kind: "href"`. Sem a chave o campo degrada para caixa de texto.
   */
  destinations?: readonly ContentDestination[]
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
  destinations,
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

  if (spec.kind === "list:text") {
    return (
      <TextListInput
        label={label}
        value={value}
        onChange={onChange}
        // "mensagem" e não "item": o único `list:text` é o ticker da barra.
        addLabel="Adicionar mensagem"
      />
    )
  }

  if (spec.kind === "markdown") {
    return (
      <div className="flex flex-col gap-y-2">
        {label}
        <FormattedTextarea
          value={value}
          onChange={onChange}
          marks={marks ?? []}
          // Oito linhas: um texto longo se escreve lendo o parágrafo.
          rows={8}
        />
      </div>
    )
  }

  if (spec.kind === "list:markdown") {
    return (
      <MarkdownListInput
        label={label}
        value={value}
        onChange={onChange}
        marks={marks ?? []}
        // "linha" e não "item": o único `list:markdown` é o do `prose`.
        addLabel="Adicionar linha"
      />
    )
  }

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
          destinations={destinations}
        />
      </div>
    )
  }

  if (spec.kind === "image") {
    return (
      <div className="flex flex-col gap-y-2">
        {label}
        <ImageInput value={value} onChange={onChange} />
      </div>
    )
  }

  if (spec.kind === "document") {
    return (
      <div className="flex flex-col gap-y-2">
        {label}
        <DocumentInput value={value} onChange={onChange} />
      </div>
    )
  }

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

  if (spec.kind === "number") {
    return (
      <div className="flex flex-col gap-y-2">
        {label}
        {/*
          A faixa vem do CAMPO (`min`/`max`/`step`), não daqui: era daqui que
          todo número herdava a faixa do primeiro campo numérico que a tivesse
          (o scrim da capa, 0 a 1), e um campo novo ficaria impossível.
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

  if (spec.kind === "hex") {
    const current = String(value ?? "")

    return (
      <div className="flex flex-col gap-y-2">
        {label}
        <div className="flex items-center gap-x-2">
          {/* A roda de cores é a do navegador: o valor dela é `#rrggbb`, o
              mesmo formato que o `pattern` do contrato cobra. Vazio (herda o
              tema) não tem cor para mostrar e o campo nativo não aceita `""` —
              daí o branco como partida, sem gravar nada. */}
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

  if (spec.kind === "font") {
    return (
      <FontPicker spec={spec} value={value} onChange={onChange} fonts={fonts} />
    )
  }

  if (spec.kind === "href") {
    return (
      <div className="flex flex-col gap-y-2">
        {label}
        <HrefInput
          value={value}
          onChange={onChange}
          destinations={destinations}
        />
      </div>
    )
  }

  // Texto (o ramo padrão).
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
