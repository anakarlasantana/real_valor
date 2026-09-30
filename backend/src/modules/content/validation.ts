/**
 * A validação de entrada do CRM — o que o corpo pode dizer.
 * -------------------------------------------------------------------------
 * Mora fora da rota (`api/admin/content/route.ts`) porque é a parte que **não**
 * depende de request, resposta nem container: recebe o tipo, o `data`, os campos
 * do schema e as referências, e devolve a lista de erros legíveis. A rota ficou
 * com o que é dela — ler o corpo, decidir o status e falar com o banco.
 *
 * O que se valida aqui, e por quê:
 *
 * - **campo desconhecido** — o corpo que traz uma chave que o tipo não declara: o
 *   `data` guardaria algo que nenhum render lê, e o lojista veria "salvo";
 * - **referência** — `filters` (os chips) também é campo de contrato e passa por
 *   esta porta, com o mesmo tratamento do `data`: chave que o tipo não declara é
 *   erro, e `kind` de lista exige lista;
 * - **obrigatório** — só no POST (`strict`): no PATCH um campo ausente continua
 *   valendo o que está gravado, e exigir os obrigatórios acusaria erro em
 *   qualquer edição de um campo só;
 * - **faixa de número** — `min`/`max` vêm do CAMPO (`contract.ts`), e não desta
 *   função: o `<input>` do painel mostra a mesma, e um campo numérico novo nasce
 *   com a faixa que precisa;
 * - **lista fechada** — `select`, `color` e `font` são a mesma coisa para a
 *   validação (`CHOICE_KINDS`): quem garante que não viram texto livre é a
 *   comparação com `options`;
 * - **formato** — campo com `pattern` (`hex` da paleta da estação, `MM-DD` da
 *   janela de datas): a regex vem do CAMPO, como a faixa do número, e o que não
 *   casar é recusado aqui. É a forma do valor que o `kind` não descreve.
 *
 * O schema vem do **registro no banco** (`service.getContract()`), e é a rota
 * quem o passa: é o registro que diz o que o CRM pode gravar, e o `contract.ts`
 * só entra por baixo, quando o registro não existe.
 */
import { THEME_SURFACE, THEME_TYPE, type FieldKind } from "./contract"
import type { ContentSchemaPayload } from "./schema"

/**
 * Os `kind` que guardam um valor de `options` — escolha dentro de uma lista
 * fechada. `color` e `font` são a mesma coisa que `select` para a
 * validação: mudam só no desenho do editor (bolinha de cor, lista de fontes
 * com prévia). Quem garante que eles não viram texto livre é esta lista.
 */
const CHOICE_KINDS: readonly FieldKind[] = ["select", "color", "font"]

/**
 * Validação de entrada do admin contra `contract.ts`.
 *
 * Devolve a lista de erros legíveis, ou `[]` se estiver válido.
 *
 * `strict` controla os campos obrigatórios:
 *   true  → POST. Todo campo obrigatório precisa vir no corpo.
 *   false → PATCH, que é parcial. Um campo ausente continua valendo o
 *           que já está gravado, então só se valida o que foi enviado.
 *           Exigir os obrigatórios aqui acusaria erro em qualquer
 *           edição de um campo só.
 */
