/**
 * Renderizador de campo do editor de conteúdo.
 *
 * Um ramo por `FieldKind`. Os campos vêm do `schema.fields` que a API
 * admin devolve — gerado a partir de
 * `backend/src/modules/content/contract.ts` —, então adicionar um campo
 * no contrato faz ele aparecer aqui sem mexer neste arquivo.
 */
import { Button, Input, Label, Text, Textarea } from "@medusajs/ui"

export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "list:text"
  | "list:benefit"
  | "list:highlight"
  | "list:image"
  | "list:link"
  | "list:action"
  // Item que carrega sub-lista (`links`): desenhado em recursão.
  | "list:column"
  | "list:social"

export type FieldSpec = {
  name: string
  label: string
  kind: FieldKind
  required?: boolean
  options?: readonly string[]
  help?: string
}

/**
 * Um campo de item de lista.
 *
 * `kind` só existe para o item que é lista (hoje, o `links` de uma coluna
 * do rodapé) e `options` para o item que é escolha (`source`).
 */
type ItemFieldSpec = {
  name: string
  label: string
  kind?: FieldKind
  /** Opções do `<select>`; a primeira é o valor de um item novo. */
  options?: readonly string[]
  /** Tradução de cada opção, para o `<select>` não ser só jargão. */
  optionLabels?: Record<string, string>
  /** Em branco é um valor válido (o ícone cai no padrão): oferece "—". */
  allowEmpty?: boolean
  /** Explicação curta, abaixo do rótulo. */
  help?: string
}

/**
 * Origens possíveis dos itens de uma coluna do rodapé — espelha
 * `FOOTER_COLUMN_SOURCES` de `backend/src/modules/content/contract.ts`
 * (e do espelho no frontend). O admin é um pacote separado e não importa
 * o contrato, então a lista é mantida à mão aqui e conferida por
 * `scripts/check-contract-parity.mjs`.
 */
const FOOTER_COLUMN_SOURCES = ["links", "categories", "collections"] as const

/** Campos de cada item de lista — espelha o contrato do backend. */
const ITEM_FIELDS: Record<string, readonly ItemFieldSpec[]> = {
  "list:benefit": [
    { name: "icon", label: "Ícone", allowEmpty: true },
    { name: "title", label: "Título" },
    { name: "subtitle", label: "Subtítulo" },
  ],
  "list:highlight": [
    { name: "title", label: "Título" },
    { name: "subtitle", label: "Subtítulo" },
    { name: "imageUrl", label: "Imagem (URL)" },
    { name: "imageAlt", label: "Imagem (alt)" },
    { name: "href", label: "Link" },
    { name: "ctaLabel", label: "Texto do botão" },
  ],
  "list:image": [
    { name: "imageUrl", label: "Imagem (URL)" },
    { name: "imageAlt", label: "Imagem (alt)" },
  ],
  "list:link": [
    { name: "label", label: "Rótulo" },
    { name: "href", label: "Destino" },
  ],
  "list:action": [
    { name: "icon", label: "Ícone", allowEmpty: true },
    { name: "label", label: "Rótulo" },
    { name: "href", label: "Destino" },
  ],
  // Coluna do rodapé: título, a origem dos itens e — quando a origem é
  // "links" — os links dela, que são uma lista dentro do item (ver
  // `ObjectListInput`, que desenha os dois níveis).
  "list:column": [
    { name: "title", label: "Título" },
    {
      name: "source",
      label: "Origem dos itens",
      options: FOOTER_COLUMN_SOURCES,
      optionLabels: {
        links: "os links digitados abaixo",
        categories: "as categorias do catálogo",
        collections: "as coleções do catálogo",
      },
    },
    {
      name: "links",
      label: "Links",
      kind: "list:link",
      help: "Ignorados quando a origem é o catálogo.",
    },
  ],
  "list:social": [
    { name: "icon", label: "Ícone", allowEmpty: true },
    { name: "label", label: "Rótulo" },
    { name: "href", label: "Destino" },
  ],
}

/**
 * Ícones oferecidos por lista — espelha `frontend/src/lib/content/icons.ts`
 * (`BENEFIT_ICON_KEYS` / `HEADER_ACTION_ICON_KEYS`).
 *
 * O admin é um pacote separado e não consegue importar o registro do
 * frontend, então a lista é mantida à mão aqui. Uma chave que não existe
 * lá ainda renderiza (o registro cai no ícone padrão), mas o rótulo
 * ficaria errado: chave nova entra nos dois lugares.
 */
const ICON_KEYS_BY_KIND: Record<string, readonly string[]> = {
  "list:benefit": ["quality", "price", "sizes", "delivery"],
  "list:action": [
    "bag",
    "account",
    "search",
    "whatsapp",
    "mail",
    "phone",
    "pin",
  ],
  // Espelha `SOCIAL_ICON_KEYS` de `frontend/src/lib/content/social-icons.tsx`
  // (registro próprio: os ícones sociais não estão em `icons.ts`).
  "list:social": ["instagram", "facebook", "whatsapp", "youtube"],
}

/** Tradução de cada chave, para o `<select>` não ser só jargão. */
const ICON_LABELS: Record<string, string> = {
  quality: "qualidade",
  price: "preço",
  sizes: "tamanhos",
  delivery: "entrega",
  bag: "sacola — usa o carrinho, com contador",
  account: "conta",
  search: "busca",
  whatsapp: "WhatsApp",
  mail: "e-mail",
  phone: "telefone",
  pin: "localização",
  // Redes sociais do rodapé (`list:social`).
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
}

/**
 * Editor de uma lista de objetos (itens, coleções, imagens, links).
 *
 * É recursivo de propósito: um item pode conter outra lista — a coluna do
 * rodapé (`list:column`) guarda os links dela —, então o mesmo componente
 * desenha os níveis internos em vez de um ramo por profundidade. O
 * `addLabel` existe para o botão do nível de dentro não repetir
 * "Adicionar item" logo abaixo do rótulo "Links".
 */
function ObjectListInput({
  kind,
  value,
  onChange,
  addLabel = "Adicionar item",
}: {
  kind: FieldKind
  value: unknown
  onChange: (value: unknown) => void
  addLabel?: string
}) {
  const fields = ITEM_FIELDS[kind] ?? []
  const iconKeys = ICON_KEYS_BY_KIND[kind] ?? []
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

            // Todo campo com escolha vira um `<select>`: as opções do
            // próprio campo (`source`) ou o registro de ícones (`icon`).
            const choices =
              field.options ?? (field.name === "icon" ? iconKeys : [])

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
                    value={item[field.name]}
                    onChange={(next) => update(index, field.name, next)}
                    addLabel={`Adicionar ${field.label.toLowerCase()}`}
                  />
                ) : choices.length > 0 ? (
                  <select
                    className="h-8 rounded-md border border-ui-border-base bg-ui-bg-field px-2 text-sm"
                    value={String(item[field.name] ?? "")}
                    onChange={(e) => update(index, field.name, e.target.value)}
                  >
                    {field.allowEmpty && <option value="">—</option>}
                    {choices.map((key) => {
                      const translation =
                        field.optionLabels?.[key] ?? ICON_LABELS[key]

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
}

export const FieldInput = ({ spec, value, onChange }: FieldInputProps) => {
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
        <ObjectListInput kind={spec.kind} value={value} onChange={onChange} />
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
        <Input
          type="number"
          step="0.01"
          min="0"
          max="1"
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
