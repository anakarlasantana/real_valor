/**
 * O schema do CRM: o que o formulário é, em um único objeto.
 * -------------------------------------------------------------------------
 * **Por que um arquivo só para isto.** O payload do `GET /admin/content` é
 * montado num lugar só — aqui — porque **duas** pontas precisam dele: a rota
 * que devolve e o `seed-schema` que grava no banco. Quando a montagem estava
 * escrita dentro da rota, o seed teria que repetir a lista de chaves, e as
 * duas pontas divergiriam sem ninguém perceber (é a mesma classe de defeito
 * dos espelhos que a guarda de paridade caça nos dois apps).
 *
 * **O contrato é bootstrap; o banco é a fonte.** Este arquivo monta o schema a
 * partir de `contract.ts`, e `service.getSchema()` prefere o registro gravado
 * no Postgres, caindo aqui só quando a linha não existe (ou quando o schema
 * gravado está vazio). Ver `service.ts`.
 */
import {
  CONTENT_SURFACES,
  CONTENT_TYPES,
  ITEM_FIELDS,
  MARKDOWN_MARKS,
  SECTION_FIELDS,
  SECTION_TYPE_LABELS,
  SINGLETON_SECTION_TYPES,
  THEME_COLOR_HEXES,
  THEME_DARK_TOKENS,
  THEME_FIELDS,
  THEME_FONTS,
  THEME_TYPE,
  THEME_TYPE_LABEL,
  type ContentSurfaceSpec,
  type FieldSpec,
  type ItemFieldSpec,
  type MarkdownMark,
} from "./contract.ts"