export function validateData(
  type: string,
  data: Record<string, unknown>,
  {
    strict,
    fields,
    references = {},
  }: {
    strict: boolean
    fields: ContentSchemaPayload["fields"]
    /**
     * Os campos de contrato que são **referência** (`filters`, os chips de
     * categoria): vieram no corpo, mas não vivem no `data` — quem os tira de lá
     * é o `splitPayload` (`modules/content/payload.ts`).
     *
     * Eles entram na conferência por dois motivos: um `filters` num tipo que não
     * tem o campo é erro (como qualquer chave desconhecida), e o `kind` do campo
     * vale para ele igual — `list:category` é lista, e uma lista que não é lista
     * é o mesmo defeito de um `items` que não é lista.
     */
    references?: Record<string, unknown>
  }
): string[] {
  const errors: string[] = []
  // `?? []` e a checagem abaixo existem por causa de um caso real: a entrada
  // `footer` saiu de `SECTION_FIELDS` e o `map` estourava com 500 ("Cannot
  // read properties of undefined"), que para o lojista é só "ocorreu um erro
  // desconhecido" — e nenhum guard reprovava, porque a paridade tolera a
  // chave faltando dos dois lados. Tipo sem campos é bug de contrato, não
  // dado ruim: melhor uma mensagem que aponta o arquivo.
  // Os campos vêm do **registro no banco** (`service.getContract()`), e não do
  // `SECTION_FIELDS` do código: é o registro que diz o que o CRM pode gravar.
  // O `contract.ts` só entra por baixo, quando o registro não existe.
  const specs = fields[type] ?? []

  if (!specs.length) {
    return [
      `O tipo "${type}" não tem campos no schema gravado ` +
        `(backend/src/modules/content/schema.ts).`,
    ]
  }

  const known = new Set(specs.map((f) => f.name))

  for (const key of Object.keys(data)) {
    if (!known.has(key)) {
      errors.push(`Campo desconhecido para "${type}": "${key}".`)
    }
  }

  // A referência passa pela mesma porta: `filters` num tipo que não declara o
  // campo é campo desconhecido — a seção não tem chips, e gravar o link dela
  // seria uma linha que nenhum render lê.
  for (const key of Object.keys(references)) {
    if (!known.has(key)) {
      errors.push(`Campo desconhecido para "${type}": "${key}".`)
    }
  }

  for (const spec of specs) {
    // O valor pode estar no `data` ou na referência — os dois chegaram no corpo,
    // e o `kind` do campo decide o que fazer com ele.
    const inData = Object.prototype.hasOwnProperty.call(data, spec.name)
    const present =
      inData || Object.prototype.hasOwnProperty.call(references, spec.name)
    const value = inData ? data[spec.name] : references[spec.name]

    // Ausente num PATCH não é erro: mantém o valor atual.
    if (!present && !strict) {
      continue
    }

    if (value === undefined || value === null || value === "") {
      if (spec.required) {
        errors.push(`Campo obrigatório ausente: "${spec.name}".`)
      }
      continue
    }

    if (spec.kind === "number") {
      if (typeof value !== "number") {
        errors.push(`Campo "${spec.name}" deve ser número.`)
      } else {
        // A faixa vem do CAMPO (`min`/`max` no contrato), não daqui: o
        // `<input>` do painel mostra a mesma, e um campo numérico novo nasce
        // com a faixa que precisa. Antes, a única faixa era a do `overlay` do
        // hero, escrita nesta função — e qualquer número novo herdava 0 a 1.
        if (typeof spec.min === "number" && value < spec.min) {
          errors.push(`Campo "${spec.name}" não pode ser menor que ${spec.min}.`)
        }

        if (typeof spec.max === "number" && value > spec.max) {
          errors.push(`Campo "${spec.name}" não pode ser maior que ${spec.max}.`)
        }
      }
    }

    if (
      CHOICE_KINDS.includes(spec.kind) &&
      !spec.options?.includes(value as never)
    ) {
      // A opção vazia não se escreve: sem o "(vazio)" a mensagem sairia
      // começando por vírgula ("deve ser um de: , rose, …").
      const options = (spec.options ?? []).map((option) =>
        option === "" ? "(vazio = padrão do tema)" : option
      )

      errors.push(`Campo "${spec.name}" deve ser um de: ${options.join(", ")}.`)
    }

    // O campo de texto com forma (`hex` da paleta da estação, `MM-DD` da janela
    // de datas) é o que o `kind` sozinho não descreve. Sem esta checagem um
    // `#B9787` (cinco dígitos) seria gravado e chegaria ao storefront como
    // variável CSS inválida — o `var()` não cai no fallback quando a variável
    // existe e não resolve, então a cor sumiria sem erro nenhum.
    if (
      spec.pattern &&
      typeof value === "string" &&
      !new RegExp(spec.pattern).test(value)
    ) {
      errors.push(
        `Campo "${spec.name}" deve estar no formato esperado ` +
          `(${spec.pattern}).`
      )
    }

    if (spec.kind.startsWith("list:") && !Array.isArray(value)) {
      errors.push(`Campo "${spec.name}" deve ser uma lista.`)
    }
  }

  return errors
}
/**
 * O `type` que a API aceita.
 *
 * Sai do **registro** (`schema.types`), não de `isSectionType`: um tipo novo
 * gravado no schema passa a ser gravável sem tocar em código — que é o ponto de
 * o schema ser dado. O contrato segue sendo o bootstrap do registro.
 *
 * Desde a v6 a lista inclui `theme`: o tema é conteúdo como uma seção, e sem
 * ele aqui a primeira gravação de uma estação seria recusada.
 */
export function isKnownType(
  type: unknown,
  schema: ContentSchemaPayload
): type is string {
  return (
    typeof type === "string" &&
    (schema.types as readonly string[]).includes(type)
  )
}

/**
 * Amarra a `surface` ao `type` do bloco, no lugar do lojista.
 *
 * Cada superfície tem um só tipo de conteúdo: a `home` guarda seções, a
 * `theme` guarda a paleta. Um `hero` na `theme` não seria lido por ninguém (a
 * loja lê aquela superfície esperando estação) e um `theme` na `home` chegaria
 * ao render da vitrine como tipo desconhecido — então a API recusa a
 * combinação em vez de gravar dado que some na tela. O bloco de tema, por sua
 * vez, nasce na superfície dele mesmo que o corpo não a mencione: quem manda é
 * a API, não o cliente.
 *
 * Pura de propósito, e fora da rota: são **duas** portas que gravam superfície
 * (`POST` e `PATCH`) e o teste da regra não precisa de request nem container.
 *
 * @returns `{ surface }` quando há o que gravar (ausente em `PATCH` que não
 *          tocou na coluna), `{ error }` quando a combinação é inválida.
 */
export function resolveSurface(
  sent: unknown,
  type: string
): { surface?: string; error?: string } {
  if (type === THEME_TYPE) {
    return { surface: THEME_SURFACE }
  }

  const surface = typeof sent === "string" && sent ? sent : undefined

  if (surface === THEME_SURFACE) {
    return {
      error:
        `A superfície "${THEME_SURFACE}" só aceita blocos de type ` +
        `"${THEME_TYPE}".`,
    }
  }

  return surface ? { surface } : {}
}

