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

import {
  ColorPicker,
  FontPicker,
  type Fonts,
  type Palette,
} from "./appearance-controls"
import { ImageInput } from "./image-input"

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
 */
import type {
  FieldKind,
  FieldSpec,
  ItemFieldSpec,
  ItemFields,
} from "../../../modules/content/contract"

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
  | "list:text"
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
 */
function ObjectListInput({
  kind,
  itemFields,
  value,
  onChange,
  addLabel = "Adicionar item",
}: {
  kind: FieldKind
  itemFields: ItemFields
  value: unknown
  onChange: (value: unknown) => void
  addLabel?: string
}) {
  const fields = itemFields[kind] ?? []
  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : []

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
          <div className="flex items-center justify-between">
            <Text size="xsmall" weight="plus">
              Item {index + 1}
            </Text>
            <Button
              variant="transparent"
              size="small"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              Remover
            </Button>
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

                {nested && nested.startsWith("list:") ? (
                  <ObjectListInput
                    kind={nested}
                    itemFields={itemFields}
                    value={item[field.name]}
                    onChange={(next) => update(index, field.name, next)}
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
}

export const FieldInput = ({
  spec,
  value,
  onChange,
  itemFields,
  palette,
  fonts,
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

  /* ---- listas de texto simples (ex.: filtros) ---- */
  if (spec.kind === "list:text") {
    const items = Array.isArray(value) ? (value as string[]) : []

    return (
      <div className="flex flex-col gap-y-2">
        {label}
        <Input
          value={items.join(", ")}
          placeholder="Todos, Blazers, Conjuntos"
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean)
            )
          }
        />
      </div>
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
          editor: era daqui que todo número herdava o 0 a 1 do `overlay` do
          hero, e um campo novo — o limite de itens de uma vitrine — ficaria
          impossível de preencher. Campo sem faixa é um número livre; a rota
          admin cobra exatamente a mesma faixa.
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
              {option}
            </option>
          ))}
        </select>
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
