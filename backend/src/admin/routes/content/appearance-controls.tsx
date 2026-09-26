/**
 * Controles de aparência do editor de conteúdo.
 * -----------------------------------------------------------------
 * Duas escolhas que o lojista faz olhando: a **cor**, entre as 6 do guia de
 * marca, e a **fonte**, entre os 3 papéis do tema. As duas aparecem dentro
 * do conteúdo, no trilho logo abaixo do campo que elas vestem (ver
 * `attachedTo` no contrato), e não num bloco "Aparência" no fim da seção:
 * quem quer mudar a cor do título está com o cursor no título.
 *
 * O que o contrato decide e o que este arquivo decide:
 *
 * - **contrato**: quais campos existem, em que trilho
 *   (`group`), abaixo de que campo (`attachedTo`), quais valores são
 *   válidos (`options`) e como cada um se chama (`optionLabels`);
 * - **aqui**: como isso se desenha. As bolinhas de cor e a lista de fontes
 *   não conhecem nome de campo nenhum — recebem `options`/`optionLabels` e
 *   devolvem o valor escolhido por `onChange`. Um campo de aparência novo
 *   no contrato aparece no editor sem tocar neste arquivo.
 *
 * As prévias (hex de cada cor, família de cada fonte) vêm do `schema` da API
 * admin (`palette`, `fonts`), não de uma cópia local: o painel é um pacote
 * separado e não lê nem os `theme.json` do storefront nem as fontes dele —
 * a cópia dos `.woff2` em `./fonts/` é do navegador, para o `@font-face` de
 * `./appearance.css`. `scripts/check-contract-parity.mjs` confere as duas
 * pontas (hex contra o `theme.json`, md5 contra o storefront).
 */
import { Button, Label, Select, Text } from "@medusajs/ui"
import { type ReactNode } from "react"

import "./appearance.css"

/**
 * O valor da opção vazia: "segue o tema da loja".
 *
 * É o padrão de todo campo de aparência e o que o botão *Padrão do tema*
 * grava — restaurar **não apaga** o campo, grava a escolha que não
 * sobrescreve nada. Ver `appearanceVars` em
 * `frontend/src/lib/content/appearance.ts`.
 */
export const THEME_DEFAULT = ""

/**
 * O valor que o Radix recebe no lugar da opção vazia.
 *
 * `<Select.Item value="">` estoura em runtime: para o Radix, string vazia é
 * "nada escolhido" — o estado que mostra o placeholder —, não uma opção. Aqui
 * a opção vazia é uma escolha de verdade (e a mais comum), então ela viaja
 * como sentinela e volta a `""` na saída, que é o que o contrato grava.
 */
const THEME_DEFAULT_VALUE = "__tema__"

/** Uma cor da paleta: papel do tema → hex, para desenhar a bolinha. */
export type Palette = Record<string, string>

/** Uma fonte do tema: papel → família e pilha, para a prévia. */
export type ThemeFont = { family: string; stack: string }

export type Fonts = Record<string, ThemeFont>

/**
 * O que um controle de aparência precisa saber do campo.
 *
 * Estrutural, e não o `FieldSpec` do `field-input`: os dois arquivos se
 * importam (o `field-input` desenha os controles daqui), e um tipo local
 * evita o ciclo. Como é estrutural, o `FieldSpec` do contrato continua
 * servindo — nada a converter em lugar nenhum.
 */
export type AppearanceFieldSpec = {
  label: string
  options?: readonly string[]
  optionLabels?: Record<string, string>
  help?: string
}

/** Rótulo de uma opção: o do contrato; sem tradução, a opção crua. */
function optionLabel(spec: AppearanceFieldSpec, option: string) {
  return spec.optionLabels?.[option] ?? option
}

/** Rótulo + ajuda do campo, iguais aos dos campos de conteúdo. */
const FieldLabel = ({ spec }: { spec: AppearanceFieldSpec }) => (
  <>
    <Label size="xsmall" weight="plus">
      {spec.label}
    </Label>
    {spec.help && (
      <Text size="xsmall" className="text-ui-fg-subtle">
        {spec.help}
      </Text>
    )}
  </>
)

/**
 * Trilho de aparência: o rótulo do grupo, o botão de voltar ao padrão do
 * tema e os controles.
 *
 * O botão é um por trilho, e não um só para toda a aparência da seção, porque
 * cada trilho é uma decisão: voltar a fonte dos títulos ao padrão não tem por
 * que desfazer a cor de fundo que o lojista escolheu.
 */
export const AppearanceRail = ({
  title,
  note,
  onReset,
  children,
}: {
  title: string
  /** Aviso do trilho (ex.: fundo escuro deixa o texto claro). */
  note?: string
  onReset: () => void
  children: ReactNode
}) => (
  <div className="rv-appearance-rail">
    <div className="rv-appearance-rail-head">
      <Text size="xsmall" weight="plus" className="rv-appearance-rail-title">
        {title}
      </Text>
      <Button variant="transparent" size="small" onClick={onReset}>
        ↺ Padrão do tema
      </Button>
    </div>

    <div className="rv-appearance-rail-body">{children}</div>

    {note && (
      <Text size="xsmall" className="text-ui-fg-subtle">
        {note}
      </Text>
    )}
  </div>
)

