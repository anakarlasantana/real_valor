/**
 * Real Valor — Contrato de conteúdo (fonte da verdade)
 * -----------------------------------------------------------------
 * Este arquivo é a ÚNICA definição do formato de conteúdo da vitrine:
 * os tipos das seções, os campos que o CRM edita (`SECTION_FIELDS`) e as
 * listas fechadas do tema (paleta, papéis de fonte, trilhos).
 *
 * Desde o G5 backend, CRM e storefront importam este arquivo pelo pacote
 * `@rv/contrato` (`packages/contrato/src/`): não há bloco copiado nem espelho
 * digitado à mão — a fronteira passou a ser do compilador. O
 * `scripts/gen-content.mjs` ficou só com o que **deriva** do contrato e não é
 * código (o seed do tema e os tokens do `brand.css`), e o que o compilador não
 * vê — os espelhos de dado do painel, a aparência e o que a loja lê do
 * contrato — virou **teste** no G4, quando a guarda de texto
 * (`scripts/check-contract-parity.mjs`) foi apagada: `contract`/`assets`/
 * `wiring.unit.spec.ts` aqui e `panel-wiring.unit.spec.ts` no CRM.
 *
 * Origem do conteúdo: ./Downloads/real-valor-frontend-prototype
 */

// ===========================================================================
// INÍCIO DO BLOCO COMPARTILHADO — tudo o que a loja lê em runtime (tipos das
// seções, listas fechadas do tema, fontes de coluna do rodapé). O que é só do
// backend/CRM fica abaixo do fim do bloco. Desde o G5 o storefront importa
// este arquivo pelo pacote (`@rv/contrato`): não há cópia para manter em dia.
// ===========================================================================

/**
 * Aparência da seção — escolhas do lojista no CRM (opcional).
 *
 * Cada campo guarda o **papel** do tema (`rose`, `dourado`, `display`…),
 * não a cor ou a fonte literal: quem escolhe "Dourado Rosé" gravou
 * `"dourado"`, e o storefront resolve isso para `var(--rv-dourado)`.
 * É o que faz a seção acompanhar um tema sazonal — o Black Friday troca
 * `--rv-rose` e a seção recolore junto, sem ninguém reeditar o conteúdo.
 *
 * Vazio (ou ausente) é o padrão e o valor normal: significa "como o tema
 * da loja manda", e é o que o `NULL` da coluna `data` acaba virando.
 *
 * As listas de valores válidos são `THEME_COLOR_TOKENS` / `FONT_ROLES`
 * abaixo; quem valida em runtime é o `appearanceVars` do storefront
 * (`frontend/src/lib/content/appearance.ts`), porque o que volta do
 * banco é texto livre.
 *
 * Seção não oferece campo que não use: a barra de anúncio, por exemplo,
 * é uma linha só, então não tem título nem detalhe para colorir.
 */
export type SectionAppearance = {
  /** `FONT_ROLES`. Vazio já é o padrão da seção. */
  appearanceHeadingFont?: string
  appearanceTextFont?: string
  /** `THEME_COLOR_TOKENS`. */
  appearanceHeadingColor?: string
  appearanceTextColor?: string
  appearanceAccentColor?: string
  appearanceBackgroundColor?: string
}

/** Campos comuns a toda seção, independente do tipo. */
export type SectionBase = {
  /** Identificador estável — é o `id` do registro no banco. */
  id: string
  /** Quando false, a seção é omitida inteira pelo renderizador. */
  enabled: boolean
  /** Ordem de renderização, ascendente. */
  position: number
}

/**
 * A velocidade do ticker da barra de anúncio, em segundos por volta.
 *
 * Mora no contrato, e não solta no campo, porque a faixa é lida em dois
 * lugares: o `min`/`max` do `SECTION_FIELDS.announcement` (que o CRM desenha e a
 * API admin valida) e o storefront (`frontend/src/lib/util/ticker.ts`), que é a
 * última defesa — o que está gravado no banco pode ser anterior à faixa. É o
 * mesmo arranjo do `limit` do trilho de lançamentos
 * (`frontend/src/lib/util/launches.ts`), e quem confere os dois espelhos são
 * `ticker.spec.ts` e `launches.spec.ts`, por valor contra este arquivo.
 *
 * O piso de 8s não é estético: abaixo dele a linha cruza a tela rápido demais
 * para ser lida, e texto que não dá para ler é ruído com movimento. O teto de
 * 60s é o outro extremo — acima dele o ticker parece parado, e o lojista fica
 * com uma barra que ele acha que quebrou.
 */
export const ANNOUNCEMENT_SPEED_MIN = 8
export const ANNOUNCEMENT_SPEED_MAX = 60
export const ANNOUNCEMENT_SPEED_DEFAULT = 24

export type AnnouncementSection = SectionBase &
  SectionAppearance & {
    type: "announcement"
    /**
     * A mensagem única — como a barra nasceu ("Frete seguro para todo o Brasil ·
     * Até 6x sem juros"): uma linha, centrada, parada.
     *
     * Continua valendo **quando não há `messages`** (base antiga, ou seção a que
     * ninguém deu ticker ainda), e é o que faz esta mudança não ter migração:
     * uma base que nunca ouviu falar de ticker desenha o que já desenhava.
     */
    text: string
    /**
     * As mensagens do ticker, na ordem em que aparecem.
     *
     * Com **duas ou mais**, a barra rola sozinha e em laço; com **uma só**, ela
     * fica parada e centrada — a leitura de antes com a redação nova. Vazio é o
     * caso do `text` acima.
     */
    messages?: string[]
    /**
     * Quantos segundos o ticker leva para dar uma volta completa
     * (`ANNOUNCEMENT_SPEED_*`). Ausente é o padrão.
     */
    speedSeconds?: number
  }

/**
 * A capa da home — a **abertura** da página, desenhada pela vitrine.
 *
 * Desde a v9 ela tem **uma forma só**: a lista de slides. Até então a seção
 * carregava também os campos de um slide (`eyebrow`, `headline`, `imageUrl`, o
 * scrim…) e a lista era opcional, valendo os campos quando ela estava vazia.
 * Dois jeitos de escrever a mesma capa no formulário eram um a mais, e o pior
 * deles: quem preenchia a foto de cima não via mudança nenhuma na loja — quem
 * estava no ar era o slide — e o campo ficava de reserva, no CRM, para sempre.
 * Com a lista, o que o lojista escreve é o que a home desenha.
 */
export type HeroSection = SectionBase & {
  type: "hero"
  /**
   * Os slides da capa, na ordem em que aparecem — a capa **é** esta lista.
   *
   * Um item é a capa estática: a foto e a cópia dele, sem rodízio e sem
   * controle nenhum. Dois ou mais viram carrossel (`./carousel.tsx` da
   * vitrine), com ponto, pausa e a troca a cada sete segundos. Lista vazia não
   * desenha capa: a seção some da página em vez de virar uma faixa vazia.
   */
  slides: HeroSlide[]
  /**
   * A nota da capa: a linha que a loja escreve no canto da faixa — o recado
   * que fecha a foto, e não a cópia de um slide.
   *
   * Mora na **seção**, e não no slide (`HeroSlide`), porque é isso que ela é:
   * a capa mostra uma nota só e, no carrossel, ela não troca junto com a foto.
   * Não é o caso dos campos que a v9 tirou do `hero` (os que duplicavam a cópia
   * do slide e não chegavam à loja): esta é a **única** forma de escrever a
   * nota, e quem a desenha é a vitrine. Vazia, a nota não é desenhada.
   */
  note?: string
}

/**
 * Um slide da capa: a foto e a cópia que entram na capa ou no carrossel.
 *
 * A ordem da lista é a ordem do carrossel, e a ordem dos campos daqui é a do
 * sub-formulário no CRM (`ITEM_FIELDS["list:hero-slide"]`) — a guarda de
 * paridade compara as duas.
 *
 * O scrim (o véu escuro sobre a foto, do lado do texto) **não** está aqui: ele
 * é um valor de desenho, e não conteúdo — é constante da vitrine (a `SCRIM` de
 * `frontend/src/modules/home/components/hero/index.tsx`) desde a v9, quando o
 * campo saiu do formulário. Um valor por slide seria mais um campo num
 * sub-formulário que já repete oito.
 */
export type HeroSlide = {
  imageUrl: string
  imageAlt: string
  eyebrow: string
  headline: string
  headlineEmphasis: string
  subtitle: string
  ctaLabel: string
  ctaHref: string
}

export type BenefitItem = {
  /** Chave de ícone resolvida por `frontend/src/lib/content/icons.ts`. */
  icon: string
  title: string
  subtitle: string
}

export type BenefitsSection = SectionBase &
  SectionAppearance & {
    type: "benefits"
    items: BenefitItem[]
  }

export type CollectionHighlight = {
  title: string
  subtitle: string
  imageUrl: string
  imageAlt: string
  href: string
  ctaLabel: string
}

export type CollectionsSection = SectionBase &
  SectionAppearance & {
    type: "collections"
    eyebrow: string
    title: string
    subtitle: string
    /**
     * O formato da faixa: `cards` (a grade de três cartões altos, como a seção
     * nasceu) ou `banners` (uma linha de dois banners largos, um ao lado do
     * outro).
     *
     * É escolha de **formato**, então é um `select` e não um booleano: um
     * segundo formato já era previsível, e um terceiro é mais um valor aqui e um
     * ramo no render. Ausente ou desconhecido = `cards`, que é o que a loja
     * desenhava antes deste campo existir — e é o que continua desenhando numa
     * base onde ninguém escolheu nada.
     */
    layout?: "cards" | "banners"
    items: CollectionHighlight[]
  }

/**
 * Uma categoria do catálogo, como a vitrine e o CRM precisam dela.
 *
 * `categoryId` é a **referência** — é ele que filtra, no `category_id` da Store
 * API —, e `label`/`handle` são leitura ao vivo de `product_category`: quem
 * renomeia a categoria no painel vê o chip mudar, porque não há cópia gravada.
 *
 * O tipo é o mesmo nos dois lados (o chip escolhido e o catálogo oferecido): um
 * chip **é** uma entrada do catálogo, com a diferença de estar na lista da
 * seção.
 */
export type CategoryRef = {
  categoryId: string
  label: string
  handle: string
}

export type FeaturedSection = SectionBase &
  SectionAppearance & {
    type: "featured"
    eyebrow: string
    title: string
    subtitle: string
    /**
     * Chips de filtro acima da vitrine: **referências** às categorias do
     * catálogo, na ordem em que aparecem (o link `content_section_category`).
     *
     * Não é lista de rótulos, e é essa a diferença que a R1 conserta: os chips
     * eram texto dentro do `data` (`["Todos", "Blazers", "Conjuntos", "Calças"]`)
     * e a loja mandava o rótulo como busca. Medido no banco real, "Blazers" não
     * existe no catálogo — aquele chip devolvia zero peças **em silêncio** —, e
     * renomear uma categoria no painel não mudava chip nenhum, porque a cópia é
     * que era o dado. Aqui o filtro é `categoryId`, e o rótulo é o nome da
     * categoria lido na hora.
     *
     * O chip "Todos" (limpa o filtro) **não** está nesta lista: não existe
     * categoria "todas", e quem o desenha é a loja. Antes era a posição —
     * `filters[0]` — que dizia qual dos chips limpava, então reordenar os chips
     * trocava o significado de cada um sem nada acusar.
     */
    filters?: CategoryRef[]
    viewAllLabel: string
  }

/**
 * Lançamentos — o trilho de novidades logo depois do hero.
 *
 * É a pergunta que a home não respondia: "o que chegou?". O hero apresenta a
 * marca, as coleções mostram o universo e esta seção mostra o que é novo, num
 * trilho horizontal com encaixe (`scroll-snap`) em vez de grade — a mesma
 * largura de card do resto da loja, mas com o gesto de arrastar.
 *
 * **A fonte do conteúdo é a loja, não o CMS.** A seção carrega só a cópia
 * (eyebrow, título, subtítulo, link) e o `limit`; os produtos vêm da Store API,
 * do mais novo para o mais antigo. É o que faz a seção se manter sozinha: o
 * lojista publica uma peça e ela aparece no trilho sem ninguém editar bloco.
 * Escolher *quais* peças é outro assunto — curadoria manual, com um campo
 * `kind: "products"` —, e a decisão registrada é automático primeiro.
 *
 * A cópia padrão (`defaults.ts`) **não** é cópia do protótipo: o protótipo não
 * tem esta seção. Ela está escrita na voz da marca e é toda editável no CRM —
 * o texto de lá é ponto de partida, não redação final.
 */
export type LaunchesSection = SectionBase &
  SectionAppearance & {
    type: "launches"
    eyebrow: string
    title: string
    subtitle: string
    /**
     * Quantos produtos o trilho mostra. A faixa é declarada no campo
     * (`SECTION_FIELDS.launches`): a API recusa fora dela, e o storefront tem o
     * mesmo piso como última defesa (`lib/util/launches.ts`).
     */
    limit: number
    viewAllLabel: string
    viewAllHref: string
  }

export type EditorialSection = SectionBase &
  SectionAppearance & {
    type: "editorial"
    /** Linha manuscrita em Allura. */
    script: string
    /**
     * O eyebrow acima do título (ex.: "NOSSA ESSÊNCIA") — a etiqueta que diz
     * de que o bloco fala, no mesmo lugar em que as outras seções a têm.
     */
    eyebrow?: string
    title: string
    /**
     * O realce do título: a segunda linha dele, em itálico (`<em>`) — o jeito
     * que o protótipo escreve o título em duas vozes ("Você não precisa provar
     * nada." / "Só precisa se reconhecer."). Vazio, o título é uma linha só.
     */
    titleEmphasis?: string
    body: string
    ctaLabel: string
    ctaHref: string
    imageUrl: string
    imageAlt: string
    imagePosition: "left" | "right"
  }

/**
 * A faixa editorial: uma foto larga com a cópia por cima e um botão que leva ao
 * catálogo — a última faixa da home no protótipo redesenhado.
 *
 * **Não é uma segunda `editorial`** (a seção "Sobre"): aquela é o manifesto —
 * a foto ao lado do texto (`imagePosition`), a frase manuscrita e o texto
 * corrido da marca. Esta é uma faixa de passagem: a foto inteira, uma linha de
 * eyebrow, o título em duas partes e o botão. Também não é o `hero`: a capa
 * abre a página, e esta faixa fecha o conteúdo, depois do manifesto.
 *
 * A foto **é** o fundo da faixa (como no hero), então não há campo de posição
 * de imagem nem trilho de fundo: o que a seção veste é o título.
 */
