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

export type FieldSpec = {
  name: string
  label: string
  kind: FieldKind
  required?: boolean
  options?: readonly string[]
  help?: string
}

/** Campos de cada item de lista — espelha o contrato do backend. */
const ITEM_FIELDS: Record<string, readonly { name: string; label: string }[]> = {
  "list:benefit": [
    { name: "icon", label: "Ícone" },
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
}

/** Ícones disponíveis para a faixa de benefícios. */
const ICON_KEYS = ["quality", "price", "sizes", "delivery", "fallback"]

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

  /* ---- listas de objetos (itens, coleções, imagens) ---- */
  if (spec.kind.startsWith("list:")) {
    const fields = ITEM_FIELDS[spec.kind] ?? []
    const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : []

    const update = (index: number, name: string, next: unknown) => {
      onChange(
        items.map((item, i) => (i === index ? { ...item, [name]: next } : item))
      )
    }

    return (
      <div className="flex flex-col gap-y-3">
        {label}

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

            {fields.map((field) => (
              <div key={field.name} className="flex flex-col gap-y-1">
                <Label size="xsmall">{field.label}</Label>

                {spec.kind === "list:benefit" && field.name === "icon" ? (
                  <select
                    className="h-8 rounded-md border border-ui-border-base bg-ui-bg-field px-2 text-sm"
                    value={String(item[field.name] ?? "")}
                    onChange={(e) => update(index, field.name, e.target.value)}
                  >
                    <option value="">—</option>
                    {ICON_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={String(item[field.name] ?? "")}
                    onChange={(e) => update(index, field.name, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        ))}

        <Button
          variant="secondary"
          size="small"
          className="self-start"
          onClick={() =>
            onChange([
              ...items,
              Object.fromEntries(fields.map((f) => [f.name, ""])),
            ])
          }
        >
          Adicionar item
        </Button>
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