/**
 * A versão do schema: o `schemaVersion` que a loja recebe no payload.
 *
 * Mora **no contrato**, e não no banco, por um motivo: se a versão derivasse
 * do registro, ninguém veria a divergência entre o schema que gravou os dados
 * e o schema que está no código. Aqui ela é carimbada na escrita
 * (`seed-schema`), o que faz "mudei o contrato e não atualizei o registro"
 * aparecer como diff — e é o que o `--check` do seed-schema acusa.
 *
 * Sobe quando o **formato** do schema muda de um jeito que o CRM/storefront
 * precisam notar: chave nova, campo removido, tipo novo. Não precisa subir
 * para ajuste de rótulo ou texto de `help` — é o mesmo formato.
 *
 * v2 — os campos de imagem (`imageUrl` do hero, do banner e dos itens de
 *      coleção e do Instagram) deixaram de ser texto e passaram a ser
 *      `kind: "image"`: o editor ganha envio de arquivo, e o valor gravado
 *      passa a ser a chave do arquivo. O `--check` do seed-schema acusa o
 *      registro velho, então a v1 gravada em um banco existente precisa ser
 *      reescrita com `make seed-schema` — sem isso o CRM continua mostrando
 *      uma caixa de texto onde já existe um botão de envio.
 *
 * v3 — o payload ganhou `singletonTypes`: o CRM precisa saber quais tipos são
 *      únicos (cabeçalho, rodapé, barra de anúncio) para não oferecer uma
 *      segunda seção que a loja nunca desenharia.
 *
 * v4 — tipo novo: `launches`, o trilho de novidades depois do hero. É um
 *      formato novo (a loja desenha por `switch` de tipo) e o CRM precisa da
 *      entrada em `typeLabels` para não chamar a seção de `launches` na tela.
 *      A seção nova também chega pelos dois caminhos de conteúdo: o padrão
 *      (`DEFAULT_HOME_SECTIONS`, que a loja usa como fallback) e o
 *      "Restaurar padrão" do CRM, que cria o que falta pelo `id`.
 *
 * v5 — os chips do `featured` deixaram de ser texto e passaram a ser
 *      **referência**: o campo `filters` é `kind: "list:category"`
 *      (`SECTION_FIELDS`) e o que ele guarda é a lista de ids de categoria, num
 *      link (`content_section_category`) — não no `data`. O editor do CRM muda
 *      de caixa de texto para seletor de categorias, e por isso o formato é
 *      outro: sem reescrever o registro (`make seed-schema`) o CRM continua
 *      desenhando a caixa de texto antiga, e os chips gravados como rótulo
 *      ficam sem leitura — o `--check` do seed-schema acusa o registro velho.
 * v6 — a **superfície de tema**: o tema passa a ser conteúdo editável no CRM,
 *      sobre a coluna `surface` que já existia (sem migração). O formulário
 *      ganha `fields.theme` (paleta em `hex` e fontes em `select`, derivados de
 *      `THEME_COLOR_TOKENS`/`FONT_ROLES`), `typeLabels.theme` e `surfaces` — a
 *      descrição de cada superfície (rótulo, título, aviso e o que ela pode
 *      criar), que é o que faz a mesma tela editar as seções e as estações sem
 *      um `if` em React. `types` passa a listar os tipos de **conteúdo** (as
 *      seções e o bloco de tema), e não só os de seção: sem `theme` ali o
 *      `validateData`/`isKnownType` da rota recusariam a primeira gravação de
 *      uma estação. Sem reescrever o registro (`make seed-schema`) o CRM
 *      continua mostrando a tela antiga, sem a segunda aba.
 *
 * v7 — a numeração ganhou **casas**: a home numera de 1 a 10, com o bloco
 *      ancorado em 1, 2, 3, 4 e 10 (`FIXED_SECTION_POSITIONS`, no contrato) e
 *      as seções ordenáveis nas casas livres do meio (5 a 9). A capa (`hero`) e
 *      a faixa de benefícios (`benefits`) passaram a ser **fixas**: entram em
 *      `singletonTypes` — o CRM não oferece uma segunda capa — e são criadas
 *      com `fixed` pelas duas portas (`restore.ts` e `POST /admin/content`).
 *      Cada superfície declara a própria faixa (`surfaces[i].order`), que é
 *      também o que o CRM recebe como dado (`order`, com as casas ancoradas em
 *      `reserved`) para prever o numeral da lista. Sem reescrever o registro
 *      (`make seed-schema`) o CRM continua desenhando a lista antiga — sem os
 *      dois como fixos, e com uma previsão de numeral que a gravação não segue
 *      (a casa 10 é do rodapé, e a vitrine a pula).
 *
 * v8 — a barra de anúncio ganhou **ticker**: `messages` (a lista de mensagens,
 *      `kind: "list:text"`) e `speedSeconds` (a velocidade, com faixa no campo),
 *      e o `text` deixou de ser obrigatório — é ele que a barra mostra quando
 *      não há ticker. A capa ganhou **carrossel** (`hero.slides`, itens de
 *      `list:hero-slide`) e as coleções ganharam **formato** (`layout`, um
 *      `select` entre cartões e banners). Sem reescrever o registro
 *      (`make seed-schema`) o CRM continua desenhando a barra sem o campo de
 *      mensagens e a seção `hero` sem os slides — e a API admin **recusa** os
 *      campos novos como desconhecidos, porque quem valida é o registro gravado
 *      e não o contrato.
 *
 * v9 — a capa ficou com **uma forma só**: os campos de seção do `hero`
 *      (`eyebrow`, `headline`, `headlineEmphasis`, `subtitle`, `ctaLabel`,
 *      `ctaHref`, `imageUrl`, `imageAlt`, `overlay`) saíram do contrato, e o que
 *      sobra é a lista `slides` — que passa a ser obrigatória no tipo. Um item é
 *      a capa estática; dois ou mais são o carrossel (nada muda no
 *      sub-formulário do slide, `list:hero-slide`). Sem reescrever o registro
 *      (`make seed-schema`) o CRM continua desenhando a foto e a cópia **fora**
 *      da lista — os dois jeitos de escrever a mesma capa, que é o que a v9
 *      tira. A gravação que ainda mandar os campos velhos é recusada como campo
 *      desconhecido, e os que sobraram no `data` gravado são ignorados pela loja
 *      e caem fora na primeira gravação do formulário.
 *
 * v10 — a home ganhou a **faixa editorial** e a numeração mudou de tamanho. O
 *      tipo novo é `banner` ("Banner editorial" no CRM): foto larga, eyebrow,
 *      título com realce e botão para o catálogo — a última faixa do protótipo
 *      redesenhado. Duas seções que já existiam ganharam os campos que a régua
 *      pedia: o `hero` ganhou a `note` (a linha do canto da capa, uma por
 *      faixa) e o `editorial` ganhou `eyebrow` e `titleEmphasis` (o realce do
 *      título, desenhado em `<em>`). Com isso a vitrine passou a ter **seis**
 *      seções ordenáveis, e a sexta nasce na **casa 11** — a casa 10 é do
 *      rodapé, e a renumeração a pula (`FIXED_SECTION_POSITIONS`, e `order.ts`,
 *      que é quem numera). Sem reescrever o registro (`make seed-schema`) o CRM
 *      continua sem oferecer o tipo novo no diálogo de criação e a API admin
 *      **recusa** os três campos novos como desconhecidos: quem valida é o
 *      registro gravado, e não o contrato.
 *
 * v11 — o **texto longo**. Nasce o tipo de seção `prose` ("Texto longo" no
 *      CRM) e, com ele, o primeiro campo de tipo novo desde a v5: `markdown`,
 *      um `textarea` com o subconjunto fechado de marcas inline (negrito,
 *      itálico, riscado e link) gravado como **texto** — nada de HTML no banco
 *      —, e o `list:markdown` das linhas de uma lista. O payload ganha
 *      `markdownMarks`: a barra que o editor desenha acima da caixa é dado do
 *      contrato (`MARKDOWN_MARKS`), porque o painel é outro pacote e não importa
 *      valor daqui. É o tipo que destrava Privacidade, Termos, Trocas e
 *      Cuidados. Sem reescrever o registro (`make seed-schema`) o CRM continua
 *      sem oferecer "Texto longo" no diálogo de criação, e a API admin **recusa**
 *      os campos do bloco (`blocks`, `text`, `items`) como desconhecidos — a
 *      loja, essa, já sabe desenhar: quem interpreta o texto é o storefront.
 *
 * v12 — o **anexo**. O `prose` ganha `documentUrl` (o campo de tipo novo
 *      `document`: um arquivo que a loja **não desenha**, ela publica um botão
 *      que baixa) e `documentLabel` (o que o botão diz — "Baixar o aviso
 *      assinado (PDF)"). Não há nada de novo na infraestrutura: o painel sobe
 *      pelo mesmo `POST /admin/uploads` da imagem e grava a **chave**, e o site
 *      a traduz com o mesmo `resolveMediaUrl`. É o par que a LGPD pede: o texto
 *      acessível **com** o aviso assinado ao lado, nunca o PDF no lugar do
 *      texto. Sem reescrever o registro (`make seed-schema`) o CRM continua sem
 *      os dois campos e a API admin os **recusa** como desconhecidos; a loja
 *      ignora o que não conhece, então uma página antiga segue no ar.
 */