export type BannerSection = SectionBase &
  SectionAppearance & {
    type: "banner"
    /**
     * O eyebrow acima do título (ex.: "REAL VALOR, REAL HISTÓRIA"). É opcional
     * como no `editorial`: em branco, a faixa desenha só o título — e o lojista
     * pode tirá-lo sem trocar de seção.
     */
    eyebrow?: string
    title: string
    /**
     * O realce do título: a segunda linha dele, em itálico (`<em>`) — a que o
     * protótipo escreve depois da quebra ("Mais que roupa," / "é sobre você.").
     * Vazio, o título é uma linha só.
     */
    titleEmphasis?: string
    imageUrl: string
    imageAlt: string
    ctaLabel: string
    ctaHref: string
  }

/**
 * Como um bloco do texto longo se lê — o que o `<select>` do CRM oferece em
 * cada bloco de `prose.blocks`.
 *
 * É uma lista, e não um `union` solto, porque é ela que o editor do admin
 * oferece no `<select>`: as opções do campo de item viajam em `ITEM_FIELDS` (e
 * daí no `schema` do `GET /admin/content`), então o painel não tem cópia
 * nenhuma. O **primeiro** é o `kind` de um bloco novo — o parágrafo, que é o
 * caso comum de um texto corrido.
 */
export const PROSE_BLOCK_KINDS = [
  "paragraph",
  "subtitle",
  "bullets",
] as const

export type ProseBlockKind = (typeof PROSE_BLOCK_KINDS)[number]

/** A tradução de cada `kind` para o `<select>` — `bullets` é "Lista", não jargão. */
export const PROSE_BLOCK_KIND_LABELS: Record<ProseBlockKind, string> = {
  paragraph: "Parágrafo",
  subtitle: "Subtítulo",
  bullets: "Lista",
}

/**
 * O texto longo de uma página (`prose`) — o bloco que destrava Privacidade,
 * Termos, Trocas e Cuidados (14.6.2 do doc 14).
 *
 * **Por que a estrutura é dado, e não marca.** Num editor de texto rico o
 * lojista escreve `##` e `- item`, e duas formas de escrever a mesma coisa é
 * como nasce a divergência entre o que o painel mostra e o que a loja desenha:
 * um `##` no meio do texto não é um subtítulo, é dois cerquilhas na tela. O que
 * o campo de texto aceita é o **subconjunto de marcas inline** de 14.6.3
 * (`**negrito**`, `_itálico_`, `~~riscado~~`, `[texto](/rota)`); o que é
 * estrutura — subtítulo, parágrafo e lista — é campo, e é este tipo.
 */

/**
 * Um bloco do texto longo: o `kind` diz **como** o trecho se lê e o texto diz
 * o quê.
 *
 * Os três campos existem nos três `kind` (o editor de item desenha o
 * sub-formulário inteiro, sem esconder campo pela escolha do outro), e quem
 * escolhe qual deles vale é o render: `subtitle` e `paragraph` leem `text`,
 * `bullets` lê `items`. É por isso que os três são obrigatórios no tipo — o
 * valor gravado tem sempre a mesma forma, e a loja não precisa adivinhar.
 */
export type ProseBlock = {
  /** `subtitle` é um `<h2>` dentro do texto, `paragraph` um `<p>`, `bullets` um `<ul>`. */
  kind: ProseBlockKind
  /** O texto do bloco, com as marcas inline (`markdown`) — vale em `subtitle` e `paragraph`. */
  text: string
  /** As linhas da lista, uma por `<li>` — vale em `bullets`. */
  items: string[]
}

/**
 * A seção de texto longo: um título e a estrutura do texto.
 *
 * Sem trilho de aparência, ao contrário do resto: a página de texto segue o
 * tema da loja inteira, e a decisão do que ela pode vestir é do negócio, não
 * deste PR (ver 14.17 do doc 14). Quem desenha é
 * `frontend/src/modules/content/prose.tsx`.
 */
export type ProseSection = SectionBase & {
  type: "prose"
  /** O `<h2>` da seção. Em branco, o texto começa direto nos blocos. */
  title: string
  /** A estrutura do texto, na ordem em que ela se lê. */
  blocks: ProseBlock[]
  /**
   * O anexo da página (a **chave** do arquivo enviado no CRM), ou `""`.
   *
   * É o aviso assinado, o contrato de troca, a tabela de medidas — o que a
   * página promete em PDF. Vazio significa **sem botão**: desligar o anexo tira
   * o botão da página sem tocar no texto (critério 7 de 14.6.3).
   */
  documentUrl: string
  /**
   * O que o botão de baixar diz. Vazio cai no rótulo genérico — "Baixar o
   * documento (PDF)" —, e é o motivo de o rótulo ser campo: "Baixar o aviso
   * assinado" é o que faz a cliente clicar em um e ignorar o outro.
   */
  documentLabel: string
}

/**
 * Uma pergunta frequente: a pergunta que a cliente clica e a resposta que ela
 * abre (14.6.2 do doc 14).
 *
 * Os dois campos são o par inteiro, e o par é a razão do tipo: pergunta sem
 * resposta é item em construção, e quem desenha publica só o par completo (ver
 * `frontend/src/modules/content/faq.tsx`).
 *
 * **A assimetria entre os dois tipos é deliberada.** A pergunta é `text` — uma
 * linha que a cliente lê para escolher o que abrir —, e a resposta é `markdown`,
 * o mesmo campo do texto longo, pelo mesmo motivo de 14.6.3: o que é texto
 * chega à página como texto, e quem interpreta as marcas é `renderInline`. Quem
 * escrever `**negrito**` na pergunta verá os asteriscos: marca não é o que o
 * campo promete, e o que a loja não desenha ela também não esconde.
 */
export type FaqItem = {
  /** A linha clicável — o texto do `<summary>`. */
  question: string
  /** A resposta, com as marcas inline do `prose`. */
  answer: string
}

/**
 * As perguntas frequentes (`faq`) — a página da dúvida, que é página de
 * conversão: é onde mora a objeção (14.6.2 do doc 14).
 *
 * **Por que `<details>/<summary>`.** O elemento nativo é acessível por teclado,
 * funciona **sem JavaScript**, e o conteúdo fechado **é indexado** — diferente
 * de abas e de acordeões feitos à mão, que escondem a resposta do buscador e do
 * leitor de tela. E é a resposta longa o que a cliente procura: por isso o `faq`
 * é o par do `prose`, e reusa o parser e as marcas que o texto longo trouxe.
 *
 * Sem trilho de aparência, como o `prose`: a página segue o tema da loja
 * inteira, e o que ela pode vestir é decisão do negócio (14.17/14.19 do doc 14).
 * Quem desenha é `frontend/src/modules/content/faq.tsx`.
 */
export type FaqSection = SectionBase & {
  type: "faq"
  /** O `<h2>` da seção. Em branco, a lista começa direto nas perguntas. */
  title: string
  /** As perguntas, na ordem em que elas se leem. */
  items: FaqItem[]
}

export type InstagramSection = SectionBase &
  SectionAppearance & {
    type: "instagram"
    handle: string
    title: string
    images: { imageUrl: string; imageAlt: string }[]
  }

/**
 * Item do menu principal do cabeçalho.
 *
 * O `href` também define o comportamento, então não existe um campo
 * "modo": a forma do destino basta.
 *   `/#hero` ou `#hero`   → rola até a seção de id `hero` da home
 *   `/store`, `/search`   → página interna (o país é prefixado na loja)
 *   `https://…`           → fora do site, em nova aba
 *   `mailto:…` / `tel:…`  → cliente de e-mail / telefone
 */
export type HeaderLink = {
  label: string
  href: string
}

/** Ação do cluster de ícones à direita do cabeçalho. */
export type HeaderAction = {
  /** Chave de ícone resolvida por `frontend/src/lib/content/icons.ts`. */
  icon: string
  /** Rótulo: nome acessível do ícone e texto no menu mobile. */
  label: string
  href: string
}

/**
 * Menu do cabeçalho.
 *
 * É a única seção que não é da home: como a barra de anúncio, aparece
 * em todas as rotas da loja. Mas, como todo conteúdo da vitrine, mora na
 * mesma tabela e na mesma superfície (`home`) — daí o `id` fixo `nav`,
 * que o seed cria (e o "Restaurar padrão" do CRM recria, em
 * `modules/content/restore.ts`).
 *
 * A ordem é a ordem dos arrays: `links` no centro do cabeçalho (e no
 * topo do menu mobile), `actions` no cluster da direita. Os itens da
 * lista são editáveis um a um pelo admin (inclusive reordenados), sem
 * um campo de ordem por item.
 */
export type NavSection = SectionBase & {
  type: "nav"
  links: HeaderLink[]
  actions: HeaderAction[]
}

/**
 * De onde vêm os itens de uma coluna do rodapé.
 *
 *   `links`       → os `links` digitados no admin (o padrão)
 *   `categories`  → as categorias do catálogo, ao vivo
 *   `collections` → as coleções do catálogo, ao vivo
 *
 * É uma lista, e não um `union` solto, porque é ela que o editor do admin
 * oferece no `<select>`: as opções do campo de item viajam em `ITEM_FIELDS`
 * (e daí no `schema` do `GET /admin/content`), então o painel não tem cópia
 * nenhuma. Quem confere a lista contra os ramos de `footer-column/index.tsx` é
 * `assets.unit.spec.ts`: origem oferecida que a loja não desenha reprova.
 */
export const FOOTER_COLUMN_SOURCES = [
  "links",
  "categories",
  "collections",
] as const

export type FooterColumnSource = (typeof FOOTER_COLUMN_SOURCES)[number]

/**
 * Coluna de links do rodapé (ex.: "Institucional").
 *
 * Coluna é sempre conteúdo: não existe coluna fixa nem automática no
 * componente, e o lojista insere, edita, reordena e remove **todas** pelo
 * mesmo editor do admin. As colunas de catálogo não são um caso especial
 * do layout — são só uma `source` possível, escolhida por coluna.
 *
 * Com `source: "categories"` ou `"collections"` os itens vêm do catálogo
 * e `links` é ignorado; com `"links"` (o padrão) é o contrário. Nos dois
 * casos os `href` digitados têm a mesma forma e a mesma resolução dos
 * links do menu: quem transforma o `href` em comportamento é o `nav-link`
 * (`/#secao` rola, `/rota` navega, `https://` abre em nova aba,
 * `mailto:`/`tel:` abrem o contato), então rodapé e cabeçalho não
 * divergem.
 */
export type FooterColumn = {
  title: string
  /** Ausente/desconhecido conta como `"links"` (dado gravado antes). */
  source: FooterColumnSource
  links: HeaderLink[]
}

/** Ícone social do rodapé. */
export type FooterSocial = {
  /** Chave resolvida por `frontend/src/lib/content/social-icons.tsx`. */
  icon: string
  /** Nome acessível do ícone — ele não tem texto visível. */
  label: string
  href: string
}

/**
 * Rodapé da loja.
 *
 * Como o `nav`, não é uma seção da home: aparece em todas as rotas, quem
 * o desenha é o layout, e o `id` fixo `footer` é o que o seed cria.
 *
 * A marca, a frase manuscrita e a linha de direitos continuam no
 * componente — não são conteúdo. Todo o resto é: as colunas de links (na
 * ordem da lista, cada uma com a sua origem) e as redes sociais. Não
 * existe coluna padrão nem FAQ embutida: rodapé sem coluna nenhuma é um
 * estado válido, e na loja só aparece o que o lojista inserir no admin —
 * uma coluna de "Perguntas frequentes" é uma coluna como qualquer outra.
 */
export type FooterSection = SectionBase & {
  type: "footer"
  /**
   * Colunas de links, na ordem da lista. Cada item decide de onde vêm os
   * itens (`source`), então o componente não tem coluna fixa. Coluna sem
   * título ou sem itens não aparece na loja — é o que permite publicar o
   * rodapé antes de o catálogo existir.
   */
  columns: FooterColumn[]
  social: FooterSocial[]
}

export type HomeSection =
  | AnnouncementSection
  | HeroSection
  | BenefitsSection
  | CollectionsSection
  | FeaturedSection
  | LaunchesSection
  | EditorialSection
  | BannerSection
  | ProseSection
  | FaqSection
  | InstagramSection
  | NavSection
  | FooterSection

/** Todo `type` de seção válido, como valor — para validação em runtime. */
export const SECTION_TYPES = [
  "announcement",
  "hero",
  // A abertura da home vem antes de tudo o que se ordena: a capa (casa 3) e a
  // faixa de benefícios (casa 4) são fixas, e o trilho de novidades cai na
  // primeira casa livre da vitrine (5). A ordem deste array é a ordem do
  // seletor de tipo no CRM e a ordem em que as seções se leem na página — a
  // mesma das casas ancoradas (`FIXED_SECTION_POSITIONS`) e da faixa da
  // vitrine (`order.ts`): 5 lançamentos, 6 coleções, 7 Sobre, 8 a faixa
  // editorial, 9 os destaques e 11 o Instagram — a casa 10 é do rodapé, e a
  // numeração das ordenáveis a pula.
  "benefits",
  "launches",
  "collections",
  "editorial",
  "banner",
  // O texto longo (a F2 do doc 14). É o **primeiro tipo que existe só em
  // página**: ele nasce aqui e na lista de tipos do CRM como os outros, mas
  // não está no conteúdo padrão da vitrine (`DEFAULT_HOME_SECTIONS`) — o que a
  // home oferece a mais é o que o payload dela já tinha. O lugar dele no array
  // é o do seletor (o bloco de texto fica ao lado do outro, o `banner`); a
  // ordem **das seções na página** é a `position` que vem do banco, e a
  // numeração da vitrine continua saindo de `order.ts`.
  "prose",
  // As perguntas frequentes (o PR4 da mesma fase): o **segundo** tipo que só
  // existe em página, e o par do `prose` — a resposta de cada pergunta reusa o
  // mesmo parser e as mesmas marcas. Vem logo depois dele no array pela mesma
  // razão que o `prose` vem depois do `banner`: é onde o seletor do CRM deixa os
  // dois lado a lado. A ordem **na página** continua sendo a `position` do banco.
  "faq",
  "featured",
  "instagram",
  // Não é uma seção da home: é o cabeçalho da loja, renderizado pelo
  // layout em todas as rotas (como a barra de anúncio).
  "nav",
  // Mesmo caso do `nav`: o rodapé também é cromo do site, não seção da
  // home, e quem o desenha é o layout.
  "footer",
] as const