/**
 * Cor do tema: uma bolinha por opção da paleta.
 *
 * Quem lê a bolinha é o olho — o nome do papel só aparece no *tooltip*, e por
 * isso ele fica no `data-tooltip` (o `appearance.css` desenha) e no
 * `aria-label` (leitor de tela), nunca no `title`: dois balões no mesmo hover
 * é o que acontece quando se põe o nome nos dois lugares.
 *
 * A cor escolhida aparece escrita embaixo da fileira. Não é enfeite: é a
 * única forma de o lojista saber que a seção está no padrão do tema (a
 * bolinha tracejada diz o mesmo, mas em símbolo) — e de enxergar, sem abrir
 * nada, o valor que está gravado.
 *
 * A opção vazia é a primeira de `options` no contrato, e é a única sem hex:
 * o padrão do tema depende da classe `.rv-section-*` que cada elemento usa
 * (título é `--rv-fg-strong`, texto é `--rv-muted`…), então não existe "a cor
 * padrão" para pintar. Ela sai como círculo tracejado.
 */
export const ColorPicker = ({
  spec,
  value,
  onChange,
  palette,
}: {
  spec: AppearanceFieldSpec
  value: unknown
  onChange: (value: unknown) => void
  /** `schema.palette` — papel → hex. Ausente, as bolinhas saem sem cor. */
  palette?: Palette
}) => {
  const current = String(value ?? "")

  return (
    <div className="rv-appearance-field">
      <FieldLabel spec={spec} />

      <div className="rv-swatches" role="radiogroup" aria-label={spec.label}>
        {(spec.options ?? []).map((option) => {
          const label = optionLabel(spec, option)
          const hex = palette?.[option]

          return (
            <button
              key={option || THEME_DEFAULT_VALUE}
              type="button"
              role="radio"
              aria-checked={current === option}
              aria-label={label}
              data-tooltip={label}
              data-empty={option === THEME_DEFAULT ? "true" : undefined}
              className="rv-swatch"
              style={hex ? { backgroundColor: hex } : undefined}
              onClick={() => onChange(option)}
            />
          )
        })}
      </div>

      <Text size="xsmall" className="rv-appearance-value">
        {optionLabel(spec, current)}
      </Text>
    </div>
  )
}

/**
 * Fonte do tema: a lista de papéis, cada opção desenhada na própria família.
 *
 * É o ponto do controle: "Títulos (Playfair Display)" escrito em Montserrat
 * não diz nada a quem não é designer. O gatilho mostra a escolha atual na
 * fonte dela, a lista mostra as três lado a lado e a amostra "Aa" dá corpo
 * ao que o rótulo só nomeia.
 *
 * O gatilho é um `span` próprio, e não o `Select.Value` do Radix, por dois
 * motivos: o `Select.Value` sem `children` **clona** o texto do item
 * escolhido — e o item traz a amostra "Aa" junto —, e aqui o que precisa
 * aparecer é só o rótulo, na família certa. O `aria-label` fica no gatilho,
 * então o nome acessível do combobox continua sendo o do campo.
 */
export const FontPicker = ({
  spec,
  value,
  onChange,
  fonts,
}: {
  spec: AppearanceFieldSpec
  value: unknown
  onChange: (value: unknown) => void
  /** `schema.fonts` — papel → { family, stack }. */
  fonts?: Fonts
}) => {
  const current = String(value ?? "")
  const currentFont = fonts?.[current]

  return (
    <div className="rv-appearance-field">
      <FieldLabel spec={spec} />

      <Select
        size="small"
        value={current || THEME_DEFAULT_VALUE}
        onValueChange={(next) =>
          // O sentinela só existe dentro do Radix (ver
          // `THEME_DEFAULT_VALUE`): o que sai daqui para o rascunho é `""`.
          onChange(next === THEME_DEFAULT_VALUE ? THEME_DEFAULT : next)
        }
      >
        <Select.Trigger aria-label={spec.label}>
          <span
            className="rv-font-value"
            style={currentFont ? { fontFamily: currentFont.stack } : undefined}
          >
            {optionLabel(spec, current)}
          </span>
        </Select.Trigger>

        <Select.Content>
          {(spec.options ?? []).map((option) => {
            const label = optionLabel(spec, option)
            const font = fonts?.[option]

            return (
              <Select.Item
                key={option || THEME_DEFAULT_VALUE}
                value={option || THEME_DEFAULT_VALUE}
              >
                <span
                  className="rv-font-option"
                  style={font ? { fontFamily: font.stack } : undefined}
                >
                  <span>{label}</span>
                  {/* A amostra só existe com família conhecida: sem arquivo
                      da fonte, "Aa" seria só "Aa" em Times. */}
                  {font && <span className="rv-font-option-sample">Aa</span>}
                </span>
              </Select.Item>
            )
          })}
        </Select.Content>
      </Select>
    </div>
  )
}