export const SCHEMA_VERSION = 12

/**
 * A chave da linha do registro. Uma só linha: o schema do CRM.
 *
 * Texto fixo (e não o `id` automático) porque o `saveSchema` precisa ser um
 * **upsert** determinístico — dá para chamar o seed quantas vezes quiser sem
 * criar uma segunda linha que competes com a primeira.
 */
export const SCHEMA_KEY = "content"

/**
 * O que o CRM recebe em `schema`.
 *
 * É o "formulário inteiro": tipos, rótulos, campos por tipo, sub-formulário
 * de item, e a paleta/fontes/dark-tokens que o editor usa só para **desenhar**
 * (o que pode ser gravado continua vindo de `options`, campo a campo).
 */
export type ContentSchemaPayload = {
  /**
   * Os tipos de **conteúdo** que o CRM edita: as seções e o bloco de tema
   * (`CONTENT_TYPES`, do contrato).
   *
   * O nome continua `types` porque é o que o registro no Postgres guarda desde
   * a v1 e a chave é lida por duas pontas (a rota, para validar o `type` do
   * corpo; o `resolveSchema`, para saber que o registro não está vazio). O que
   * mudou foi o conteúdo: desde a v6 o tema é conteúdo como uma seção, e um
   * `theme` fora desta lista seria recusado na primeira gravação de estação.
   */
  types: readonly string[]
  /** Tipo → nome que o lojista lê (`editorial` se chama "Sobre"). */
  typeLabels: Record<string, string>
  /**
   * Tipo → campos de `data`, na ordem em que o editor os mostra.
   *
   * Inclui o bloco de tema (`fields.theme` = `THEME_FIELDS`): a validação e o
   * editor leem daqui — é o registro que diz o que pode ser gravado.
   */
  fields: Record<string, readonly FieldSpec[]>
  /** `kind` de lista → campos de dentro do item. */
  itemFields: Partial<Record<string, readonly ItemFieldSpec[]>>
  /**
   * As marcas do texto formatado (`MARKDOWN_MARKS`, no contrato) — a barra que
   * o editor desenha acima de toda caixa `markdown`.
   *
   * Vai no payload pelo mesmo motivo dos campos: o painel é outro pacote e
   * **não importa valor** do contrato (`import type` some no build, e valor pelo
   * apelido é reprovado pelo `check-boundaries` e pelo Rollup do painel). A
   * barra do CRM e o parser da loja leem a **mesma** lista — uma por aqui, a
   * outra pelo import de valor que o storefront já faz —, e a paridade entre as
   * duas tem teste (`frontend/src/lib/content/markdown.spec.tsx`): marca que o
   * editor emite e o site não desenha reprova antes de a página.
   * O storefront ignora esta chave.
   */
  markdownMarks: readonly MarkdownMark[]
  /**
   * Prévia de aparência para o editor: o hex de cada cor da paleta e a
   * família/pilha de cada papel de fonte.
   *
   * Vão no `schema`, e não numa terceira cópia dentro do admin, porque o
   * painel é um pacote separado (não importa o contrato) e precisa dos dois só
   * para **desenhar**: a bolinha de cor e a lista de fontes com prévia —
   * nenhuma fonte existe no navegador do painel. O que pode ser gravado
   * continua vindo de `options`, campo a campo, validado no `validateData`
   * da rota admin.
   */
  palette: Record<string, string>
  /** Papel da fonte → `{ family, stack }`, para a prévia da fonte. */
  fonts: Record<string, { family: string; stack: string }>
  /**
   * Cores de fundo que o storefront trata como escuras (lá ele legibiliza o
   * texto em off white). Aqui é o que permite o trilho de fundo **avisar** isso
   * na hora da escolha, em vez de o lojista descobrir depois, olhando a loja.
   */
  darkTokens: readonly string[]
  /**
   * Tipos que só podem existir uma vez por superfície e que moram numa **casa
   * ancorada** (`nav`, `footer` e a barra de anúncio, mais a capa e a faixa de
   * benefícios da home — ver `SINGLETON_SECTION_TYPES` e
   * `FIXED_SECTION_POSITIONS` no contrato).
   *
   * Vai no payload porque é decisão de **formulário**: o CRM não pode oferecer
   * "Nova seção → Cabeçalho" quando já existe um, já que a API recusaria a
   * criação. O storefront ignora esta chave — o layout dele resolve o cromo
   * por `find` de qualquer jeito.
   */
  singletonTypes: readonly string[]
  /**
   * As superfícies que o CRM edita — o conteúdo da vitrine e o tema —, com o
   * rótulo, o título e o aviso de cada uma (`CONTENT_SURFACES`, no contrato).
   *
   * Vão no `schema` pelo mesmo motivo dos campos: o painel é outro pacote e
   * desenha o que o registro diz. É esta lista que monta o seletor de
   * superfície e o diálogo "Nova seção" de cada aba — a home cria seções, a
   * superfície de tema cria estações —, sem um `if` no meio do React.
   * O storefront ignora esta chave: ele lê UMA superfície por requisição.
   */
  surfaces: readonly ContentSurfaceSpec[]
}