export type SectionType = (typeof SECTION_TYPES)[number]

export function isSectionType(value: unknown): value is SectionType {
  return (
    typeof value === "string" &&
    (SECTION_TYPES as readonly string[]).includes(value)
  )
}

/**
 * Tipos que só podem existir **uma vez** por superfície — e que, por isso, têm
 * **casa ancorada** (`FIXED_SECTION_POSITIONS`): a posição deles não se move.
 *
 * São dois grupos, e os dois aparecem no CRM com a etiqueta **Fixo** (sem
 * setas, sem numeral a recalcular):
 *
 *   cromo do site     `announcement`, `nav` e `footer` — a moldura que a loja
 *                     desenha **em todas as rotas** e resolve por `find`
 *                     (`announceSections`, `headerSections` e `footerSections`,
 *                     em `frontend/src/lib/content/home-sections.ts`): o
 *                     primeiro bloco do tipo é o que aparece;
 *   abertura da home  `hero` e `benefits` — quem os desenha é a vitrine, e não
 *                     a moldura, mas eles são o **começo da página** e não
 *                     conteúdo que se reordena: a capa e a faixa de benefícios
 *                     moram sempre na mesma casa (ver `FIXED_SECTION_POSITIONS`).
 *
 * Um segundo bloco de um tipo destes seria o pior defeito possível num CMS: o
 * lojista cria, a lista do CRM mostra, e a loja **nunca** desenha — o cromo é
 * resolvido por `find` e a abertura está ancorada numa casa só. Por isso a API
 * recusa a criação (`POST /admin/content`) e o CRM não oferece um tipo que já
 * existe — as duas pontas leem esta lista, então não há duas opiniões sobre o
 * que é único.
 *
 * Estar aqui é o que faz a seção nascer **fixa** (`fixed = true`): quem grava a
 * coluna são as duas portas que criam seção (`restore.ts` e
 * `POST /admin/content`), as duas perguntando a `isSingletonSectionType`.
 */
export const SINGLETON_SECTION_TYPES = [
  "announcement",
  "nav",
  "hero",
  "benefits",
  "footer",
] as const

export type SingletonSectionType = (typeof SINGLETON_SECTION_TYPES)[number]

export function isSingletonSectionType(
  value: unknown
): value is SingletonSectionType {
  return (
    typeof value === "string" &&
    (SINGLETON_SECTION_TYPES as readonly string[]).includes(value)
  )
}

/**
 * Papéis de cor do tema (`ThemeColors` de `frontend/src/lib/theme.ts`,
 * os tokens `--rv-*` de `frontend/src/styles/brand.css`).
 *
 * É uma lista, e não só um `union` no tipo, porque as pontas precisam
 * dos mesmos valores em runtime: o `<select>` do admin (via `options`),
 * a validação do storefront (`appearanceVars`) e a guarda de paridade,
 * que compara as duas cópias.
 */
export const THEME_COLOR_TOKENS = [
  "rose",
  "offwhite",
  "cacao",
  "grafite",
  "preto",
  "dourado",
] as const

export type ThemeColorToken = (typeof THEME_COLOR_TOKENS)[number]

/**
 * A paleta do tema padrão — **a origem dos hex**, não mais uma cópia.
 *
 * Serve a dois consumidores, e os dois precisam dos mesmos valores:
 *
 *   1. o editor do admin desenha a **bolinha de cor** (o painel é um pacote
 *      separado, não lê os `theme.json` do storefront e sem isto só teria como
 *      oferecer a palavra "rose" — que não diz nada a quem escolhe uma cor);
 *   2. o gerador (`scripts/gen-content.mjs`) escreve
 *      `frontend/themes/default/theme.json` daqui e os tokens `--rv-*` no
 *      `frontend/src/styles/tokens.generated.css`, que é o fallback do
 *      `brand.css` antes de `themeToCSSVariables` escrever por requisição.
 *
 * Era **cópia de leitura** até a R3-lite, conferida cor por cor contra o
 * `theme.json` por dois arquivos de verificação. Agora o `theme.json` é
 * *seed* (bootstrap do tema no banco, na R4) e sai daqui: não há o que
 * comparar.
 *
 * O que o lojista grava continua sendo o papel (`"rose"`), nunca o hex, então
 * o tema sazonal segue mandando: a bolinha do CRM mostra a cor do **tema
 * padrão**, e é por isso que a opção segue trazendo o nome do papel no rótulo.
 */
export const THEME_COLOR_HEXES: Record<ThemeColorToken, string> = {
  rose: "#B97872",
  offwhite: "#F7F1E8",
  cacao: "#4A3531",
  grafite: "#303033",
  preto: "#171717",
  dourado: "#D4B19A",
}

/**
 * Papéis de fonte do tema (`ThemeFonts`): títulos, textos e a frase
 * manuscrita. Mesma razão de lista de `THEME_COLOR_TOKENS`.
 */
export const FONT_ROLES = ["display", "sans", "script"] as const

export type FontRole = (typeof FONT_ROLES)[number]

export type ThemeFont = {
  /** A família declarada no `@font-face` da loja e da prévia do painel. */
  family: string
  /** O que o navegador usa se o `.woff2` não chegar. */
  fallback: string
  /** `family` + `fallback`: a pilha inteira, como o `--rv-font-*` a recebe. */
  stack: string
}

/**
 * Monta uma fonte a partir da família e do fallback dela.
 *
 * A pilha é **derivada** — antes era escrita à mão em três lugares (aqui, no
 * template de `themeToCSSVariables` e no `--rv-font-*` do `brand.css`), e
 * cada cópia podia envelhecer sozinha. As três saem daqui agora: a loja monta
 * a pilha com `family` + `fallback` (`frontend/src/lib/theme.ts`), o
 * `brand.css` declara o fallback, e `assets.unit.spec.ts` confere que ele é o
 * mesmo.
 */
function themeFont(family: string, fallback: string): ThemeFont {
  return { family, fallback, stack: `"${family}", ${fallback}` }
}

/**
 * A família, o fallback e a pilha completa de cada papel de fonte.
 *
 * `family` é o nome declarado no `theme.json` (`fonts`) — o mesmo que o
 * `@font-face` da cópia em `admin/src/admin/routes/content/fonts/` usa —, e
 * `stack` é a pilha que `themeToCSSVariables` (`frontend/src/lib/theme.ts`)
 * escreve em `--rv-font-*`.
 *
 * Mesma razão de `THEME_COLOR_HEXES`: o `<select>` de fonte do admin
 * desenha cada opção **na própria fonte** — é o que faz "Títulos (Playfair
 * Display)" parecer um título na tela em vez de uma linha de texto igual às
 * outras. Sem a família, o painel não tem como pedir essa fonte ao
 * navegador.
 *
 * A guarda de paridade confere o md5 dos `.woff2` do admin contra os do
 * storefront — uma família sem arquivo vira prévia em Times New Roman, e um
 * arquivo diferente do da loja vira prévia que mente. A família em si não se
 * confere mais contra o `theme.json`: o arquivo é gerado daqui.
 */
export const THEME_FONTS: Record<FontRole, ThemeFont> = {
  display: themeFont("Playfair Display", "Georgia, serif"),
  sans: themeFont("Montserrat", "system-ui, sans-serif"),
  script: themeFont("Allura", "cursive"),
}

/**
 * Cores do tema que são fundo escuro.
 *
 * Elas não existem para o formulário (nenhum `<select>` as oferece — as
 * opções saem de `THEME_COLOR_TOKENS`): servem para o storefront
 * auto-legibilizar a seção. Fundo escuro escolhido **e** nenhuma cor de
 * texto escolhida significam "não mexi no texto", e aí o texto vira off
 * white — grafite sobre preto seria ilegível, e o lojista que quer preto de
 * fundo não tem por que saber que precisa escolher a cor do texto também.
 *
 * Escolha explícita sempre vence: quem gravar `grafite` de texto num fundo
 * `preto` fica com grafite.
 *
 * Só o lado escuro tem regra: no tema padrão todo texto de seção já é
 * escuro (grafite/muted), então um fundo claro — `offwhite` — continua
 * legível sem ajuda. O caso que sobra é `dourado` de fundo (texto off
 * white fica com pouco contraste), e para esse o lojista tem o campo *Cor
 * dos textos* na mão.
 */
export const THEME_DARK_TOKENS = ["preto", "cacao"] as const

/**
 * Rótulos dos trilhos de aparência no editor do admin.
 *
 * Aparência não é um bloco no fim do formulário: cada trilho aparece
 * **dentro** do conteúdo, logo abaixo do campo que ele veste — a fonte e a
 * cor dos títulos embaixo do campo "Título", a cor do fundo no fim da
 * seção. Quem diz onde cada campo cai é o `attachedTo` do `FieldSpec`; o
 * rótulo do trilho é o `group` dele.
 *
 * A ordem é a ordem dos trilhos quando dois deles caem no mesmo campo (a
 * faixa de benefícios, por exemplo, veste tudo a partir da lista de itens):
 * título, texto, detalhe e, por último, o fundo.
 */
export const APPEARANCE_GROUPS = [
  "Títulos",
  "Textos",
  "Detalhes",
  "Fundo",
] as const

export type AppearanceGroup = (typeof APPEARANCE_GROUPS)[number]

/**
 * Nome do campo de `data` que carrega cada cor do tema (`rose` → `colorRose`).
 *
 * O payload é plano — um bloco é `{ id, enabled, position, type, …data }` —,
 * então a paleta editável no CRM não vira um objeto aninhado em `data`: cada
 * cor é um campo, como qualquer outro. O nome sai daqui para o editor e a
 * loja não terem duas convenções de leitura: quem grava é o CRM (via
 * `THEME_FIELDS`) e quem lê é o storefront (`frontend/src/lib/theme.ts`),
 * pacotes diferentes que só concordam pelo artefato gerado.
 */
export function themeColorField(token: ThemeColorToken): string {
  return `color${token[0].toUpperCase()}${token.slice(1)}`
}

/** Nome do campo de `data` que carrega cada papel de fonte (`sans` → `fontSans`). */
export function themeFontField(role: FontRole): string {
  return `font${role[0].toUpperCase()}${role.slice(1)}`
}

// ===========================================================================
// FIM DO BLOCO COMPARTILHADO. Daqui para baixo é só backend/admin: os
// atalhos dos trilhos de aparência, o `SECTION_FIELDS` que o CRM consome e a
// paleta/fontes de prévia (que o painel recebe pelo `schema` da API).
// ===========================================================================

/**
 * A **casa** de cada seção fixa: a posição que ela ocupa sempre.
 *
 * Fixa é a seção que não tem ordem — o CRM mostra a etiqueta "Fixo" no lugar
 * das setas, e a renumeração da vitrine não a toca. Os tipos são os de
 * `SINGLETON_SECTION_TYPES` (único por superfície é o que garante uma casa só),
 * e o desenho da home é este:
 *
 *     1  barra de anúncio   ┐
 *     2  cabeçalho          │ o bloco ancorado do TOPO: as casas em que a
 *     3  capa (hero)        │ página começa, na ordem em que se lê
 *     4  benefícios         ┘
 *     5… as seções da vitrine — as únicas que o "Salvar ordem" renumera
 *    10  rodapé             ← ancorado no fim da numeração
 *
 * A faixa de cada superfície (`CONTENT_SURFACES[i].order`) começa na primeira
 * casa livre depois do bloco do topo e **pula** as casas ancoradas (`order.ts`):
 * as ordenáveis caem nas casas livres em ordem — 5, 6, 7, 8, 9 e depois **11**,
 * porque a casa 10 é do rodapé e nenhuma seção ordenável a ocupa. A vitrine de
 * hoje usa as seis: lançamentos, coleções, Sobre, a faixa editorial e os
 * destaques (5 a 9) e o Instagram (11).
 *
 * Mora **abaixo do bloco compartilhado** porque o storefront não precisa dela:
 * ele ordena por `position` e resolve o cromo por `type`
 * (`frontend/src/lib/content/home-sections.ts`). Quem lê as casas é o backend —
 * o padrão (`defaults.ts`), a restauração (`restore.ts`) e a regra da ordem.
 */
export const FIXED_SECTION_POSITIONS: Record<SingletonSectionType, number> = {
  announcement: 1,
  nav: 2,
  hero: 3,
  benefits: 4,
  footer: 10,
}

/** Opções de todo campo de cor: o padrão (`""`) na frente dos 6 tokens. */
const APPEARANCE_COLOR_OPTIONS = ["", ...THEME_COLOR_TOKENS] as const

/** Nomes da paleta como o guia de marca os escreve (não `rose`, "Rosa Queimado"). */
const APPEARANCE_COLOR_LABELS: Record<string, string> = {
  "": "Padrão do tema da loja",
  rose: "Rosa Queimado",
  offwhite: "Off White",
  cacao: "Marrom Cacau",
  grafite: "Grafite",
  preto: "Preto",
  dourado: "Dourado Rosé",
}

/** Opções de todo campo de fonte: o padrão (`""`) na frente dos 3 papéis. */
const APPEARANCE_FONT_OPTIONS = ["", ...FONT_ROLES] as const

/** O papel da fonte desambiguado: "Títulos", não "display". */
const APPEARANCE_FONT_LABELS: Record<string, string> = {
  "": "Padrão do tema da loja",
  display: "Títulos (Playfair Display)",
  sans: "Textos (Montserrat)",
  script: "Manuscrita (Allura)",
}

