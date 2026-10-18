/**
 * A linha de uma seção: numeral, setas, interruptor, formulário e trilhos.
 * -------------------------------------------------------------------------
 * Portada de `page.tsx` para o refactor não perder o que ela já fazia: o numeral
 * previsto (`numeralFor`, em `../lib/utils`), a etiqueta "Fixo" da seção ancorada, as
 * setas que mexem **na tela** (quem publica é o "Salvar ordem", na lista), a
 * barra de alterações pendentes com Descartar/Salvar e o formulário desenhado das
 * linhas do contrato (`toRows`) — com cada trilho de aparência logo abaixo do
 * campo que ele veste.
 *
 * O `FieldInput` recebe o que ele declara receber (`itemFields`, `palette`,
 * `fonts`, `categories`, `marks`, `destinations`), e não um saco `references`:
 * era esse desencontro que fazia a bolinha de cor e a lista de fontes não
 * aparecerem — e que derrubava a seção inteira em runtime, porque `itemFields`
 * chegava `undefined` e o sub-formulário da lista lia a chave de um undefined.
 */
import { ArrowDownMini, ArrowUpMini, Trash } from "@medusajs/icons"
import { Badge, Button, Container, Label, Switch, Text } from "@medusajs/ui"

import { AppearanceRail } from "./appearance-controls"
import { FieldInput, type FieldSpec } from "./field-input"
import { isDirty } from "../lib/form-draft"
import { railNote, toRows } from "../lib/utils"
import type { SectionRowProps } from "../lib/types"

