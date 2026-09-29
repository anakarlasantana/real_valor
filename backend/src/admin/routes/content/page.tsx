/**
 * Página custom do admin: Conteúdo da vitrine.
 *
 * A convenção é o nome do diretório: tudo em `src/admin/routes/**` vira
 * rota no dashboard, com a URL derivada do caminho do arquivo. Por isso
 * a página abre em `/painel/content` e aparece na sidebar principal.
 *
 * Fica FORA de `routes/settings/` de propósito: o dashboard classifica o
 * item pelo prefixo do path (`DashboardApp.populateMenus`), e tudo sob
 * `/settings` cai nas extensões da sidebar de Configurações em vez do
 * menu principal. Aqui o item é uma entrada da sidebar principal
 * (`customizeId: main-sidebar`), então entra no "personalizar layout"
 * como qualquer menu nativo — reordenar, mover de seção e ocultar.
 *
 * A lista de campos de cada tipo NÃO é reescrita aqui: vem do
 * `schema.fields` que `GET /admin/content` devolve, gerado a partir de
 * `backend/src/modules/content/contract.ts`. Adicionar um campo no
 * contrato já o faz aparecer no formulário.
 *
 * O mesmo vale para o resto da tela: `schema.typeLabels` traz o nome de cada
 * tipo na listagem (o contrato decide que `editorial` se chama "Sobre") e
 * `schema.itemFields` o sub-formulário de cada item de lista. Não há tabela
 * de rótulos nem de campos de item neste arquivo — um tipo ou um campo novo
 * no contrato aparece aqui sem edição.
 *
 * O formulário respeita a **ordem** do contrato: cada campo de conteúdo sai
 * na posição dele, e cada trilho de aparência (os campos que têm `group`)
 * sai logo abaixo do campo que ele veste — o `attachedTo` do contrato é a
 * âncora declarada disso, conferida por `scripts/check-contract-parity.mjs`.
 * É a ordem do array, e não um mapa montado aqui, que decide onde a fonte do
 * título aparece na tela: uma escolha de tema só faz sentido junto da
 * coisa que ela muda.
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ArrowDownMini,
  ArrowUpMini,
  Plus,
  SquaresPlus,
  Trash,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

import type { AppearanceGroup } from "../../../modules/content/contract"
import {
  isChromeType,
  nextPosition,
  positionFor,
  renumber,
} from "../../../modules/content/order"
import type { ContentSchemaPayload } from "../../../modules/content/schema"
import { AppearanceRail } from "./appearance-controls"
import {
  FieldInput,
  type FieldSpec,
  type ItemFields,
} from "./field-input"
import { isDirty } from "./form-draft"

type Section = {
  id: string
  type: string
  enabled: boolean
  position: number
  [key: string]: unknown
}

/**
 * O que a API devolve em `schema`: o **tipo do contrato**, importado.
 *
 * Antes era uma cópia local com tudo opcional. Com o import, o painel e o
 * contrato passam a concordar por compilação: se a chave `itemFields` mudar de
 * nome ou sair do payload, esta página para de compilar — em vez de ler um
 * campo que não existe mais e a tela simplesmente perder um editor.
 *
 * `import type` não vira dependência de runtime: o *dado* continua chegando
 * pelo `schema` da API, e é esse registro (o `content_contract` no Postgres) que
 * decide o formulário.
 */
type Schema = ContentSchemaPayload

/**
 * Uma linha do formulário: um campo de conteúdo solto, ou um trilho de
 * aparência (o grupo de campos que veste o campo anterior).
 */
type FormRow =
  | { kind: "field"; spec: FieldSpec }
  | { kind: "rail"; group: string; specs: FieldSpec[] }

/**
 * O trilho do fundo da seção.
 *
 * Espelha `APPEARANCE_GROUPS` do contrato (`backend/src/modules/content/
 * contract.ts`) e existe só para o aviso de fundo escuro: é o único trilho
 * onde uma escolha tem um efeito automático que o lojista não escolheu —
 * o texto do bloco vira claro (`appearanceVars`, no storefront). A guarda de
 * paridade confere que este rótulo é um dos trilhos do contrato, então
 * renomear o trilho no contrato não deixa o aviso apontando para o nada.
 */