/**
 * Um trilho de aparência: os campos de um mesmo `group`, ancorados no
 * campo de conteúdo que eles vestem (`attachedTo`).
 *
 * Cada trilho é uma função porque o mesmo trilho cai em lugares diferentes
 * conforme a seção: "Títulos" é a fonte e a cor do `headline` no hero, do
 * `title` nas coleções e do `items` na faixa de benefícios. Quem chama
 * informa a âncora, e `SECTION_FIELDS` espalha o retorno logo depois do
 * campo citado — é a ordem do array, e não um mapa à parte, que diz o que
 * aparece onde. O formulário do admin é montado daqui, na ordem daqui.
 *
 * `attachedTo` é âncora de verdade, não comentário: a guarda de paridade
 * confere que o campo citado existe naquela seção e que o trilho vem logo
 * depois dele. Sem isso, um trilho continuaria compilando e aparecendo —
 * só que longe do campo que ele muda.
 *
 * A primeira opção de todo campo é a vazia — "Padrão do tema da loja" —
 * porque vazio significa "não escreve nada no wrapper da seção", que é o
 * que faz o bloco seguir a loja sem override nenhum. A cor livre (hex) foi
 * descartada de propósito: o guia de marca tem 6 cores, e um hex solto
 * venceria o tema sazonal em vez de acompanhá-lo.
 */
function appearanceTitles(attachedTo: string): readonly FieldSpec[] {
  return [
    {
      name: "appearanceHeadingFont",
      label: "Fonte dos títulos",
      kind: "font",
      options: APPEARANCE_FONT_OPTIONS,
      optionLabels: APPEARANCE_FONT_LABELS,
      group: "Títulos",
      attachedTo,
    },
    {
      name: "appearanceHeadingColor",
      label: "Cor dos títulos",
      kind: "color",
      options: APPEARANCE_COLOR_OPTIONS,
      optionLabels: APPEARANCE_COLOR_LABELS,
      group: "Títulos",
      attachedTo,
    },
  ]
}

/** Trilho "Textos": a família e a cor dos textos corridos da seção. */
function appearanceTexts(attachedTo: string): readonly FieldSpec[] {
  return [
    {
      name: "appearanceTextFont",
      label: "Fonte dos textos",
      kind: "font",
      options: APPEARANCE_FONT_OPTIONS,
      optionLabels: APPEARANCE_FONT_LABELS,
      group: "Textos",
      attachedTo,
    },
    {
      name: "appearanceTextColor",
      label: "Cor dos textos",
      kind: "color",
      options: APPEARANCE_COLOR_OPTIONS,
      optionLabels: APPEARANCE_COLOR_LABELS,
      group: "Textos",
      attachedTo,
    },
  ]
}

/**
 * Trilho "Detalhes": a cor de destaque da seção — eyebrow, ícone, frase
 * manuscrita, realce do título, link "ver todos". É uma cor só, mas é a
 * que dá o tom.
 */
function appearanceDetails(attachedTo: string): readonly FieldSpec[] {
  return [
    {
      name: "appearanceAccentColor",
      label: "Cor dos detalhes",
      kind: "color",
      options: APPEARANCE_COLOR_OPTIONS,
      optionLabels: APPEARANCE_COLOR_LABELS,
      group: "Detalhes",
      attachedTo,
      help: "Eyebrow, ícones, frase manuscrita, realces, botões e links — o dourado/rosa da seção.",
    },
  ]
}

/**
 * Trilho "Fundo": a cor do bloco inteiro.
 *
 * Fica sempre no fim do formulário da seção — é a única escolha que vale
 * para o bloco todo, não para um elemento —, e por isso a âncora dele é o
 * último campo de conteúdo da seção.
 *
 * Escolher um fundo escuro (`preto`, `cacao` — `THEME_DARK_TOKENS`) faz o
 * storefront legibilizar o texto em off white por conta própria. A regra é
 * do render, não um campo: por isso o editor a **avisa** no trilho, em vez
 * de oferecer um campo "cor do texto no fundo escuro" que seria um segundo
 * jeito de dizer a mesma coisa.
 */
function appearanceBackground(attachedTo: string): readonly FieldSpec[] {
  return [
    {
      name: "appearanceBackgroundColor",
      label: "Cor de fundo",
      kind: "color",
      options: APPEARANCE_COLOR_OPTIONS,
      optionLabels: APPEARANCE_COLOR_LABELS,
      group: "Fundo",
      attachedTo,
    },
  ]
}

/**
 * Contrato por tipo: campos que vivem em `data` (JSON) e o formato
 * esperado de cada um.
 *
 * Serve para duas coisas: validar a entrada da API admin antes de
 * gravar, e derivar o formulário do widget sem repetir a lista de
 * campos em React.
 */
export type FieldKind =
  | "text"
  // Destino (**href**): o `text` de um endereço, com a **lista das rotas
  // conhecidas** ao lado — o seletor de destino do PR5 do doc 14 (14.6.4, F3a).
  //
  // O valor continua sendo a string, e a lista **sugere**, não tranca:
  // `mailto:`, `tel:`, `https://…` e a âncora da vitrine (`/#editorial`) não
  // são rotas da loja, e um `<select>` fechado não teria como oferecê-las. Quem
  // oferece é o `datalist` do painel, alimentado por `CONTENT_DESTINATIONS` —
  // que viaja no `schema` (`schema.destinations`) pelo motivo de sempre: o
  // admin é outro pacote e não importa valor do contrato.
  //
  // É o campo que fecha a causa-raiz do doc 13: nove botões apontando para
  // `/store` não era desatenção de quem editou — era ausência de alternativa no
  // painel, que só conhecia o campo de texto livre.
  | "href"
  | "textarea"
  // Texto **formatado**: a mesma caixa de texto, com um subconjunto fechado de
  // marcas inline (`MARKDOWN_MARKS`) gravado como **texto** — o que está no
  // banco é uma string sem HTML nenhum, e quem interpreta é `renderInline`
  // (`frontend/src/lib/content/markdown.tsx`), que devolve nós React.
  //
  // É o campo do texto longo (`prose.blocks[].text`, e a resposta de cada
  // pergunta no `faq` do PR4): o que o lojista escreve no CRM chega à página
  // com negrito, itálico, riscado e link — e o resto sai literal, nunca
  // desaparece. O CRM acrescenta uma barra de marcas acima da caixa; a lista
  // das marcas chega ao painel pelo `schema` (`markdownMarks`), porque o painel
  // não importa valor do contrato. Ver 14.6.3 do doc 14.
  | "markdown"
  | "number"
  | "select"
  // Imagem: campo com envio de arquivo. O editor sobe a foto pelo provider de
  // arquivos (`@medusajs/file-local`, ver `medusa-config.ts`) e grava a
  // **chave** do arquivo (`1699999999-hero.jpg`) — nunca a URL absoluta, que
  // amarraria o conteúdo ao endereço do backend. Quem traduz chave → URL é
  // `resolveMediaUrl` no storefront (`frontend/src/lib/util/media.ts`), o que
  // mantém a loja funcionando com o mesmo valor gravado hoje (URL do painel
  // nativo) e depois de trocar o provider por S3.
  | "image"
  // Documento anexo: envio de arquivo, como a imagem — e com a mesma regra de
  // valor. O que muda é o que a loja faz com ele: **não desenha**, publica um
  // botão que baixa.
  //
  // O anexo **complementa** o texto, nunca o substitui (14.6.3 do doc 14): PDF
  // não é indexável, não é bom no telefone e não é o que a LGPD pede para o
  // aviso em si — ela pede o texto acessível. O documento é o **da** página, com
  // rótulo (`documentLabel`, no `prose`): "Baixar o aviso assinado (PDF)".
  | "document"
  // Aparência: a paleta e as fontes do tema, desenhadas como bolinhas de cor
  // e como uma lista de fontes com prévia — ver `THEME_COLOR_HEXES` e
  // `THEME_FONTS`. Continuam sendo escolha dentro de uma lista fechada: o
  // `validateData` da rota admin reprova o que estiver fora de `options`.
  | "color"
  | "font"
  // Cor **literal** (`#RRGGBB`): a paleta de uma estação, editada no CRM. É o
  // único campo em que o valor gravado é o hex, e não o papel (`THEME_COLOR_TOKENS`)
  // — a estação define cores novas, então não há lista fechada onde escolhê-las.
  // O formato quem cobra é o `pattern` do campo (a rota admin reprova o resto).
  | "hex"
  // Lista de **referências** a categorias (ids), com a ordem da lista: é o campo
  // dos chips da vitrine. Não é lista de objetos — não há sub-formulário —, e
  // por isso o editor é um seletor próprio (`field-input.tsx`) e `ITEM_FIELDS`
  // traz a entrada vazia (a guarda de paridade cobra editor para todo `list:*`).
  // O que **não** se grava aqui é o rótulo: `label` e `handle` são lidos da
  // categoria na hora de desenhar (`modules/content/filters.ts`).
  | "list:category"
  // Lista de textos simples: uma caixa por texto, sem sub-campos — e sem
  // entrada em `ITEM_FIELDS` (não há sub-formulário para desenhar). É o campo
  // das mensagens do ticker da barra de anúncio (`messages`).
  //
  // Era um único input separado por vírgula, e o separador **dentro** do campo
  // era o defeito: o texto era remontado a cada tecla (`join` para exibir,
  // `split` para gravar), então a vírgula recém-digitada sumia e as mensagens se
  // colavam numa só — a barra ficava parada, com `messages` de um item, e nada
  // acusava. Com uma caixa por mensagem não há separador para perder; a vírgula
  // continua valendo como gesto de **colagem** (colar uma lista abre várias).
  | "list:text"
  // Lista de textos **formatados**: uma caixa por item, cada uma com a barra de
  // marcas — é o `list:text` do texto longo (`prose.blocks[].items`, as linhas
  // de uma lista). Como ele, não tem sub-campos e por isso **não** entra em
  // `ITEM_FIELDS`: o editor de item desenharia um cartão de item sem campo
  // nenhum dentro.
  | "list:markdown"
  // O slide da capa (`hero.slides`): foto e cópia, o sub-formulário do tipo
  // `HeroSlide` — item de lista como o `list:highlight`, com a mesma forma
  // (imagem, textos e link) e por isso o mesmo editor do admin.
  | "list:hero-slide"
  | "list:benefit"
  | "list:highlight"
  | "list:image"
  | "list:link"
  | "list:action"
  // O bloco do texto longo (`prose.blocks`): o `kind`, o texto formatado e as
  // linhas da lista — o único `list:*` cujo item tem, ele mesmo, uma lista de
  // textos formatados dentro (`list:markdown`).
  | "list:proseBlock"
  // A pergunta frequente (`faq.items`): a pergunta (texto simples e clicável) e a
  // resposta (`markdown`, o mesmo campo do texto longo). Sub-formulário de dois
  // campos e **sem** lista dentro — o editor genérico dos `list:*` o desenha
  // sem uma linha nova no painel, e o tipo que ele espelha é o `FaqItem`.
  | "list:faqItem"
  // Item com sub-lista dentro (`links`): o editor do admin desenha os
  // níveis internos recursivamente.
  | "list:column"
  | "list:social"

export type FieldSpec = {
  name: string
  label: string
  kind: FieldKind
  required?: boolean
  /** Apenas para `select`. */
  options?: readonly string[]
  /**
   * Formato esperado do valor, como **fonte de regex** (`HEX_COLOR_PATTERN`,
   * `MONTH_DAY_PATTERN`): o `validateData` da rota admin reprova o que não
   * casar, e o editor mostra o aviso no campo.
   *
   * Existe porque há campo de texto cuja forma o `kind` sozinho não descreve:
   * sem isto um `#B9787` (cinco dígitos) seria gravado e chegaria à loja como
   * variável CSS inválida — o `var()` não cai no fallback quando a variável
   * existe e não resolve, então a cor sumiria sem erro nenhum.
   */
  pattern?: string
  /**
   * Tradução de cada opção, para o `<select>` do admin não ser só
   * jargão (`"dourado"` → `"Dourado Rosé"`). A chave é a opção; a
   * opção vazia se escreve `"": "…"`.
   *
   * A ordem quem manda é a de `options` — este mapa só traduz.
   */
  optionLabels?: Record<string, string>
  /**
   * Agrupamento visual no editor do admin (ex.: `"Títulos"`). Campo sem
   * grupo é conteúdo e aparece na ordem do contrato; campo com grupo é um
   * **trilho** de aparência e aparece logo abaixo do campo que ele veste.
   * Ver `APPEARANCE_GROUPS`.
   */
  group?: string
  /**
   * Nome do campo de conteúdo que este campo veste — o input debaixo do
   * qual ele é desenhado no editor (`"headline"` para a fonte e a cor dos
   * títulos do hero).
   *
   * Redundante com a posição no array de propósito: a ordem de
   * `SECTION_FIELDS` é o que o admin usa para montar o formulário, e este
   * campo é o que a guarda de paridade cobra para que a ordem não se perca
   * num `sort`, num agrupamento ou num `spread` fora de lugar. Sem ele, um
   * trilho pode acabar a três campos de distância do que ele muda — e nada
   * quebra.
   */
  attachedTo?: string
  help?: string
  /**
   * Faixa de um campo `number` (mínimo, máximo e passo do `<input>`), e o que
   * a rota admin usa para reprovar valor fora dela.
   *
   * Declaradas no campo, e não no editor: o formulário do painel é desenhado a
   * partir deste contrato, então um campo numérico novo — o limite de itens de
   * uma vitrine, por exemplo — herdaria a faixa do primeiro campo que a tivesse
   * (os segundos por volta do ticker, 8 a 60) se ela estivesse escrita no
   * `field-input.tsx`, e o lojista não conseguiria digitar 8. Campo sem faixa é
   * um número livre.
   */
  min?: number
  max?: number
  /** Passo do `<input type="number">`; ausente vale 1. */
  step?: number
}

/**
 * A ajuda dos campos de destino (`kind: "href"`).
 *
 * Uma constante porque a frase é a **mesma** em todos eles — e porque o que ela
 * diz é o que mudou no campo: ele deixou de ser uma caixa de texto livre e
 * ganhou a lista das rotas conhecidas ao lado. O lojista precisa saber as duas
 * metades: que existe uma lista para escolher, e que o texto continua valendo
 * para o que **não** é rota da loja (`https://…`, `mailto:`, `tel:` e a âncora
 * da vitrine).
 */