/**
 * O schema que o CRM consome, e de onde ele veio.
 *
 * `source` existe para o payload dizer a verdade: `"db"` é o registro no
 * Postgres (o caso normal depois do `make seed`), `"contract"` é o bootstrap.
 * Não é depuração: é o que permite à UI e à auditoria saberem se o formulário
 * que estão vendo é o gravado ou o de bootstrap.
 */
export type StoredSchema = {
  /** O schema que o CRM consome. */
  schema: ContentSchemaPayload
  /** O `schemaVersion` que a loja recebe no payload. */
  version: number
  source: "db" | "contract"
}

/** Uma linha do registro, como o serviço a lê (ou `null`, se não houver). */
export type SchemaRow = {
  version?: number | null
  data?: unknown
} | null

/**
 * **A decisão**: registro gravado ou bootstrap do contrato.
 *
 * Função pura de propósito — o serviço fica só com o I/O (ler a linha) e a
 * regra "qual das duas responder" fica testável sem container, sem banco e sem
 * mock. É a única parte do `getSchema` que tem condição; o resto é leitura.
 *
 * `types` vazio também conta como "sem registro": uma linha em branco (criada à
 * mão, ou por um seed antigo) serviria um formulário vazio ao CRM, que é pior do
 * que servir o contrato.
 */