const BACKGROUND_RAIL: AppearanceGroup = "Fundo"

/**
 * Percorre os campos do contrato na ordem e devolve as linhas do formulário.
 *
 * É uma varredura sequencial, e não um agrupamento por tipo de campo, porque
 * a ordem é o que o contrato promete: o trilho "Títulos" vem logo depois do
 * campo que ele veste, e não numa seção "Aparência" no fim. O contrato
 * garante isso declarando os trilhos em ordem, no mesmo array (`attachedTo`
 * + a guarda de paridade), então aqui basta seguir.
 *
 * Um `rail` em andamento fecha quando o conteúdo volta ou o grupo muda; um
 * mesmo grupo aparecendo em dois trechos viraria dois trilhos com o mesmo
 * rótulo, que é o que a âncora do contrato existe para impedir.
 */
function toRows(specs: readonly FieldSpec[]): FormRow[] {
  const rows: FormRow[] = []

  for (const spec of specs) {
    const group = spec.group
    const last = rows[rows.length - 1]

    // Trilho em aberto: o campo é do mesmo grupo do último trilho empilhado.
    // Um campo de conteúdo no meio (por isso o `last.kind === "rail"`) fecha
    // o trilho — e um mesmo grupo voltando mais adiante viraria dois trilhos
    // de mesmo nome, que é o que a âncora do contrato existe para impedir.
    if (group && last?.kind === "rail" && last.group === group) {
      last.specs.push(spec)
      continue
    }

    if (group) {
      rows.push({ kind: "rail", group, specs: [spec] })
      continue
    }

    rows.push({ kind: "field", spec })
  }

  return rows
}

/**
 * O aviso do trilho, quando ele se aplica.
 *
 * Só o trilho do fundo tem aviso, e só quando a cor escolhida é uma das
 * escuras (`schema.darkTokens`): é a regra do storefront de legibilizar o
 * texto em off white quando o fundo é escuro e ninguém escolheu uma cor de
 * texto. Não é um campo para o lojista preencher — é a loja fazendo sozinha
 * algo que ele precisa saber que vai acontecer, porque escolher "Preto" e
 * ler o texto da seção em grafite na tela o faria desconfiar do CRM.
 *
 * Aviso que está sempre escrito vira ruído, então só aparece na escolha
 * escura.
 */
function railNote(
  row: Extract<FormRow, { kind: "rail" }>,
  draft: Record<string, unknown>,
  darkTokens?: readonly string[]
): string | undefined {
  if (row.group !== BACKGROUND_RAIL || !darkTokens?.length) {
    return undefined
  }

  const isDark = row.specs.some((spec) =>
    darkTokens.includes(String(draft[spec.name] ?? ""))
  )

  return isDark
    ? "Fundo escuro: o texto do bloco fica claro automaticamente, para não ficar ilegível. Escolher uma cor de texto tem efeito por cima."
    : undefined
}

/**
 * Os tipos que podem ser criados agora.
 *
 * Fora os **únicos que já existem**: cabeçalho, rodapé e barra de anúncio só
 * aceitam um bloco cada (o layout resolve os três por `find`), e a API recusa o
 * segundo — oferecer o botão seria oferecer um erro. Quem diz quais são é
 * `schema.singletonTypes`, que sai do mesmo contrato que a rota usa.
 */
function creatableTypes(schema: Schema, sections: Section[]): string[] {
  const singletons = new Set(schema.singletonTypes ?? [])
  const present = new Set(sections.map((section) => section.type))

  return (schema.types ?? []).filter(
    (type) => !singletons.has(type) || !present.has(type)
  )
}

/**
 * Uma âncora livre para o tipo escolhido (`hero`, `hero-2`, `hero-3`…).
 *
 * A âncora é o `id` do bloco e o fragmento do link (`/#hero`): sugerir uma que
 * já existe só levaria a um erro na criação, e o lojista não tem como adivinhar
 * o que está livre.
 */