const HREF_HELP =
  "Escolha um destino da lista (as rotas que a loja tem) ou escreva o " +
  "endereço: um caminho do site (ex.: /sobre), uma âncora da vitrine " +
  "(ex.: /#editorial), uma URL completa (https://…) ou um contato " +
  "(mailto:, tel:)."

/** Campos de `data` por tipo de seção, na ordem em que o admin os mostra. */
export const SECTION_FIELDS: Record<SectionType, readonly FieldSpec[]> = {
  announcement: [
    // Deixou de ser obrigatória na v8: quem preenche o ticker (`messages`)
    // pode esvaziar a mensagem única sem a API recusar o salvamento. É a
    // mensagem que a barra mostra **quando não há ticker**, e é por isso que
    // ela ainda existe.
    {
      name: "text",
      label: "Mensagem única",
      kind: "text",
      help: "A barra fica parada nesta mensagem quando não houver mensagens no ticker abaixo. Foi assim que a barra nasceu.",
    },
    {
      name: "messages",
      label: "Mensagens do ticker",
      kind: "list:text",
      help: "Uma caixa por mensagem — o ticker rola sozinho com duas ou mais e fica parado com uma. O que estiver aqui substitui a mensagem única; colar uma lista separada por vírgulas cria várias caixas de uma vez.",
    },
    // A barra é uma linha só: tem a fonte e a cor do texto e a cor da
    // própria barra. Sem títulos nem detalhes para vestir.
    ...appearanceTexts("messages"),
    ...appearanceBackground("messages"),
    // A velocidade vem **depois** dos trilhos de propósito: o `attachedTo` do
    // contrato é a promessa de "aparece embaixo do campo que muda", e a guarda
    // de paridade exige que o trilho fique logo abaixo do último campo de
    // conteúdo — aqui, `messages`. A ordem do formulário também fica melhor
    // assim: o que o lojista vem fazer nesta seção é escrever mensagem, e a
    // velocidade é o último ajuste.
    {
      name: "speedSeconds",
      label: "Segundos por volta",
      kind: "number",
      min: ANNOUNCEMENT_SPEED_MIN,
      max: ANNOUNCEMENT_SPEED_MAX,
      step: 1,
      help: "Quanto tempo o ticker leva para dar uma volta completa. A rolagem para no mouse e no teclado.",
    },
  ],
  hero: [
    // A capa é **só** isto: a lista de slides. Um item é a capa estática; dois
    // ou mais são o carrossel. Até a v9 havia também os campos de um slide
    // (`eyebrow`, `headline`, `imageUrl`, `overlay`…) fora da lista, e quem
    // preenchia a foto de cima não via mudança nenhuma na loja — quem estava no
    // ar era o slide. Com uma forma só, o formulário não oferece o que a vitrine
    // ignora.
    //
    // Sem trilho de fundo: o fundo do hero é a fotografia, e sem trilho de
    // títulos: a cópia de cada slide é a que ele traz.
    {
      name: "slides",
      label: "Slides da capa",
      kind: "list:hero-slide",
      help: "Um item por capa, na ordem em que aparecem. Um item só é a capa estática; dois ou mais viram carrossel automático. Sem nenhum item a capa não é desenhada.",
    },
    // A nota da capa: é da faixa, não do slide — no carrossel ela não troca
    // junto com a foto. Vem depois dos slides porque é o último recado da capa,
    // não porque a posição mude o que a loja desenha.
    {
      name: "note",
      label: "Nota da capa",
      kind: "text",
      help: 'A linha do canto da capa — o recado que fecha a foto, uma vez só, para a faixa inteira. Ex.: "Peças que acompanham quem você é — e quem está se tornando.". Em branco, a nota não é desenhada.',
    },
  ],
  launches: [
    { name: "eyebrow", label: "Eyebrow", kind: "text" },
    // O destaque do trilho é o eyebrow — e o "ver tudo" do fim.
    ...appearanceDetails("eyebrow"),
    { name: "title", label: "Título", kind: "text", required: true },
    ...appearanceTitles("title"),
    { name: "subtitle", label: "Subtítulo", kind: "textarea" },
    ...appearanceTexts("subtitle"),
    {
      // O `limit` é o número com faixa da seção: os produtos vêm da loja, então
      // o que o lojista escolhe aqui é QUANTOS. Sem o limite, ou com um limite
      // grande, o trilho viraria o catálogo inteiro — e um `limit` de 0
      // devolveria uma seção vazia.
      name: "limit",
      label: "Quantos produtos",
      kind: "number",
      min: 2,
      max: 12,
      step: 1,
      help: "Os mais recentes primeiro. 8 cabem na tela larga sem cortar um card no meio.",
    },
    { name: "viewAllLabel", label: "Link ver tudo", kind: "text" },
    {
      name: "viewAllHref",
      label: "Destino do link",
      kind: "href",
      help: HREF_HELP,
    },
    // O fundo fecha a seção: é a única escolha que vale para o bloco todo.
    ...appearanceBackground("viewAllHref"),
  ],
  benefits: [
    {
      name: "items",
      label: "Itens",
      kind: "list:benefit",
      // O layout da faixa acompanha a contagem — o lojista não precisa
      // recorrer a um número "certo" (2 ou 4) para a faixa ficar bonita.
      help: "A faixa se adapta à quantidade: 2 por linha no celular e de 5 a 7 por linha no desktop, conforme a largura da tela. O que sobrar de uma linha ocupa a linha inteira.",
    },
    // A faixa veste tudo a partir da lista de itens: o título e o texto são
    // os de cada item, o detalhe é o ícone e o fundo é o da faixa.
    ...appearanceTitles("items"),
    ...appearanceTexts("items"),
    ...appearanceDetails("items"),
    ...appearanceBackground("items"),
  ],
  collections: [
    { name: "eyebrow", label: "Eyebrow", kind: "text" },
    // O destaque das coleções é o eyebrow — e o "ver coleção" do card.
    ...appearanceDetails("eyebrow"),
    { name: "title", label: "Título", kind: "text", required: true },
    ...appearanceTitles("title"),
    { name: "subtitle", label: "Subtítulo", kind: "textarea" },
    ...appearanceTexts("subtitle"),
    {
      name: "layout",
      label: "Formato",
      kind: "select",
      options: ["cards", "banners"] as const,
      optionLabels: {
        cards: "Cartões (grade de 3)",
        banners: "Banners largos (linha de 2)",
      },
      help: "Cartões é a grade de três colunas de hoje; banners é a faixa de dois banners largos, um ao lado do outro.",
    },
    { name: "items", label: "Coleções", kind: "list:highlight" },
    // O fundo fecha a seção: é a única escolha que vale para o bloco todo.
    ...appearanceBackground("items"),
  ],
  featured: [
    { name: "eyebrow", label: "Eyebrow", kind: "text" },
    // O destaque da vitrine é o eyebrow — e o "ver todos" do fim.
    ...appearanceDetails("eyebrow"),
    { name: "title", label: "Título", kind: "text", required: true },
    ...appearanceTitles("title"),
    { name: "subtitle", label: "Subtítulo", kind: "textarea" },
    ...appearanceTexts("subtitle"),
    {
      name: "filters",
      label: "Filtros",
      // Referência, e não texto: o que se escolhe aqui são **categorias do
      // catálogo**, e o chip da vitrine passa a ser o nome delas, lido na hora.
      // Era um `list:text` — os chips eram rótulos digitados, e um rótulo sem
      // categoria por trás (o "Blazers" do padrão) devolvia zero peças em
      // silêncio.
      kind: "list:category",
      help: 'Escolha as categorias que viram chips na vitrine. O chip "Todos" (limpa o filtro) a loja desenha sozinha: ele não é uma categoria.',
    },
    { name: "viewAllLabel", label: "Link ver todos", kind: "text" },
    // O fundo fecha a seção: é a única escolha que vale para o bloco todo.
    ...appearanceBackground("viewAllLabel"),
  ],
  editorial: [
    // A frase manuscrita é o destaque do bloco (a seção "Sobre").
    { name: "script", label: "Frase manuscrita", kind: "text" },
    ...appearanceDetails("script"),
    // O eyebrow entra **depois** do trilho de propósito: o `attachedTo` dele é
    // o `script`, e a cor de detalhes vale para os dois (eyebrow, frase
    // manuscrita e realce do título são o mesmo destaque na seção).
    { name: "eyebrow", label: "Eyebrow", kind: "text" },
    { name: "title", label: "Título", kind: "text", required: true },
    {
      name: "titleEmphasis",
      label: "Realce do título",
      kind: "text",
      help: "A segunda linha do título, em itálico — a que a loja desenha em <em>. Em branco, o título é uma linha só.",
    },
    // O trilho dos títulos veste os dois campos do título: fica abaixo do
    // segundo, que é o último que ele muda.
    ...appearanceTitles("titleEmphasis"),
    {
      name: "body",
      label: "Texto (conceito e história)",
      kind: "textarea",
      // A ajuda repete o casamento com o item do menu de propósito: é o
      // que o lojista procura ao abrir o formulário.
      help: 'Conteúdo da seção "Sobre": conceito da marca, história e valores. O item "Sobre" do menu rola até aqui.',
    },
    ...appearanceTexts("body"),
    { name: "ctaLabel", label: "Texto do botão", kind: "text" },
    {
      name: "ctaHref",
      label: "Link do botão",
      kind: "href",
      help: HREF_HELP,
    },
    {
      name: "imageUrl",
      label: "Imagem",
      kind: "image",
      help: "Envie a foto pelo botão, ou informe um caminho do site (ex.: /brand/story-1.jpg) ou uma URL.",
    },
    { name: "imageAlt", label: "Imagem (alt)", kind: "text" },
    {
      name: "imagePosition",
      label: "Posição da imagem",
      kind: "select",
      options: ["left", "right"] as const,
    },
    // O fundo fecha a seção: é a única escolha que vale para o bloco todo.
    ...appearanceBackground("imagePosition"),
  ],
  banner: [
    {
      name: "imageUrl",
      label: "Imagem",
      kind: "image",
      // A foto é o fundo inteiro da faixa: sem ela não há faixa nenhuma, e por
      // isso ela é obrigatória — a API recusa salvar a seção sem foto.
      required: true,
      help: "A foto que ocupa a faixa inteira. Envie pelo botão, ou informe um caminho do site (ex.: /brand/story-2.jpg) ou uma URL.",
    },
    { name: "imageAlt", label: "Imagem (alt)", kind: "text" },
    { name: "eyebrow", label: "Eyebrow", kind: "text" },
    { name: "title", label: "Título", kind: "text", required: true },
    {
      name: "titleEmphasis",
      label: "Realce do título",
      kind: "text",
      help: "A segunda linha do título, em itálico — a que a loja desenha em <em>. Em branco, o título é uma linha só.",
    },
    // Como no hero, o trilho veste a cópia sobre a foto: a fonte e a cor valem
    // para o título inteiro (as duas linhas). Sem trilho de fundo e sem o de
    // detalhes: o fundo é a fotografia, e o eyebrow é a única linha de detalhe.
    ...appearanceTitles("titleEmphasis"),
    { name: "ctaLabel", label: "Texto do botão", kind: "text" },
    {
      name: "ctaHref",
      label: "Link do botão",
      kind: "href",
      help: HREF_HELP,
    },
  ],
  prose: [
    {
      name: "title",
      label: "Título",
      kind: "text",
      help: "O título da seção, desenhado em <h2>. Em branco, o texto começa direto no primeiro bloco.",
    },
    {
      name: "blocks",
      label: "Blocos de texto",
      kind: "list:proseBlock",
      help: "Ordem da lista = ordem na página. Cada bloco é um subtítulo, um parágrafo ou uma lista; o texto aceita negrito, itálico, riscado e link pela barra acima da caixa. Bloco sem texto não aparece na loja.",
    },
    {
      name: "documentUrl",
      label: "Documento (PDF)",
      kind: "document",
      help: "O anexo da página — o aviso assinado, o contrato de troca, a tabela de medidas. A loja publica um botão de baixar abaixo do texto; sem arquivo, não há botão.",
    },
    {
      name: "documentLabel",
      label: "Rótulo do documento",
      kind: "text",
      help: 'O que o botão de baixar diz (ex.: "Baixar o aviso assinado (PDF)"). Em branco, o botão diz "Baixar o documento (PDF)".',
    },
  ],
  faq: [
    {
      name: "title",
      label: "Título",
      kind: "text",
      help: "O título da seção, desenhado em <h2>. Em branco, a lista começa direto nas perguntas.",
    },
    {
      name: "items",
      label: "Perguntas",
      kind: "list:faqItem",
      help: "Ordem da lista = ordem na página. Cada item é uma pergunta e a resposta que ela abre; a resposta aceita negrito, itálico, riscado e link pela barra acima da caixa. Item sem pergunta ou sem resposta não aparece na loja.",
    },
  ],
  instagram: [
    { name: "handle", label: "Perfil", kind: "text" },
    // O @ do perfil sai em destaque, não como texto corrido.
    ...appearanceDetails("handle"),
    { name: "title", label: "Título", kind: "text", required: true },
    ...appearanceTitles("title"),
    { name: "images", label: "Imagens", kind: "list:image" },
    // Sem trilho de texto: a faixa não tem texto corrido — o perfil é
    // destaque, o título é título e o resto é imagem. A cor de fundo, essa
    // sim, é o que dá o tom do bloco (o padrão é o preto).
    ...appearanceBackground("images"),
  ],
  nav: [
    {
      name: "links",
      label: "Links do menu",
      kind: "list:link",
      help: 'Ordem da lista = ordem no menu. Use "/#secao" para rolar até uma parte da home, "/rota" para outra página, "https://…" para fora do site e "mailto:…"/"tel:…" para contato.',
    },
    {
      name: "actions",
      label: "Ícones da direita",
      kind: "list:action",
      help: 'Ordem da lista = ordem no cabeçalho. O ícone "bag" usa a sacola do carrinho, com contador — mantenha só um.',
    },
  ],
  footer: [
    {
      name: "columns",
      label: "Colunas",
      kind: "list:column",
      help: 'Ordem da lista = ordem no rodapé. Cada coluna escolhe a origem dos itens: "links" usa os links digitados, "categories" e "collections" puxam do catálogo. Coluna sem título ou sem itens não aparece na loja.',
    },
    {
      name: "social",
      label: "Redes sociais",
      kind: "list:social",
      help: "Ordem da lista = ordem dos ícones, logo abaixo da marca. O rótulo é o nome acessível do ícone — ele não tem texto visível.",
    },
  ],
}

