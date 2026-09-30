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
import type { ReactNode } from "react"

import {
  ColorPicker,
  FontPicker,
  type Fonts,
  type Palette,
} from "./appearance-controls"
import { parseTextList } from "./form-draft"
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
  | "list:text"
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

  const move = (index: number, delta: number) => {
    const target = index + delta
    const next = [...chips]

    if (target < 0 || target >= next.length) {
      return
    }

    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

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
            onClick={() => move(index, -1)}
          >
            <ArrowUpMini />
          </Button>
          <Button
            variant="transparent"
            size="small"
            disabled={index === chips.length - 1}
            onClick={() => move(index, 1)}
          >
            <ArrowDownMini />
          </Button>
          <Button
            variant="transparent"
            size="small"
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
}

export const FieldInput = ({
  spec,
  value,
  onChange,
  itemFields,
  palette,
  fonts,
  categories,
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