function freeAnchor(type: string, sections: Section[]): string {
  const taken = new Set(sections.map((section) => section.id))

  if (!taken.has(type)) {
    return type
  }

  for (let n = 2; ; n += 1) {
    const candidate = `${type}-${n}`

    if (!taken.has(candidate)) {
      return candidate
    }
  }
}

/**
 * Os tipos que não têm ordem, como o schema os declara.
 *
 * A regra da ordem — a faixa de posições, a folga e quem tem ordem — vive em
 * `modules/content/order.ts`, com teste próprio (`order.unit.spec.ts`); aqui
 * fica só o que é da tela: as setas, a barra de aviso e o botão de salvar.
 */
const singletonTypesOf = (schema: Schema | null) => schema?.singletonTypes ?? []

const ContentPage = () => {
  const [sections, setSections] = useState<Section[]>([])
  const [schema, setSchema] = useState<Schema | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>(
    {}
  )
  const [openId, setOpenId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  /** Painel "Nova seção" aberto. */
  const [creating, setCreating] = useState(false)
  const [newType, setNewType] = useState("")
  const [newId, setNewId] = useState("")
  /**
   * Operação em andamento além do "Salvar" do formulário: criar, mover de
   * posição ou remover. Guarda o id envolvido para o botão certo entrar em
   * espera, e trava os outros — a renumeração da ordem depende de a lista
   * estar parada, e duas gravações concorrentes na mesma lista se atropelam.
   */
  const [working, setWorking] = useState<string | null>(null)

  /**
   * A ordem da vitrine **enquanto está sendo editada**, ainda não salva.
   *
   * `null` significa "a lista na tela é a que está na loja". Um array de ids
   * significa "o lojista mexeu nas setas e ainda não confirmou". Guarda só os
   * ids, e não as seções: a edição de conteúdo continua ortogonal — salvar um
   * campo não mexe na ordem pendente, e a ordem pendente sobrevive a um novo
   * carregamento dos dados.
   */
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/admin/content", { credentials: "include" })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.message ?? "Falha ao carregar o conteúdo.")
        return
      }

      const loaded: Section[] = json.sections ?? []
      setSections(loaded)
      setSchema(json.schema ?? null)
      setDrafts(
        Object.fromEntries(
          loaded.map((s) => [s.id, { ...s } as Record<string, unknown>])
        )
      )
      // A ordem pendente sobrevive a uma releitura que não mudou o conjunto de
      // seções: salvar um texto recarrega a lista, e descartar a ordem que o
      // lojista acabou de montar por causa disso seria perder trabalho sem
      // aviso. Um id que desapareceu sai da ordem, e uma seção criada entra no
      // fim — que é exatamente onde a ela cabe (ver `nextPosition`).
      setPendingOrder((current) => {
        if (!current) {
          return null
        }

        const ids = new Set(loaded.map((section) => section.id))
        const kept = current.filter((id) => ids.has(id))
        const added = loaded
          .map((section) => section.id)
          .filter((id) => !kept.includes(id))

        return [...kept, ...added]
      })
    } catch (error) {
      toast.error("Não foi possível carregar o conteúdo.")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const ordered = useMemo(
    () => [...sections].sort((a, b) => a.position - b.position),
    [sections]
  )

  /** Os tipos que não têm ordem, como o schema os declara. */
  const singletons = useMemo(() => singletonTypesOf(schema), [schema])

  /**
   * A vitrine e o cromo, separados: só a vitrine tem ordem.
   *
   * A separação sai do schema (`singletonTypes`), não de uma lista escrita
   * aqui, então um tipo declarado único no contrato já nasce sem setas — sem
   * edição nesta tela.
   */
  const chrome = useMemo(
    () => ordered.filter((section) => isChromeType(singletons, section.type)),
    [ordered, singletons]
  )

  const vitrine = useMemo(
    () => ordered.filter((section) => !isChromeType(singletons, section.type)),
    [ordered, singletons]
  )

  /** A vitrine na ordem que está na tela: a pendente, quando existe. */
  const shown = useMemo(() => {
    if (!pendingOrder) {
      return vitrine
    }

    const byId = new Map(vitrine.map((section) => [section.id, section]))

    return pendingOrder
      .map((id) => byId.get(id))
      .filter((section): section is Section => Boolean(section))
  }, [vitrine, pendingOrder])

  /**
   * A ordem pendente difere da que está na loja?
   *
   * Comparar (e não só "existe uma pendente") é o que faz a barra de aviso
   * sumir sozinha quando o lojista desfaz o movimento na mão: subir e descer a
   * mesma seção não é uma alteração a publicar, e um aviso que pede para salvar
   * o que já está salvo ensina o lojista a ignorar o aviso.
   */
  const orderDirty = useMemo(() => {
    if (!pendingOrder) {
      return false
    }

    const current = vitrine.map((section) => section.id)

    return (
      current.length !== pendingOrder.length ||
      pendingOrder.some((id, index) => current[index] !== id)
    )
  }, [pendingOrder, vitrine])

  /**
   * A lista como ela aparece na tela: o cromo primeiro, depois a vitrine.
   *
   * O cromo vem antes porque a faixa de posição dele é menor (ver
   * `FIRST_VITRINE_POSITION`) e a ordem dele é fixa — não há o que reordenar. A
   * vitrine vem na ordem pendente, quando existe.
   */
  const rows = useMemo(() => [...chrome, ...shown], [chrome, shown])

  /**
   * Em que casa da vitrine cada seção está — o índice que as setas usam.
   *
   * Existe porque a lista da tela inclui o cromo: o índice do `map` não é o da
   * vitrine, e a última seção da vitrine não é a última da lista.
   */
  const vitrineIndex = useMemo(
    () => new Map(shown.map((section, index) => [section.id, index])),
    [shown]
  )

  /** Os tipos oferecidos no "Nova seção", já sem os únicos que já existem. */
  const types = useMemo(
    () => (schema ? creatableTypes(schema, sections) : []),
    [schema, sections]
  )

  // O tipo inicial e a âncora sugerida só fazem sentido depois que o schema
  // chegou: antes disso a lista está vazia e o `<select>` não teria onde
  // pousar. O efeito também reage a uma seção criada ou removida em outra aba.
  useEffect(() => {
    if (!schema || newType) {
      return
    }

    const first = creatableTypes(schema, sections)[0] ?? ""

    setNewType(first)
    setNewId(first ? freeAnchor(first, sections) : "")
  }, [schema, sections, newType])

  const pickType = (type: string) => {
    setNewType(type)
    setNewId(freeAnchor(type, sections))
  }

  /** Cria a seção e abre o formulário dela: criar é o começo de editar. */
  const create = async () => {
    if (!newType) {
      return
    }

    setWorking("create")

    try {
      const res = await fetch("/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: newType,
          // Sem âncora, quem gera é o banco — e aí o link do menu (`/#…`) não
          // tem como apontar para a seção. Por isso o campo vem sugerido.
          ...(newId.trim() ? { id: newId.trim() } : {}),
          // A seção nova entra no FIM: a ordem que está na loja é a história
          // que o lojista já contou, e conteúdo novo não tem por que se
          // intrometer no meio dela.
          position: nextPosition(vitrine),
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.message ?? "Falha ao criar a seção.")
        return
      }

      toast.success("Seção criada. Edite o conteúdo e salve.")
      setCreating(false)
      setNewType("")
      setNewId("")
      setOpenId(json.section?.id ?? null)
      await load()
    } catch (error) {
      toast.error("Falha ao criar a seção.")
      console.error(error)
    } finally {
      setWorking(null)
    }
  }

  /**
   * Recria as seções padrão que faltam.
   *
   * Dois casos reais: o banco novo — o CRM abre vazio e não há de onde copiar o
   * conteúdo padrão, que é a cópia do protótipo — e a seção apagada por engano,
   * que volta de fábrica. Não apaga nada: só cria o que não existe, então o
   * clique é seguro para quem já tem a vitrine montada.
   */
  const restore = async () => {
    if (
      !window.confirm(
        "Criar as seções padrão que estiverem faltando? As que já existem não são alteradas."
      )
    ) {
      return
    }

    setWorking("restore")

    try {
      const res = await fetch("/admin/content/restore", {
        method: "POST",
        credentials: "include",
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(json.message ?? "Falha ao restaurar as seções padrão.")
        return
      }

      const created: string[] = json.created ?? []

      toast.success(
        created.length
          ? `Seções criadas: ${created.join(", ")}.`
          : "Nada a restaurar: as seções padrão já existem."
      )
      await load()
    } catch (error) {
      toast.error("Falha ao restaurar as seções padrão.")
      console.error(error)
    } finally {
      setWorking(null)
    }
  }

  /**
   * Move uma seção uma casa para cima ou para baixo — **na tela**.
   *
   * Não grava. A ordem é uma decisão da lista inteira, então ela é conferida
   * antes de virar verdade na loja: o clique só reordena o estado local e acende
   * a barra de "ordem não salva". Quem grava é o `saveOrder`.
   *
   * Guarda só a ordem da vitrine: o cromo não entra (ver `isChrome`), então as
   * setas nunca sugerem que o cabeçalho pode descer na página.
   */
  const move = (id: string, direction: -1 | 1) => {
    const ids = shown.map((section) => section.id)
    const from = ids.indexOf(id)
    const to = from + direction

    if (from < 0 || to < 0 || to >= ids.length) {
      return
    }

    const next = [...ids]
    const [moved] = next.splice(from, 1)

    next.splice(to, 0, moved)

    setPendingOrder(next)
  }

  /**
   * Publica a ordem da vitrine: renumera (100, 110, 120…) e grava o que mudou.
   *
   * A renumeração da lista inteira, e não a troca de dois valores, é o que
   * impede `position` repetida — com dois números iguais a loja ordena por
   * sorteio, e o lojista não tem como consertar isso digitando. A faixa começa em
   * `FIRST_VITRINE_POSITION` para não invadir a do cromo. Só o que muda de fato é
   * gravado, uma requisição por seção que mudou de lugar.
   *
   * A gravação é sequencial de propósito: em paralelo, uma falha no meio
   * deixaria a lista da loja com uma ordem que ninguém pediu, e o aviso não
   * saberia dizer o que ficou gravado. Abortando no primeiro erro, a mensagem é
   * honesta — "salve de novo" — e a ordem pendente continua na tela.
   *
   * O que sai daqui é um PATCH por seção, e a rota admin avisa a loja a cada um
   * (`notifyStorefront`): a vitrine se reposiciona em segundos.
   */
  const saveOrder = async () => {
    if (!orderDirty) {
      return
    }

    setWorking("order")

    try {
      // A numeração sai da regra (`modules/content/order.ts`), que devolve só as
      // seções que mudam de posição — a ordem do array é a ordem da tela.
      for (const { id, position } of renumber(shown)) {
        const res = await fetch(
          `/admin/content?id=${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ position }),
          }
        )

        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          toast.error(
            json.message ??
              "Falha ao salvar a ordem. Salve de novo para concluir."
          )
          return
        }
      }

      setPendingOrder(null)
      await load()
      toast.success("Ordem salva. A loja publica em segundos.")
    } catch (error) {
      toast.error("Falha ao salvar a ordem. Salve de novo para concluir.")
      console.error(error)
    } finally {
      setWorking(null)
    }
  }

  /**
   * Remove a seção, com confirmação.
   *
   * A confirmação é do navegador de propósito: não há desfazer (a linha sai do
   * banco) e recriar a seção não devolve o que havia nela — a seção nova nasce
   * com o conteúdo padrão do tipo.
   */
  const remove = async (section: Section) => {
    const label = schema?.typeLabels?.[section.type] ?? section.type

    if (
      !window.confirm(
        `Remover a seção "${label}" (#${section.id})? Não há como desfazer.`
      )
    ) {
      return
    }

    setWorking(section.id)

    try {
      const res = await fetch(
        `/admin/content?id=${encodeURIComponent(section.id)}`,
        { method: "DELETE", credentials: "include" }
      )
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(json.message ?? "Falha ao remover a seção.")
        return
      }

      toast.success("Seção removida.")
      await load()
    } catch (error) {
      toast.error("Falha ao remover a seção.")
      console.error(error)
    } finally {
      setWorking(null)
    }
  }

  const setFields = (id: string, patch: Record<string, unknown>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  const setField = (id: string, name: string, value: unknown) => {
    setFields(id, { [name]: value })
  }

  /**
   * Devolve o formulário ao que está gravado, descartando o que não foi salvo.
   *
   * O rascunho é estado de tela, não banco: descartar é reler a seção que veio do
   * servidor. É o par do "Descartar" da barra de ordem, e o mesmo que o `load`
   * faz depois de salvar.
   */
  const discardFields = (section: Section) => {
    setDrafts((prev) => ({ ...prev, [section.id]: { ...section } }))
  }

  /**
   * Devolve um trilho inteiro ao padrão do tema.
   *
   * O valor gravado é a opção vazia — o contrato já define `""` como
   * "segue o tema da loja" —, então restaurar não apaga o campo: grava a
   * escolha que não sobrescreve nada. Como no resto da página, a mudança
   * fica no rascunho até o "Salvar"; é o que permite conferir os campos
   * antes de publicar.
   *
   * Um botão por trilho, e não um só para a seção toda: voltar a fonte dos
   * títulos ao padrão não tem por que desfazer a cor de fundo que o lojista
   * escolheu a três linhas de distância.
   */
  const resetFields = (id: string, fields: readonly FieldSpec[]) => {
    setFields(id, Object.fromEntries(fields.map((field) => [field.name, ""])))
  }

  const save = async (section: Section) => {
    setSavingId(section.id)

    try {
      const draft = drafts[section.id] ?? {}
      const specs = schema?.fields[section.type] ?? []

      // `id` e `type` são imutáveis: só colunas + campos de `data` vão
      // no corpo. A rota admin rejeita campo desconhecido.
      //
      // `position` **não** entra: quem manda na ordem é a lista (setas + "Salvar
      // ordem"). Mandar a posição daqui reescreveria a ordem gravada com o valor
      // que o formulário leu quando abriu — o formulário aberto desde antes de
      // uma reordenação traria o número velho de volta.
      const body: Record<string, unknown> = {
        enabled: draft.enabled,
      }
      for (const spec of specs) {
        body[spec.name] = draft[spec.name]
      }

      const res = await fetch(
        `/admin/content?id=${encodeURIComponent(section.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        }
      )
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.message ?? "Falha ao salvar.")
        return
      }

      toast.success("Conteúdo salvo.")
      await load()
    } catch (error) {
      toast.error("Falha ao salvar.")
      console.error(error)
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <Container>
        <Text size="small">Carregando conteúdo…</Text>
      </Container>
    )
  }

  return (
    <Container className="flex flex-col gap-y-4">
      <div className="flex items-start justify-between">
        <div>
          <Heading level="h1">Conteúdo da vitrine</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Estas seções montam a página inicial. A ordem é a das setas e só vale
            depois de “Salvar ordem”. As seções marcadas como Cromo — barra de
            anúncio, cabeçalho e rodapé — aparecem em todas as páginas da loja e
            não têm ordem. Ao editar uma seção, a barra “Alterações não salvas”
            aparece com o botão Salvar. A aparência entra junto do campo que ela
            muda: em branco, a seção segue o tema da loja — inclusive quando o
            tema é sazonal.
          </Text>
        </div>
        <div className="flex shrink-0 items-center gap-x-2">
          <Button
            size="small"
            variant={creating ? "secondary" : "primary"}
            onClick={() => setCreating((open) => !open)}
          >
            {creating ? "Fechar" : "Nova seção"}
          </Button>
          <Button
            variant="secondary"
            size="small"
            isLoading={working === "restore"}
            disabled={working !== null && working !== "restore"}
            onClick={restore}
          >
            Restaurar padrão
          </Button>
          <Button variant="secondary" size="small" onClick={load}>
            Recarregar
          </Button>
        </div>
      </div>

      {/* A barra só aparece quando há diferença real entre a tela e a loja:
          subir e descer a mesma seção não é alteração a publicar. */}
      {orderDirty && (
        <Container className="flex items-center justify-between gap-x-4 bg-ui-bg-subtle">
          <div>
            <Text size="small" weight="plus">
              Ordem alterada — ainda não salva
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              A loja continua mostrando a ordem anterior até você salvar. As
              demais edições desta tela não dependem disto.
            </Text>
          </div>
          <div className="flex shrink-0 items-center gap-x-2">
            <Button
              variant="secondary"
              size="small"
              disabled={working !== null}
              onClick={() => setPendingOrder(null)}
            >
              Descartar
            </Button>
            <Button
              size="small"
              isLoading={working === "order"}
              disabled={working !== null && working !== "order"}
              onClick={saveOrder}
            >
              Salvar ordem
            </Button>
          </div>
        </Container>
      )}

      {creating && (
        <Container className="flex flex-col gap-y-4">
          <div>
            <Heading level="h2">Nova seção</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              A seção nasce com o conteúdo padrão do tipo e entra no fim da
              lista: crie, edite e salve. Os tipos únicos que já existem
              (cabeçalho, rodapé e a barra de anúncio) não aparecem aqui porque
              a loja só desenha um de cada.
            </Text>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Tipo
              </Label>
              <select
                className="h-8 rounded-md border border-ui-border-base bg-ui-bg-field px-2 text-sm"
                value={newType}
                onChange={(e) => pickType(e.target.value)}
              >
                {types.map((type) => (
                  <option key={type} value={type}>
                    {schema?.typeLabels?.[type] ?? type}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Âncora
              </Label>
              <Input
                value={newId}
                placeholder="hero"
                onChange={(e) => setNewId(e.target.value)}
              />
              <Text size="xsmall" className="text-ui-fg-subtle">
                É o id da seção e o destino que o menu usa (ex.: /#hero):
                minúsculas, números e hífen. Já vem sugerida livre.
              </Text>
            </div>
          </div>

          <div className="flex justify-end gap-x-2">
            <Button
              variant="secondary"
              size="small"
              onClick={() => setCreating(false)}
            >
              Cancelar
            </Button>
            <Button
              size="small"
              isLoading={working === "create"}
              disabled={!newType}
              onClick={create}
            >
              <Plus /> Criar seção
            </Button>
          </div>
        </Container>
      )}

      {rows.map((section) => {
        const draft = drafts[section.id] ?? {}
        const specs = schema?.fields[section.type] ?? []
        const isOpen = openId === section.id
        // Só a vitrine tem ordem: o cromo é desenhado pela moldura da loja, em
        // todas as rotas, e a posição dele não muda o que aparece onde.
        const movable = !isChromeType(singletons, section.type)
        const place = vitrineIndex.get(section.id) ?? 0
        // Alteração pendente no formulário: é o que faz a barra com o "Salvar"
        // aparecer (ver `form-draft.ts`).
        const dirty = isDirty(draft, section)

        return (
          <Container key={section.id} className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-x-4 p-4">
              <div className="flex items-center gap-x-3">
                {movable ? (
                  // O numeral é a ordem da seção — ou a que ela **vai** ter: com
                  // a lista já mexida na tela e ainda não salva, o número gravado
                  // não corresponde mais ao que se vê.
                  <Badge size="2xsmall">
                    {orderDirty ? positionFor(place) : section.position}
                  </Badge>
                ) : (
                  <Badge size="2xsmall" color="grey">
                    Cromo
                  </Badge>
                )}
                <div>
                  <Text weight="plus" size="small">
                    {schema?.typeLabels?.[section.type] ?? section.type}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {/* `#id` é a âncora que o menu usa: um Destino
                        `/#editorial` rola até esta seção. */}
                    #{section.id} · {section.type}
                  </Text>
                </div>
              </div>

              <div
                className={`flex items-center gap-x-2 ${
                  working === section.id ? "opacity-50" : ""
                }`}
              >
                <Badge
                  size="2xsmall"
                  color={section.enabled ? "green" : "grey"}
                >
                  {section.enabled ? "Visível" : "Oculta"}
                </Badge>

                {/* Ordem por setas, e não por um número digitado: posições
                    iguais são ordem indefinida na loja (a vitrine ordena por
                    `position`) e adivinhar um número livre é tarefa que ninguém
                    quer. As setas mexem **na tela** — valem depois de "Salvar
                    ordem" — e não existem no cromo, que não tem ordem. */}
                {movable && (
                  <>
                    <Button
                      variant="transparent"
                      size="small"
                      aria-label={`Mover ${section.id} para cima`}
                      disabled={place === 0 || working !== null}
                      onClick={() => move(section.id, -1)}
                    >
                      <ArrowUpMini />
                    </Button>
                    <Button
                      variant="transparent"
                      size="small"
                      aria-label={`Mover ${section.id} para baixo`}
                      disabled={
                        place === shown.length - 1 || working !== null
                      }
                      onClick={() => move(section.id, 1)}
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
                  onClick={() => remove(section)}
                >
                  <Trash />
                </Button>

                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setOpenId(isOpen ? null : section.id)}
                >
                  {isOpen ? "Fechar" : "Editar"}
                </Button>
              </div>
            </div>

            {isOpen && (
              <div className="flex flex-col gap-y-5 border-t border-ui-border-base p-4">
                {/* A barra da seção, irmã da barra da ordem: aparece quando o
                    formulário tem alteração não salva, e é o **único** "Salvar"
                    do formulário — fora dela não há o que salvar. Fica no topo
                    porque os trilhos de aparência esticam a seção, e um botão no
                    fim de um formulário longo é um botão que ninguém acha. */}
                {dirty && (
                  <div className="flex items-center justify-between gap-x-4 rounded-md bg-ui-bg-subtle p-3">
                    <div>
                      <Text size="small" weight="plus">
                        Alterações não salvas nesta seção
                      </Text>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        A loja continua mostrando o conteúdo anterior até você
                        salvar. Ordem é outro assunto: ela vai no “Salvar ordem”
                        da lista.
                      </Text>
                    </div>
                    <div className="flex shrink-0 items-center gap-x-2">
                      <Button
                        variant="secondary"
                        size="small"
                        disabled={savingId === section.id}
                        onClick={() => discardFields(section)}
                      >
                        Descartar
                      </Button>
                      <Button
                        size="small"
                        isLoading={savingId === section.id}
                        onClick={() => save(section)}
                      >
                        Salvar
                      </Button>
                    </div>
                  </div>
                )}

                {toRows(specs).map((row) => {
                  // Um campo de conteúdo e um campo de trilho se desenham do
                  // mesmo jeito: quem muda o desenho é o `kind`, que veio do
                  // contrato.
                  const field = (spec: FieldSpec) => (
                    <FieldInput
                      key={spec.name}
                      spec={spec}
                      value={draft[spec.name]}
                      onChange={(value) =>
                        setField(section.id, spec.name, value)
                      }
                      itemFields={schema?.itemFields ?? {}}
                      palette={schema?.palette}
                      fonts={schema?.fonts}
                    />
                  )

                  return row.kind === "field" ? (
                    field(row.spec)
                  ) : (
                    <AppearanceRail
                      key={`rail:${row.group}`}
                      title={row.group}
                      note={railNote(row, draft, schema?.darkTokens)}
                      onReset={() => resetFields(section.id, row.specs)}
                    >
                      {row.specs.map(field)}
                    </AppearanceRail>
                  )
                })}

                <div className="flex items-center gap-x-3">
                  <Switch
                    checked={Boolean(draft.enabled)}
                    onCheckedChange={(checked) =>
                      setField(section.id, "enabled", checked)
                    }
                  />
                  <Label size="small" weight="plus">
                    Visível na loja
                  </Label>
                </div>
              </div>
            )}
          </Container>
        )
      })}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Conteúdo da vitrine",
  icon: SquaresPlus,
})

export default ContentPage