export function SectionRow({
  section,
  draft,
  schema,
  surface,
  categories,
  numeral,
  movable,
  isOpen,
  place,
  shownLength,
  working,
  savingId,
  onToggleOpen,
  onUpdate,
  onDiscard,
  onSave,
  onRemove,
  onMove,
}: SectionRowProps) {
  const specs = schema?.fields[section.type] ?? []
  const typeLabel = schema?.typeLabels?.[section.type] ?? section.type
  const dirty = isDirty(draft, section)

  /**
   * O nome que o bloco mostra.
   *
   * A superfície diz como ele se chama: a estação usa o rótulo que o dono
   * escreveu (`titleField` — "Natal"), a seção usa o nome do tipo, porque o
   * `type` é o identificador do render. `titleField: null` é o caso das seções.
   */
  const title = String(
    (surface.titleField ? draft[surface.titleField] : "") || typeLabel,
  )

  // O rascunho vai inteiro porque o recorte é irmão da foto (`imageUrlCrop`).
  const field = (spec: FieldSpec) => (
    <FieldInput
      key={spec.name}
      spec={spec}
      value={draft[spec.name]}
      onChange={(value) => onUpdate(section.id, { [spec.name]: value })}
      itemFields={schema?.itemFields ?? {}}
      palette={schema?.palette}
      fonts={schema?.fonts}
      categories={categories}
      marks={schema?.markdownMarks}
      destinations={schema?.destinations}
      sectionType={section.type}
      sectionLayout={draft.layout}
      cropFrames={schema?.cropFrames}
      cropHelp={schema?.crop}
      data={draft}
      onPatch={(patch) => onUpdate(section.id, patch)}
    />
  )

  /**
   * Devolve um trilho inteiro ao padrão do tema.
   *
   * O valor gravado é a opção vazia — o contrato já define `""` como "segue o
   * tema da loja" —, então restaurar não apaga o campo: grava a escolha que não
   * sobrescreve nada. Um botão por trilho, e não um só para a seção toda: voltar
   * a fonte dos títulos ao padrão não tem por que desfazer a cor de fundo que o
   * lojista escolheu a três linhas de distância.
   */
  const resetRail = (rail: readonly FieldSpec[]) => {
    onUpdate(
      section.id,
      Object.fromEntries(rail.map((spec) => [spec.name, ""])),
    )
  }

  return (
    <Container className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-x-4 p-4">
        <div className="flex items-center gap-x-3">
          {movable ? (
            // O numeral: a casa gravada, ou a que a seção vai receber quando a
            // pendente for publicada (a previsão é do painel de lista).
            <Badge size="2xsmall">{numeral}</Badge>
          ) : (
            // A seção fixa mostra a **casa** dela — 1, 2, 3, 4 e 10 na home: é o
            // número que ela ocupa sempre. O "Fixo" ao lado diz que nenhuma seta
            // a move; as duas informações juntas são o desenho da numeração.
            <div className="flex shrink-0 items-center gap-x-2">
              <Badge size="2xsmall">{numeral}</Badge>
              <Badge size="2xsmall" color="grey">
                Fixo
              </Badge>
            </div>
          )}
          <div>
            <Text weight="plus" size="small">
              {title}
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {/* `#id` é a âncora que o menu usa: um Destino `/#editorial` rola
                  até esta seção. */}
              #{section.id} · {section.type}
            </Text>
          </div>
        </div>

        <div
          className={`flex items-center gap-x-2 ${
            working === section.id ? "opacity-50" : ""
          }`}
        >
          <Badge size="2xsmall" color={section.enabled ? "green" : "grey"}>
            {section.enabled ? (surface.enabledLabel ?? "Visível") : "Oculta"}
          </Badge>

          {/* Ordem por setas, e não por um número digitado: posições iguais são
              ordem indefinida na loja (a vitrine ordena por `position`) e
              adivinhar um número livre é tarefa que ninguém quer. As setas mexem
              **na tela** — valem depois do "Salvar ordem" — e não existem no
              cromo, que não tem ordem. */}
          {movable && (
            <>
              <Button
                variant="transparent"
                size="small"
                aria-label={`Mover ${section.id} para cima`}
                disabled={place === 0 || working !== null}
                onClick={() => onMove(section.id, -1)}
              >
                <ArrowUpMini />
              </Button>
              <Button
                variant="transparent"
                size="small"
                aria-label={`Mover ${section.id} para baixo`}
                disabled={place === shownLength - 1 || working !== null}
                onClick={() => onMove(section.id, 1)}
              >
                <ArrowDownMini />
              </Button>
            </>
          )}

          <Button
            variant="transparent"
            size="small"
            aria-label={`Remover a seção ${section.id}`}
            disabled={working !== null}
            onClick={() => onRemove(section.id)}
          >
            <Trash />
          </Button>

          <Button
            variant="secondary"
            size="small"
            onClick={() => onToggleOpen(isOpen ? null : section.id)}
          >
            {isOpen ? "Fechar" : "Editar"}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="flex flex-col gap-y-5 border-t border-ui-border-base p-4">
          {/* A barra da seção, irmã da barra da ordem: aparece quando o
              formulário tem alteração não salva, e é o **único** "Salvar" do
              formulário. Fica no topo porque os trilhos de aparência esticam a
              seção, e um botão no fim de um formulário longo é um botão que
              ninguém acha. */}
          {dirty && (
            <div className="flex items-center justify-between gap-x-4 rounded-md bg-ui-bg-subtle p-3">
              <div>
                <Text size="small" weight="plus">
                  Alterações não salvas nesta seção
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  A loja continua mostrando o conteúdo anterior até você salvar.
                  Ordem é outro assunto: ela vai no “Salvar ordem” da lista.
                </Text>
              </div>
              <div className="flex shrink-0 items-center gap-x-2">
                <Button
                  variant="secondary"
                  size="small"
                  disabled={savingId === section.id}
                  onClick={() => onDiscard(section)}
                >
                  Descartar
                </Button>
                <Button
                  size="small"
                  isLoading={savingId === section.id}
                  onClick={() => void onSave(section.id)}
                >
                  Salvar
                </Button>
              </div>
            </div>
          )}

          {toRows(specs).map((row) =>
            row.kind === "field" ? (
              field(row.spec)
            ) : (
              <AppearanceRail
                key={`rail:${row.group}`}
                title={row.group}
                note={railNote(row, draft, schema?.darkTokens)}
                onReset={() => resetRail(row.specs)}
              >
                {row.specs.map(field)}
              </AppearanceRail>
            ),
          )}

          <div className="flex items-center gap-x-3">
            <Switch
              checked={Boolean(draft.enabled)}
              onCheckedChange={(checked) =>
                onUpdate(section.id, { enabled: checked })
              }
            />
            <Label size="small" weight="plus">
              {surface.enabledLabel ?? "Visível na loja"}
            </Label>
          </div>
        </div>
      )}
    </Container>
  )
}