export function resolveSchema(row: SchemaRow): StoredSchema {
  const stored = row?.data as ContentSchemaPayload | undefined

  if (row && typeof row.version === "number" && stored?.types?.length) {
    return { schema: stored, version: row.version, source: "db" }
  }

  return {
    schema: buildSchema(),
    version: SCHEMA_VERSION,
    source: "contract",
  }
}

/**
 * Monta o schema a partir do contrato.
 *
 * Chamado pelo `seed-schema` (para gravar) e pelo `service.getSchema()`
 * (como fallback quando o banco ainda não tem a linha). Por isso é uma função
 * pura: o mesmo contrato sempre produz o mesmo schema, e o `--check` pode
 * comparar com o que está gravado sem medo de efeito colateral.
 */
export function buildSchema(): ContentSchemaPayload {
  return {
    types: CONTENT_TYPES,
    /**
     * Os campos de cada tipo **editável** — as seções e o bloco de tema.
     *
     * O tema entra por aqui, e não numa chave própria (`themeFields`), porque a
     * validação e o editor são os mesmos: `validateData` procura os campos do
     * tipo do corpo nesta tabela, e `page.tsx` desenha o que ela diz. Duas
     * chaves seriam dois caminhos para a mesma coisa.
     */
    fields: { ...SECTION_FIELDS, [THEME_TYPE]: THEME_FIELDS },
    /**
     * Nome de cada tipo para a listagem. Vem daqui como os campos: o `type` é
     * o identificador que o storefront casa no `switch`, e o rótulo é o que o
     * lojista lê — `editorial` se chama "Sobre" porque é esse o nome da âncora
     * no menu. Sem o rótulo no payload o admin teria que manter a tabela (e um
     * tipo novo apareceria como jargão até alguém lembrar de mexer no painel).
     */
    typeLabels: { ...SECTION_TYPE_LABELS, [THEME_TYPE]: THEME_TYPE_LABEL },
    /**
     * Sub-formulário de cada item de lista, por `kind`. É o mesmo motivo dos
     * campos: os itens (`benefit.title`, `column.source`…) são objetos e o
     * editor precisa saber o que desenhar dentro de um deles, com as opções e
     * a tradução. Como `fields`, isto é o que o editor **desenha** na tela — o
     * que ele pode gravar continua sendo validado pelo `validateData` da rota.
     */
    itemFields: ITEM_FIELDS,
    /**
     * A barra de marcas do texto formatado. Vai como dado pelo mesmo motivo dos
     * campos: o painel desenha o que o registro diz, e a lista não pode divergir
     * da que o storefront importa (`INLINE_MARKS`, no parser do texto).
     */
    markdownMarks: MARKDOWN_MARKS,
    palette: THEME_COLOR_HEXES,
    fonts: THEME_FONTS,
    darkTokens: THEME_DARK_TOKENS,
    /**
     * Os tipos únicos, para o CRM não oferecer um segundo cabeçalho. Sai do
     * contrato pelo mesmo motivo dos campos: é o formulário do painel que
     * precisa da lista, e ela não pode divergir da regra que a rota aplica.
     */
    singletonTypes: SINGLETON_SECTION_TYPES,
    /**
     * As superfícies que a tela edita: a vitrine e o tema. Sai do contrato pelo
     * mesmo motivo dos campos — o painel monta o seletor de superfície e o
     * diálogo de criação a partir daqui, então uma superfície nova (ou um tipo
     * novo numa superfície) aparece na tela sem edição em React.
     */
    surfaces: CONTENT_SURFACES,
  }
}