// ===========================================================================
// O QUE O CRM DESENHA ALÉM DOS CAMPOS DE SEÇÃO
// ===========================================================================
// `SECTION_FIELDS` diz quais campos uma seção tem; falta o resto que o editor
// do admin precisa para desenhar a tela — e que também é dado, não tabela em
// React:
//
//   SECTION_TYPE_LABELS   o nome de cada tipo na listagem ("Sobre", não
//                         "editorial");
//   ITEM_FIELDS           o sub-formulário de cada item de lista (os itens de
//                         `benefits`, os links de uma coluna do rodapé…),
//                         recursivo como o conteúdo é;
//   ICON_LABELS           a tradução das chaves de ícone oferecidas;
//   MARKDOWN_MARKS        as marcas do texto formatado que a barra do editor
//                         insere e o site desenha.
//
// Os quatro viajam no `schema` do `GET /admin/content` e quem os desenha é o
// `field-input.tsx`/`page.tsx`, que não importam nada daqui (o admin é um
// pacote npm separado do backend). Até aqui eles eram espelhos digitados à mão
// no admin, e a guarda de paridade só sabia comparar texto com texto; agora o
// que o editor desenha e o que o contrato declara são o **mesmo objeto**, e a
// guarda confere o que de fato vive em dois pacotes: as chaves de ícone do
// storefront e os campos que ele lê.
//
// Nada disto é gravável por conta própria: o que a API aceita continua saindo
// de `SECTION_FIELDS` (com `options` campo a campo) e sendo validado pelo
// `validateData` da rota admin.

/**
 * Rótulo de cada tipo na listagem do editor.
 *
 * O `type` é o identificador que a API grava e que o storefront casa no
 * `switch` — não muda. O rótulo é o que o lojista lê, e não é uma tradução do
 * `type`: a seção `editorial` se chama **Sobre** na loja (é o item do menu que
 * rola até ela), e `nav`/`footer` são cromo de todas as rotas, não seções da
 * home. Uma tabela dentro do `page.tsx` deixaria um tipo novo aparecendo como
 * jargão até alguém lembrar de mexer no admin.
 */
export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  announcement: "Barra de anúncio",
  hero: "Hero",
  launches: "Lançamentos",
  benefits: "Faixa de benefícios",
  collections: "Coleções em destaque",
  featured: "Peças em destaque",
  editorial: "Sobre",
  banner: "Banner editorial",
  prose: "Texto longo",
  faq: "Perguntas frequentes",
  instagram: "Instagram",
  nav: "Cabeçalho",
  footer: "Rodapé",
}

/**
 * Tradução de cada chave de ícone oferecida em `ITEM_FIELDS`.
 *
 * O ícone é escolhido por chave (`"quality"`, `"bag"`) porque quem desenha é o
 * registro do storefront (`frontend/src/lib/content/icons.ts`); sem a tradução
 * o `<select>` do admin seria só jargão. Chave oferecida e sem rótulo aparece
 * crua — é o que a guarda de paridade reprova, junto com o rótulo órfão.
 */
export const ICON_LABELS: Record<string, string> = {
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
  // Redes sociais do rodapé (`list:social`), que têm registro próprio
  // (`frontend/src/lib/content/social-icons.tsx`).
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
}

/**
 * As marcas do texto formatado (o campo `markdown`): o subconjunto fechado que
 * o lojista escreve e o site desenha — a lista que a barra do editor oferece.
 *
 * Cada entrada é o que a **barra** do CRM precisa para escrever a marca
 * (`open`/`close`, que envolvem a seleção) e o que a **spec de paridade**
 * precisa para cobrar que a loja desenhe o que o painel emite (`element`). Não
 * existe HTML em lugar nenhum: o valor gravado é texto, e quem o interpreta
 * devolve nós React (`renderInline`).
 */
export const MARKDOWN_MARKS = [
  { label: "Negrito", open: "**", close: "**", element: "strong" },
  { label: "Itálico", open: "_", close: "_", element: "em" },
  { label: "Riscado", open: "~~", close: "~~", element: "s" },
  // A única assimétrica — e a única com risco: `[clique](javascript:alert(1))`
  // é XSS **sem HTML nenhum**. Por isso o botão insere a forma já segura
  // (`](/rota)`) e o `href` é allowlist no storefront: o que não passa sai como
  // texto. O rótulo é o gesto, e o destino é o que o lojista troca.
  { label: "Link", open: "[", close: "](/rota)", element: "a" },
] as const

export type MarkdownMark = (typeof MARKDOWN_MARKS)[number]

/**
 * Tradução das origens de uma coluna do rodapé.
 *
 * O rótulo diz de onde os itens **saem**, e não o nome da origem: quem escolhe
 * `categories` precisa saber que a lista passa a ser o catálogo ao vivo, e não
 * o que ele digitou logo abaixo.
 */
export const FOOTER_COLUMN_SOURCE_LABELS: Record<FooterColumnSource, string> = {
  links: "os links digitados abaixo",
  categories: "as categorias do catálogo",
  collections: "as coleções do catálogo",
}

/**
 * Um campo de um item de lista — o que o editor desenha dentro de um item.
 *
 * É um tipo à parte de `FieldSpec` de propósito: item de lista não tem trilho
 * de aparência, nem `attachedTo`, nem campo obrigatório. Oferecer isso aqui
 * sugeriria um recurso que o editor não desenha.
 *
 * `kind` só existe para o item que é lista (hoje, o `links` de uma coluna do
 * rodapé) e `options` para o item que é escolha (`source`, `icon`).
 */
export type ItemFieldSpec = {
  name: string
  label: string
  /** `list:*` desenha uma lista dentro do item; ausente é campo simples. */
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
 * O mapa `kind` de lista → campos de dentro do item.
 *
 * Nome próprio (e não um `Partial<Record<…>>` escrito em cada lugar) porque o
 * **painel** importa este tipo: ele recebe o mapa no `schema.itemFields` e
 * precisa da mesma forma que o contrato declara. Com o nome, um campo novo no
 * item é erro de compilação nos dois lados, em vez de um espelho que diverge em
 * silêncio.
 */
export type ItemFields = Partial<Record<FieldKind, readonly ItemFieldSpec[]>>

/**
 * Sub-formulário de cada `kind` de lista, na ordem em que o editor o desenha.
 *
 * Só os `kind` de objeto aparecem: `list:text` é uma caixa por texto, sem
 * sub-campos, e `list:category` é o seletor de categorias do
 * `filters` — os dois sem sub-campos, e por isso os dois de fora. Todo `list:*`
 * de `SECTION_FIELDS` precisa estar aqui — sem editor o campo aparece na tela e
 * não dá para preencher —, e a guarda de paridade cobra os dois sentidos
 * (nenhum `kind` sem editor, nenhuma chave que não seja um `kind` declarado nas
 * seções).
 *
 * Cada `kind` tem um tipo no bloco compartilhado (`BenefitItem`,
 * `CollectionHighlight`, `HeaderLink`, `HeaderAction`, `FooterColumn`,
 * `FooterSocial`), que é o que o storefront lê: a guarda confere que o editor
 * oferece exatamente os campos do tipo, na mesma ordem — campo num lado só
 * deixa o lojista sem como preencher o que a loja renderiza, ou o contrário.
 * `list:image` não tem tipo nomeado (o `images` do Instagram é inline), e
 * `list:column` tem a checagem extra contra o que o render da coluna lê.
 *
 * O ícone é escolha dentro de uma lista fechada, e as chaves são declaradas
 * aqui — o contrato não importa o registro do storefront (pacotes separados) —,
 * conferidas contra `BENEFIT_ICON_KEYS`/`HEADER_ACTION_ICON_KEYS` (`icons.ts`)
 * e `SOCIAL_ICON_KEYS` (`social-icons.tsx`) pela guarda de paridade: chave
 * nova num lado só ofereceria no admin um ícone que a loja não desenha (ou o
 * contrário, um ícone que ninguém consegue escolher).
 *
 * `list:column` é o caso recursivo: a coluna guarda os próprios links
 * (`list:link`), e é por isso que o editor desenha os níveis internos em
 * recursão em vez de um ramo por profundidade.
 */

export const ITEM_FIELDS: ItemFields = {
  // Lista de **referências**, não de objetos: o valor é o id da categoria, e o
  // rótulo dela é lido ao vivo (não há sub-formulário para desenhar). A entrada
  // vazia existe porque a guarda de paridade cobra editor para todo `list:*` de
  // `SECTION_FIELDS` — e o editor de verdade é o seletor de categorias
  // (`field-input.tsx`), que recebe o catálogo pelo payload. Sem a entrada, o
  // campo apareceria na tela sem como ser preenchido, que é o defeito que a
  // guarda procura.
  "list:category": [],
  "list:benefit": [
    {
      name: "icon",
      label: "Ícone",
      options: ["quality", "price", "sizes", "delivery"],
      optionLabels: ICON_LABELS,
      allowEmpty: true,
    },
    { name: "title", label: "Título" },
    { name: "subtitle", label: "Subtítulo" },
  ],
  /**
   * O slide da capa (`hero.slides`): os mesmos oito campos do hero, sem os de
   * bloco. A ordem desta lista **é** a ordem dos campos de `HeroSlide` — a
   * guarda de paridade compara as duas (`ITEM_TYPES`), e um campo num lado só
   * deixaria o lojista sem como preencher o que a loja desenha.
   */
  "list:hero-slide": [
    {
      name: "imageUrl",
      label: "Imagem",
      kind: "image",
      help: "Envie a foto pelo botão, ou informe um caminho do site (ex.: /brand/hero.jpg) ou uma URL.",
    },
    { name: "imageAlt", label: "Imagem (alt)" },
    { name: "eyebrow", label: "Eyebrow" },
    { name: "headline", label: "Título" },
    { name: "headlineEmphasis", label: "Título (parte em itálico)" },
    { name: "subtitle", label: "Subtítulo" },
    { name: "ctaLabel", label: "Texto do botão" },
    {
      name: "ctaHref",
      label: "Link do botão",
      kind: "href",
      help: HREF_HELP,
    },
  ],
  "list:highlight": [
    { name: "title", label: "Título" },
    { name: "subtitle", label: "Subtítulo" },
    {
      name: "imageUrl",
      label: "Imagem",
      kind: "image",
      help: "Envie a foto pelo botão, ou informe um caminho do site (ex.: /brand/collection-1.jpg) ou uma URL.",
    },
    { name: "imageAlt", label: "Imagem (alt)" },
    {
      name: "href",
      label: "Link",
      kind: "href",
      help: HREF_HELP,
    },
    { name: "ctaLabel", label: "Texto do botão" },
  ],
  "list:image": [
    {
      name: "imageUrl",
      label: "Imagem",
      kind: "image",
      help: "Envie a foto pelo botão, ou informe um caminho do site ou uma URL. A moldura é quadrada: corte a foto nesse formato para ela não ser recortada sozinha.",
    },
    { name: "imageAlt", label: "Imagem (alt)" },
  ],
  "list:link": [
    { name: "label", label: "Rótulo" },
    {
      name: "href",
      label: "Destino",
      kind: "href",
      help: HREF_HELP,
    },
  ],
  "list:action": [
    {
      name: "icon",
      label: "Ícone",
      options: ["bag", "account", "search", "whatsapp", "mail", "phone", "pin"],
      optionLabels: ICON_LABELS,
      allowEmpty: true,
    },
    { name: "label", label: "Rótulo" },
    {
      name: "href",
      label: "Destino",
      kind: "href",
      help: HREF_HELP,
    },
  ],
  // O bloco do texto longo: o `kind` (um `<select>`), o texto do subtítulo/
  // parágrafo (`markdown`) e as linhas da lista (`list:markdown`). Os três
  // campos valem nos três `kind` — o editor de item desenha o sub-formulário
  // inteiro —, e a ajuda de cada um diz em qual deles ele é lido, porque é isso
  // que o lojista tem de saber para não preencher campo que a página ignora.
  "list:proseBlock": [
    {
      name: "kind",
      label: "Tipo de bloco",
      options: PROSE_BLOCK_KINDS,
      optionLabels: PROSE_BLOCK_KIND_LABELS,
    },
    {
      name: "text",
      label: "Texto",
      kind: "markdown",
      help: "O texto do parágrafo ou do subtítulo — a loja desenha os dois com o negrito, o itálico, o riscado e o link da barra acima.",
    },
    {
      name: "items",
      label: "Linhas da lista",
      kind: "list:markdown",
      help: "Só a lista usa: cada linha é um item. Ignoradas no subtítulo e no parágrafo.",
    },
  ],
  // A pergunta frequente (`faq.items`): a pergunta, que é a linha clicável, e a
  // resposta, que é o texto que abre. A resposta é `markdown` — o **mesmo** campo
  // do texto longo, pela razão de 14.6.3 (as marcas viajam como texto e quem as
  // interpreta é o render) —, e por isso a barra de marcas do formulário de
  // seção aparece aqui dentro sem trabalho nenhum. Sem lista dentro do item: o
  // sub-formulário são dois campos, e o editor genérico do painel o desenha.
  "list:faqItem": [
    {
      name: "question",
      label: "Pergunta",
      help: "A linha que a cliente clica para abrir a resposta. Sem pergunta não há o que clicar — e o item não aparece na loja.",
    },
    {
      name: "answer",
      label: "Resposta",
      kind: "markdown",
      help: "A resposta que abre no clique, com o negrito, o itálico, o riscado e o link da barra acima. Item sem resposta não aparece na loja: um botão que não abre nada é pior do que um item a menos.",
    },
  ],
  // Coluna do rodapé: título, a origem dos itens e — quando a origem é
  // "links" — os links dela, que são uma lista dentro do item.
  "list:column": [
    { name: "title", label: "Título" },
    {
      name: "source",
      label: "Origem dos itens",
      options: FOOTER_COLUMN_SOURCES,
      optionLabels: FOOTER_COLUMN_SOURCE_LABELS,
    },
    {
      name: "links",
      label: "Links",
      kind: "list:link",
      help: "Ignorados quando a origem é o catálogo.",
    },
  ],
  "list:social": [
    {
      name: "icon",
      label: "Ícone",
      options: ["instagram", "facebook", "whatsapp", "youtube"],
      optionLabels: ICON_LABELS,
      allowEmpty: true,
    },
    { name: "label", label: "Rótulo" },
    // A exceção declarada ao `kind: "href"`: o destino de uma rede social é
    // sempre externo (`https://…`), então a lista das rotas da loja não tem o
    // que oferecer — e um seletor de rotas aqui criaria a expectativa de um
    // destino da casa para o Instagram. A guarda de contrato
    // (`contract.unit.spec.ts`) cobra o `kind: "href"` de todo outro `href` e
    // declara esta exceção pelo nome.
    {
      name: "href",
      label: "Destino",
      kind: "text",
      help: "O endereço do perfil — sempre fora da loja (ex.: https://instagram.com/sualoja).",
    },
  ],
}

// ===========================================================================
// A superfície de tema — o tema como dado, ao lado das seções.
// ---------------------------------------------------------------------------
// Mora no fim do arquivo porque é a segunda forma de conteúdo: ela usa os
// campos (`FieldSpec`), os rótulos e as listas fechadas declarados acima, e
// vir depois deles evita que quem lê o contrato de cima para baixo encontre
// uma regra antes do dado que ela descreve.
// ===========================================================================

/**
 * A superfície que guarda o tema: a coluna `surface` da linha de estação.
 *
 * Um tema **é uma linha de `content_section`** como uma seção — mesma tabela,
 * mesmas colunas (`surface`, `type`, `enabled`, `position`) e mesmo `data`
 * JSON —, e é isso que faz o editor do CRM servir para os dois sem um segundo
 * formulário. O que muda é o que o `data` carrega: uma seção é uma peça da
 * vitrine, uma estação é a paleta e as fontes da loja inteira.
 *
 * Sem migração: a coluna já existia, com o valor padrão `home`.
 *
 * A estação continua sendo escolhida pelas **datas**, não à mão: o storefront
 * compara `MM-DD` com o dia de hoje e a janela mais estreita vence (Black
 * Friday ganha do Natal). `enabled = false` tira a estação do ar sem apagar a
 * paleta dela.
 */
export const THEME_SURFACE = "theme"

/** O `type` de todo bloco da superfície de tema. */
export const THEME_TYPE = "theme"

/** Como o tema aparece na tela do CRM. */
export const THEME_TYPE_LABEL = "Tema da loja"

/**
 * O que uma **página** pode receber: os blocos da home **menos** o cromo e a
 * abertura.
 *
 * Campo derivado, e não digitado: é a fatia de `SECTION_TYPES` que não é única
 * (`isSingletonSectionType`). Os cinco que ficam de fora são os que só existem
 * na vitrine — `announcement`, `nav` e `footer` porque o layout os resolve por
 * `find` na superfície `home` (uma segunda barra de anúncio numa página nunca
 * seria desenhada por ninguém), e `hero` e `benefits` porque moram em **casa
 * ancorada** (`FIXED_SECTION_POSITIONS`), que é uma numeração da vitrine.
 *
 * A lista sai daqui — e não de um `filter` no painel, nem de uma segunda lista
 * escrita no backend — porque três coisas dependem dela e todas as três a leem
 * do mesmo lugar: o que a aba da página oferece no CRM (`types` da superfície,
 * no `schema`), o que a API aceita gravar numa página (`resolveSurface`) e a
 * conferência de que uma superfície de página **não tem casa reservada**
 * (`reservedPositions`, que lê os `types` da superfície).
 */
export const PAGE_SECTION_TYPES: readonly SectionType[] = SECTION_TYPES.filter(
  (type) => !isSingletonSectionType(type)
)

/**
 * Como uma superfície se descreve para o CRM.
 *
 * Tudo é **dado**, e não um `if (surface === "theme")` no painel: uma
 * superfície nova no contrato aparece na tela — com rótulo, título e aviso —
 * sem tocar em React.
 *
 *   `titleField`   o campo que dá nome ao bloco na listagem. A home se chama
 *                  pelo **tipo** ("Sobre", "Coleções" — o `type` é o
 *                  identificador do render) e por isso declara `null`; uma
 *                  estação se chama pelo que o dono escreveu (`label`:
 *                  "Natal"), que é o que ele reconhece na lista;
 *   `enabledLabel` "visível na loja" quer dizer outra coisa quando o bloco é
 *                  uma estação ("no ar hoje", pela janela de datas) — é o nome
 *                  do interruptor que liga/desliga a linha;
 *   `types`        o que a superfície **pode criar**. É esta lista que o
 *                  diálogo "Nova seção" oferece: a home oferece os tipos de
 *                  seção e a superfície de tema oferece `theme` (uma estação
 *                  nova). Sem ela o diálogo daquela aba ofereceria "Hero" — um
 *                  bloco que nenhum render da superfície de tema lê;
 *   `blockLabel`   como a linha se chama no singular ("seção", "estação"), para
 *                  o botão de criar e as mensagens da tela não dizerem "Nova
 *                  seção" numa aba que só tem estações;
 *   `order`        a faixa da numeração da superfície (começo e passo), que o
 *                  CRM recebe como dado para prever o numeral das linhas
 *                  enquanto a ordem está pendente na tela.
 */
export type ContentSurfaceSpec = {
  id: string
  /**
   * O que a superfície **é**.
   *
   * Até a F1 existiam duas superfícies e cada uma se explicava pelo `id`: a
   * `home` era a vitrine e a `theme` era o tema. Uma **página** (`sobre`,
   * `trocas-e-devolucoes`…) não é nenhuma das duas, e precisava de nome.
   *
   * É dado porque três regras dependem dele, e nenhuma delas quer uma lista de
   * `id` escrita à mão: quais superfícies têm **rota** na loja (`page` — a rota
   * `[slug]` e o `sitemap` leem `PAGE_SURFACES`), o que o "Restaurar padrão"
   * repõe (`defaultsFor`, em `restore.ts`: a página repõe o padrão dela, nunca a
   * vitrine) e onde o bloco único do site pode existir (`home`/`theme` — em
   * página nenhuma, porque lá ele não seria desenhado). Sem o campo, cada uma
   * dessas três regras teria a própria cópia da lista de páginas, e um `id` novo
   * ficaria de fora de uma delas em silêncio.
   */
  kind: "home" | "theme" | "page"
  label: string
  titleField: string | null
  enabledLabel: string
  blockLabel: string
  hint: string
  types: readonly string[]
  /**
   * A faixa da numeração da superfície: em que casa cai a primeira seção
   * ordenável e de quanto em quanto a renumeração do "Salvar ordem" anda.
   *
   * A vitrine numera **de 1 em 1**: o bloco ancorado em 1, 2, 3, 4 e 10
   * (`FIXED_SECTION_POSITIONS`) e as seções ordenáveis nas casas livres — 5 a
   * 9, e a partir da sexta em 11, porque a casa 10 é do rodapé e a renumeração a
   * pula (`order.ts`). O tema numera **de 10 em 10**, como as estações do
   * `theme.json` (`THEME_SECTIONS`, em `themes.ts`). A faixa de cada superfície
   * começa depois do bloco ancorado dela — o tema não tem bloco fixo nenhum,
   * então começa na própria folga (10).
   *
   * Viaja para o CRM no payload (`order`, em `GET /admin/content`) porque o
   * painel precisa **prever** o numeral enquanto a ordem está pendente — e a
   * previsão tem de ser a mesma conta que o servidor vai gravar (`applyOrder`,
   * em `order.ts`, que é quem lê esta faixa).
   */
  order: { first: number; step: number }
}

export const CONTENT_SURFACES: readonly ContentSurfaceSpec[] = [
  {
    id: "home",
    kind: "home",
    label: "Conteúdo da vitrine",
    titleField: null,
    enabledLabel: "Visível na loja",
    blockLabel: "seção",
    hint:
      "Estas seções montam a página inicial, na ordem das setas — que só vale " +
      "depois de “Salvar ordem”. As seções marcadas como Fixo (a barra de " +
      "anúncio, o cabeçalho, a capa e a faixa de benefícios, que abrem a " +
      "página, mais o rodapé, que a fecha) não têm ordem: elas moram sempre " +
      "nas mesmas casas — 1, 2, 3, 4 e 10 —, e as seções ordenáveis ocupam as " +
      "casas livres do meio: 5 a 9 e, a partir da sexta, 11 (a casa 10 é do " +
      "rodapé). A aparência entra junto do " +
      "campo que ela muda: em branco, a seção segue o tema da loja — inclusive " +
      "quando o tema é sazonal.",
    types: SECTION_TYPES,
    order: { first: 5, step: 1 },
  },
  {
    id: THEME_SURFACE,
    kind: "theme",
    label: THEME_TYPE_LABEL,
    titleField: "label",
    enabledLabel: "Estação no ar",
    blockLabel: "estação",
    hint:
      "Cada linha é uma estação, e a loja escolhe sozinha pelo dia de hoje: a " +
      "janela de datas mais estreita vence (Black Friday ganha do Natal). A " +
      "estação “default” é a base — cor ou fonte em branco numa estação " +
      "sazonal é herdada dela.",
    types: [THEME_TYPE],
    order: { first: 10, step: 10 },
  },
  // ---------------------------------------------------------------------------
  // As páginas (a F1 do doc 14). A chave (`id`) **é o slug**: é ela que a rota
  // `(main)/[slug]/page.tsx` casa e que o `sitemap` publica, então renomear uma
  // página aqui renomeia a URL dela — e URL de página institucional é
  // permanente. O `label` é o que a aba do CRM mostra.
  //
  // `titleField: null` porque uma página não tem um campo que lhe dê nome (ao
  // contrário da estação, que se chama pelo que o dono escreveu): a linha da
  // lista se chama pelo tipo do bloco ("Sobre", "Banner editorial"), como na
  // vitrine.
  //
  // `types: PAGE_SECTION_TYPES` fecha o defeito 2 do doc 14 pelo lado do painel:
  // a lista não traz `hero`, `benefits`, `announcement`, `nav` nem `footer`,
  // então a aba da página **não oferece** um bloco que a loja nunca desenharia
  // ali. Quem recusa o corpo que insistir é a API (`resolveSurface`).
  //
  // `order.first` é **1**, e não o 5 da vitrine: a página não tem bloco ancorado
  // nenhum (nenhum tipo único entre os `types` dela, então `reservedPositions`
  // devolve vazio), logo a primeira casa livre é a primeira. Copiar o 5 faria a
  // primeira linha da página nascer numerada como se quatro blocos existissem
  // antes dela — e o numeral é o que o lojista lê na tela.
  //
  // A ordem da lista é a da fila do negócio (14.3): o que já tem quem peça,
  // primeiro. `perguntas-frequentes` é a última porque era a que dependia do
  // bloco de Q&A — que chegou no PR4 (`faq`, ver 14.19); até lá ela se montava
  // com `editorial`, e a dica da superfície dizia isso. Agora o par de blocos
  // existe, e a dica fala do presente.
  // ---------------------------------------------------------------------------
  {
    id: "sobre",
    kind: "page",
    label: "Sobre",
    titleField: null,
    enabledLabel: "Publicada",
    blockLabel: "seção",
    hint:
      "Esta página monta o /sobre — a história da marca, em texto, foto e " +
      "botão. Sem nenhuma seção publicada, o endereço responde 404; a página " +
      "nunca cai na vitrine.",
    types: PAGE_SECTION_TYPES,
    order: { first: 1, step: 1 },
  },
  {
    id: "trocas-e-devolucoes",
    kind: "page",
    label: "Trocas e devoluções",
    titleField: null,
    enabledLabel: "Publicada",
    blockLabel: "seção",
    hint:
      "Esta página monta o /trocas-e-devolucoes — a política de troca e " +
      "devolução, que é o que a coluna Institucional do rodapé promete. Sem " +
      "nenhuma seção publicada, o endereço responde 404.",
    types: PAGE_SECTION_TYPES,
    order: { first: 1, step: 1 },
  },
  {
    id: "privacidade",
    kind: "page",
    label: "Privacidade",
    titleField: null,
    enabledLabel: "Publicada",
    blockLabel: "seção",
    hint:
      "Esta página monta o /privacidade — a política de privacidade (LGPD) " +
      "que o link de consentimento do checkout promete. Sem nenhuma seção " +
      "publicada, o endereço responde 404.",
    types: PAGE_SECTION_TYPES,
    order: { first: 1, step: 1 },
  },
  {
    id: "termos",
    kind: "page",
    label: "Termos de uso",
    titleField: null,
    enabledLabel: "Publicada",
    blockLabel: "seção",
    hint:
      "Esta página monta o /termos — os termos de uso, irmãos do link de " +
      "consentimento. Sem nenhuma seção publicada, o endereço responde 404.",
    types: PAGE_SECTION_TYPES,
    order: { first: 1, step: 1 },
  },
  {
    id: "contato",
    kind: "page",
    label: "Contato",
    titleField: null,
    enabledLabel: "Publicada",
    blockLabel: "seção",
    hint:
      "Esta página monta o /contato — os canais de atendimento (telefone, " +
      "e-mail, WhatsApp e horário). Os ícones dela já existem no CRM sem uso. " +
      "Sem nenhuma seção publicada, o endereço responde 404.",
    types: PAGE_SECTION_TYPES,
    order: { first: 1, step: 1 },
  },
  {
    id: "perguntas-frequentes",
    kind: "page",
    label: "Perguntas frequentes",
    titleField: null,
    enabledLabel: "Publicada",
    blockLabel: "seção",
    hint:
      "Esta página monta o /perguntas-frequentes — as dúvidas da cliente, em " +
      "pares de pergunta e resposta, abertos no clique. O texto de abertura " +
      "vem dos blocos de texto (`prose`). Sem nenhuma seção publicada, o " +
      "endereço responde 404.",
    types: PAGE_SECTION_TYPES,
    order: { first: 1, step: 1 },
  },
]

/**
 * As páginas declaradas: a fatia de `CONTENT_SURFACES` com `kind: "page"`.
 *
 * Derivada, e não digitada — a mesma regra do `PAGE_SECTION_TYPES`, no outro
 * lado da relação. Quem lê esta lista é quem precisa saber que uma URL
 * institucional existe: a rota `(main)/[slug]/page.tsx` (o `slug` está aqui, ou
 * a página é 404), o `sitemap.ts` e o guarda de colisão de slug que a CI roda.
 * Uma página nova entra no contrato e aparece nos três sem que nenhum deles seja
 * editado — que é o ponto da F1: declarar, e não desenhar.
 */
export const PAGE_SURFACES: readonly ContentSurfaceSpec[] =
  CONTENT_SURFACES.filter((surface) => surface.kind === "page")

/**
 * Um destino que o painel oferece: a rota e o nome que o lojista lê.
 *
 * `href` é o valor que se grava no campo — a URL como ela é escrita no conteúdo
 * (`/sobre`, `/store`), **sem** o país: quem prefixa é a loja
 * (`LocalizedClientLink`, por `nav-link`), e gravar `/br/sobre` amarraria o
 * conteúdo ao país do dia.
 */
export type ContentDestination = {
  href: string
  label: string
}

/**
 * As rotas **fixas** da loja — as vizinhas do `[slug]` em `(main)`.
 *
 * Nenhuma superfície as declara porque nenhuma as desenha: são as telas escritas
 * à mão (o catálogo, a sacola, a conta, a busca e o rastreio), e por isso a lista
 * mora aqui, com o rótulo de cada uma, em vez de num `readdir` do painel. Um
 * destino daqui que deixe de existir na loja reprova no guarda do storefront
 * (`page-surfaces.spec.ts`), que lê o **diretório de verdade** — a mesma régua
 * que já prende os destinos do rodapé.
 *
 * O que fica de fora, de propósito: as rotas **dinâmicas** (`/products/<handle>`,
 * `/collections/<handle>`, `/order/<id>`), que não são rota nenhuma sem o
 * identificador, e as **âncoras** da vitrine (`/#editorial`), cujo dono é o
 * `nav-link` da loja — uma lista aqui seria a segunda cópia do mapa dele. Os
 * dois casos continuam valendo no campo: ele é texto, e a lista só sugere.
 */
const STORE_ROUTES: readonly ContentDestination[] = [
  { href: "/", label: "Início (a vitrine)" },
  { href: "/store", label: "Catálogo (todas as peças)" },
  { href: "/cart", label: "Sacola" },
  { href: "/account", label: "Minha conta" },
  { href: "/search", label: "Busca" },
  { href: "/rastreio", label: "Rastrear o pedido" },
]

/**
 * O índice de destinos — as rotas que a loja **tem**, para o seletor do CRM.
 *
 * É a peça que fecha a causa-raiz do doc 13. O diagnóstico de lá não foi
 * desatenção de quem editou: o painel só oferecia texto livre, e o único
 * endereço que o lojista podia conferir era `/store`, que existe e sempre
 * responde. Os nove botões apontando para o catálogo eram o resultado disso.
 *
 * Duas metades, e as duas têm dono: as rotas fixas são declaradas aqui
 * (`STORE_ROUTES`, com o rótulo), e as páginas são **derivadas** de
 * `PAGE_SURFACES` — a mesma lista que a rota `[slug]` e o `sitemap` leem. Página
 * nova no contrato aparece no seletor sem que ninguém edite esta lista, que é a
 * regra da F1 (declarar, e não desenhar) valendo para o painel.
 *
 * Quem consome: `schema.destinations` (o `datalist` do campo `kind: "href"`) e o
 * guarda `page-surfaces.spec.ts`, que confere os dois sentidos — todo destino
 * aqui resolve numa rota que existe, e toda página declarada é oferecida.
 */
export const CONTENT_DESTINATIONS: readonly ContentDestination[] = [
  ...STORE_ROUTES,
  ...PAGE_SURFACES.map((surface) => ({
    href: `/${surface.id}`,
    label: surface.label,
  })),
]

/** A superfície declarada com este `id`, ou `undefined` se ninguém a declarou. */
export function findSurface(id: unknown): ContentSurfaceSpec | undefined {
  return typeof id === "string"
    ? CONTENT_SURFACES.find((surface) => surface.id === id)
    : undefined
}

/**
 * O `id` é uma superfície declarada?
 *
 * É a guarda das duas pontas que recebem uma superfície — a leitura pública
 * (`GET /store/content?surface=`) e a escrita do CRM —, e existe porque as duas
 * aceitavam **qualquer** string: `?surface=sobreo` respondia 200 com
 * `{"sections":[]}`, e um typo de instalação de página nova (a mesma família do
 * `/stroe` do doc 13) sumia sem aviso. Com a lista do contrato, o erro é 400 em
 * pt-BR.
 */
export function isKnownSurface(id: unknown): id is string {
  return findSurface(id) !== undefined
}

/** A superfície é uma página? Ver `kind`, no `ContentSurfaceSpec`. */
export function isPageSurface(id: unknown): boolean {
  return findSurface(id)?.kind === "page"
}

/**
 * As seções de uma página que põem o endereço **no ar** — a régua do 200.
 * -------------------------------------------------------------------------
 * Duas perguntas, uma resposta:
 *
 *   - a seção está **ligada**? O interruptor é a coluna `enabled`, que o
 *     contrato chama de **Publicada** na superfície de página (`enabledLabel`);
 *   - o tipo dela é um que a loja **conhece**? (`isSectionType`) — um tipo
 *     gravado no registro do schema sem deploy da loja é descartado antes do
 *     render (`supportedSections`, no storefront), porque o render é exaustivo
 *     e o `default` lança: a página inteira viraria HTTP 500.
 *
 * É o mesmo par que a rota `[slug]` aplica antes de responder 404
 * (`visibleSections` + `supportedSections`, no storefront — ela lê os dois pelos
 * dados, já que a Store API só manda as habilitadas). E é por isso que a função
 * mora **aqui**, e não numa cópia de cada lado: o CRM diz "publicada" com ela e
 * a página responde 200 com ela. Um CRM que dissesse "publicada" para um
 * endereço que responde 404 seria pior do que não ter a tela — é a promessa
 * vazia do doc 13, agora com a autoridade de quem deveria saber.
 *
 * **O que ela não sabe:** se a seção que sobrou tem o que mostrar. Um `prose`
 * publicado e ainda sem texto passa por aqui e some no render — o vazio de cada
 * tipo é de quem desenha, e o endereço abre vazio. Distinguir os dois exigiria
 * uma segunda cópia das regras de vazio de cada render, que é o espelho que este
 * contrato não paga (doc 14, 14.21).
 */
export function publishedSections<T extends { type: string; enabled: boolean }>(
  sections: readonly T[]
): T[] {
  return sections.filter(
    (section) => section.enabled && isSectionType(section.type)
  )
}

/**
 * Os estados de uma página declarada — o vocabulário da tela "Páginas".
 *
 * São **três**, e o terceiro existe porque a diferença importa para quem edita:
 * uma página **despublicada** é a que tem bloco e nenhum no ar (o endereço
 * responde 404 e o link do rodapé, se promete a página, promete um link
 * quebrado — o defeito medido em 14.16); uma página **sem blocos** é a que ainda
 * não foi montada (404 também, e é esse o caminho normal até a copy entrar).
 *
 * Os rótulos e o tom viajam no payload do CRM (`pageStates`, em
 * `GET /admin/content/pages`): a tela do lojista desenha o que chega, e a
 * palavra "Publicada" é a mesma do interruptor da seção — uma régua, um
 * vocabulário.
 */
export type PageState = "published" | "unpublished" | "empty"

/** O que a tela mostra para cada estado: o rótulo, o tom e a frase. */
export type PageStateSpec = {
  id: PageState
  label: string
  /** O `color` do `Badge` do painel (`@medusajs/ui`). */
  tone: "green" | "orange" | "grey"
  meaning: string
}

export const PAGE_STATES: readonly PageStateSpec[] = [
  {
    id: "published",
    label: "Publicada",
    tone: "green",
    meaning: "Tem bloco publicado: o endereço responde.",
  },
  {
    id: "unpublished",
    label: "Despublicada",
    tone: "orange",
    meaning:
      "Tem blocos e nenhum publicado: o endereço responde 404. Se o rodapé " +
      "promete esta página, ele promete um link quebrado.",
  },
  {
    id: "empty",
    label: "Sem blocos",
    tone: "grey",
    meaning:
      "Nenhum bloco montado: o endereço responde 404 até alguém montar a página.",
  },
]

/**
 * O estado de uma página, das seções dela — a régua aplicada.
 *
 * Recebe as seções **cruas** (as desabilitadas inclusive), que é o que o CRM
 * tem em mão: a conta e a decisão saem da mesma lista, e por isso não há como a
 * tela dizer "publicada" com zero publicadas.
 */
export function pageState(
  sections: readonly { type: string; enabled: boolean }[]
): PageState {
  if (publishedSections(sections).length > 0) {
    return "published"
  }

  return sections.length > 0 ? "unpublished" : "empty"
}

/**
 * Todo `type` de conteúdo que o CRM edita: as seções **e** o bloco de tema.
 *
 * É a união do que as superfícies podem criar (`CONTENT_SURFACES[i].types`), e
 * existe como constante porque a rota admin valida o `type` do corpo contra o
 * registro — sem `theme` aqui, a primeira gravação de uma estação seria
 * recusada com "deve ser um de: announcement, hero, …".
 *
 * A união das superfícies e esta lista são conferidas uma contra a outra pela
 * guarda de paridade: uma superfície nova que declare um tipo que ninguém
 * aceita (ou o contrário) reprova o `make check` em vez de virar um botão que
 * responde 400 na tela do lojista.
 */
export const CONTENT_TYPES: readonly string[] = [...SECTION_TYPES, THEME_TYPE]

/**
 * As famílias que a loja de fato carrega — **derivadas** de `THEME_FONTS`.
 *
 * São as três self-hosted (`frontend/src/app/fonts`, `localFont` no layout):
 * o `<select>` do CRM não pode oferecer outra, porque trocar a fonte dos
 * títulos por "Arial" não faria o navegador da cliente baixar Arial nenhuma —
 * `themeToCSSVariables` escreveria `"Arial", Georgia, serif` e a promessa da
 * tela ("a loja fica nesta fonte") seria falsa.
 *
 * A lista sai do contrato em vez de ser digitada aqui: a família já está em
 * `THEME_FONTS[role].family`, e uma segunda cópia dos três nomes poderia
 * envelhecer sozinha — o `<select>` ofereceria uma fonte que ninguém carrega.
 */
export const THEME_FONT_FAMILIES: readonly string[] = FONT_ROLES.map(
  (role) => THEME_FONTS[role].family
)

/** O papel de cada família, para a opção do `<select>` não ser só o nome. */
const FONT_ROLE_DESCRIPTIONS: Record<FontRole, string> = {
  display: "títulos, serifada",
  sans: "textos e interface",
  script: "manuscrita",
}

/** Tradução de cada família (e da opção vazia) para o `<select>` do tema. */
export const THEME_FONT_FAMILY_LABELS: Record<string, string> = {
  "": "Padrão do tema da loja",
  ...Object.fromEntries(
    FONT_ROLES.map((role) => [
      THEME_FONTS[role].family,
      FONT_ROLE_DESCRIPTIONS[role],
    ])
  ),
}

/** Opções do `<select>` de fonte do tema: o "herda" na frente das famílias. */
export const THEME_FONT_OPTIONS: readonly string[] = [
  "",
  ...THEME_FONT_FAMILIES,
]

/** Rótulo do campo de cada papel de fonte no editor do tema. */
export const THEME_FONT_ROLE_LABELS: Record<FontRole, string> = {
  display: "Fonte dos títulos",
  sans: "Fonte dos textos",
  script: "Fonte manuscrita",
}

/** `#RRGGBB` — o formato que o storefront consegue usar como variável CSS. */
export const HEX_COLOR_PATTERN = "^#[0-9a-fA-F]{6}$"

/**
 * `MM-DD`, o formato que o storefront compara com a data de hoje.
 *
 * Sem o ano de propósito: a janela é anual (o Verão vira o ano), e quem
 * resolve o tema é que decide o que fazer quando `start > end`.
 */
export const MONTH_DAY_PATTERN = "^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$"

/**
 * Campos de `data` de um bloco de tema, na ordem em que o CRM os mostra.
 *
 * Mesma máquina dos campos de seção: a rota admin valida contra a lista do
 * **schema gravado** e o editor desenha o que ela diz — nem a paleta nem as
 * datas têm uma tela própria no painel. Toda cor sai de `THEME_COLOR_TOKENS`
 * e todo papel de `FONT_ROLES`, pelos helpers de nome, para acrescentar uma
 * cor no contrato não deixar o editor (nem a loja) para trás.
 *
 * Nada além do `label` é obrigatório: uma estação declara só o que muda e o
 * resto é **herdado** do tema padrão — era assim no `theme.json` (o Natal
 * troca três cores) e continua sendo aqui. Campo em branco significa "segue o
 * padrão", não "apague".
 */
export const THEME_FIELDS: readonly FieldSpec[] = [
  {
    name: "label",
    label: "Nome da estação",
    kind: "text",
    required: true,
    help: "Como a estação aparece para você aqui no CRM. A loja não mostra.",
  },
  {
    name: "dateRangeStart",
    label: "Começa em (MM-DD)",
    kind: "text",
    pattern: MONTH_DAY_PATTERN,
    help: "Mês e dia, sem ano: 11-20 para 20 de novembro.",
  },
  {
    name: "dateRangeEnd",
    label: "Termina em (MM-DD)",
    kind: "text",
    pattern: MONTH_DAY_PATTERN,
    help: "Pode terminar no ano seguinte (o Verão vai de 12-27 a 03-20).",
  },
  ...THEME_COLOR_TOKENS.map((token) => ({
    name: themeColorField(token),
    label: APPEARANCE_COLOR_LABELS[token] ?? token,
    kind: "hex" as const,
    pattern: HEX_COLOR_PATTERN,
    help: "Em branco, herda a cor do tema padrão.",
  })),
  ...FONT_ROLES.map((role) => ({
    name: themeFontField(role),
    label: THEME_FONT_ROLE_LABELS[role],
    kind: "select" as const,
    options: THEME_FONT_OPTIONS,
    optionLabels: THEME_FONT_FAMILY_LABELS,
    help: "Em branco, herda a fonte do tema padrão.",
  })),
]

