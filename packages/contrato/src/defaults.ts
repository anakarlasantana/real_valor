import { ANNOUNCEMENT_SPEED_DEFAULT, type HomeSection } from "./contract.ts"

/**
 * Conteúdo padrão da home — a cópia exata do protótipo.
 *
 * Uma exceção, e ela está marcada na própria seção: `lancamentos` (o trilho de
 * novidades depois do hero) não existe no protótipo — a cópia dela foi escrita
 * aqui, na voz da marca, e é o ponto de partida que o lojista troca no CRM
 * inteiro. As demais são cópia literal.
 *
 * Usado por três caminhos:
 *   1. `scripts/seed-content.ts` popula o banco com isto quando a base nasce
 *      (`make seed`), pela CLI.
 *   2. `POST /admin/content/restore` — o botão "Restaurar padrão" do CRM — faz
 *      a mesma coisa pelo painel, para uma base que subiu vazia ou uma seção
 *      apagada por engano. As duas portas chamam a mesma função
 *      (`modules/content/restore.ts`), de propósito.
 *   3. O frontend usa como fallback se a API de conteúdo falhar, para
 *      que a vitrine nunca caia por causa do CMS.
 *
 * Nos três casos este arquivo é a única cópia: desde o G5 o storefront importa
 * este módulo pelo pacote (`@rv/contrato`) como o backend — o artefato gerado
 * (`contract.generated.ts`) morreu com a cópia.
 *
 * Imagem aponta para `/brand/*.jpg` (servida pelo Next, em
 * `frontend/public/brand`) enquanto for a foto do protótipo. Depois do primeiro
 * envio pelo CRM o valor gravado é a **chave** do arquivo
 * (`1699999999-hero.jpg`): quem traduz chave → endereço é o `resolveMediaUrl`
 * do storefront (`frontend/src/lib/util/media.ts`), e por isso os dois formatos
 * convivem sem migração.
 */
export const DEFAULT_HOME_SECTIONS: HomeSection[] = [
  {
    id: "announcement",
    type: "announcement",
    enabled: true,
    position: 1,
    /**
     * A mensagem única é a de sempre — continua sendo o que a barra mostra
     * quando não há ticker —, e o ticker nasce com a **mesma informação**
     * separada em duas mensagens: uma por peça de informação, que é o que dá ao
     * ticker o que rolar.
     *
     * Nada de copy nova aqui. O padrão não pode prometer o que a loja não
     * combinou (prazo de troca, frete grátis) só porque a barra ganhou
     * movimento; quem escreve mensagem nova é o lojista, no CRM.
     */
    text: "Frete seguro para todo o Brasil · Até 6x sem juros",
    messages: ["Frete seguro para todo o Brasil", "Até 6x sem juros"],
    speedSeconds: ANNOUNCEMENT_SPEED_DEFAULT,
  },
  /**
   * Cabeçalho. Não é uma seção da home — o layout o renderiza em todas
   * as rotas —, mas é conteúdo como qualquer outro, então mora aqui e
   * ganha um bloco no seed. A casa dele é **2**, a segunda do bloco ancorado
   * (`FIXED_SECTION_POSITIONS`, no contrato), e a posição não decide o render
   * da home: quem desenha o cabeçalho em todas as rotas é o layout.
   *
   * O fallback do storefront (`DEFAULT_HEADER`) é derivado deste bloco pelo
   * gerador — não há segunda cópia.
   */
  {
    id: "nav",
    type: "nav",
    enabled: true,
    position: 2,
    links: [
      { label: "Início", href: "/#hero" },
      { label: "Coleções", href: "/#collections" },
      { label: "Produtos", href: "/store" },
      { label: "Sobre", href: "/#editorial" },
      { label: "Contatos", href: "mailto:contato@realvalor.com.br" },
    ],
    actions: [
      { icon: "bag", label: "Sacola", href: "/cart" },
      { icon: "account", label: "Conta", href: "/account" },
      { icon: "search", label: "Buscar", href: "/search" },
    ],
  },
  /**
   * A capa. É a **abertura da home**: a vitrine a desenha, mas ela não entra na
   * ordem das setas — junto com a faixa de benefícios, é o começo da página, e
   * não conteúdo que se reordena (casa 3, ver `FIXED_SECTION_POSITIONS`).
   *
   * Nasce com **um** slide: é a capa estática de sempre (a foto e a cópia do
   * protótipo), e é o mínimo que a seção desenha — a lista é a capa inteira
   * desde a v9, e sem slide nenhum não há capa.
   */
  {
    id: "hero",
    type: "hero",
    enabled: true,
    position: 3,
    slides: [
      {
        imageUrl: "/brand/hero.jpg",
        imageAlt: "Alfaiataria feminina Real Valor",
        eyebrow: "Nova coleção",
        headline: "Você não precisa ser rica para se",
        headlineEmphasis: "sentir elegante.",
        subtitle: "Alfaiataria para todas.",
        ctaLabel: "Conheça a coleção",
        ctaHref: "/store",
      },
    ],
    /**
     * A nota da capa — a linha do canto, a que o protótipo redesenhado escreve
     * sobre a foto. É cópia nova (a capa não a tinha), e é **da faixa**: no
     * carrossel ela não troca junto com a foto.
     */
    note: "Peças que acompanham quem você é — e quem está se tornando.",
  },
  /**
   * A faixa de benefícios. Fecha a **abertura da home** (casa 4) e nasce fixa,
   * como a capa: o que o lojista ordena pelas setas começa depois dela.
   */
  {
    id: "benefits",
    type: "benefits",
    enabled: true,
    position: 4,
    /**
     * Os **três** itens do protótipo redesenhado (a faixa nasceu com quatro).
     *
     * A cópia é a do protótipo, e é promessa comercial — frete grátis acima de
     * R$ 499, 5% no Pix, dados protegidos. Fica gravada porque é ela que a régua
     * desenha; quem confere se a loja cumpre (e troca a frase no CRM) é o
     * lojista, como em qualquer outro texto do conteúdo padrão.
     *
     * As chaves de ícone são as que o registro da vitrine já tem: `delivery` é o
     * caminhão, `price` a etiqueta e `quality` o selo de garantia. Um par
     * `truck`/`sparkle`/`shield` novo exigiria chave nova no registro do
     * storefront **e** no `ICON_LABELS` do contrato, que é a lista que o CRM
     * oferece — três sinônimos para os mesmos desenhos.
     */
    items: [
      {
        icon: "delivery",
        title: "Frete grátis",
        subtitle: "Em compras acima de R$ 499",
      },
      {
        icon: "price",
        title: "5% de desconto",
        subtitle: "Para pagamentos via Pix",
      },
      {
        icon: "quality",
        title: "Compra segura",
        subtitle: "Seus dados sempre protegidos",
      },
    ],
  },
  {
    id: "lancamentos",
    type: "launches",
    enabled: true,
    position: 5,
    // Cópia escrita AQUI, e não copiada do protótipo: ele não tem esta seção.
    // É ponto de partida na voz da marca — o lojista troca tudo no CRM.
    eyebrow: "Novidades",
    title: "Chegou agora",
    subtitle:
      "As peças que acabaram de entrar na vitrine, na ordem em que chegaram.",
    limit: 8,
    viewAllLabel: "Ver tudo",
    viewAllHref: "/store",
  },
  {
    id: "collections",
    type: "collections",
    enabled: true,
    position: 6,
    eyebrow: "Explore",
    title: "Nossas coleções",
    subtitle:
      "Seleções criadas para diferentes momentos, sempre com a assinatura visual da REAL VALOR.",
    items: [
      {
        title: "Essência",
        subtitle: "Para o seu dia a dia",
        imageUrl: "/brand/collection-1.jpg",
        imageAlt: "Coleção Essência",
        href: "/store",
        ctaLabel: "Comprar agora",
      },
      {
        title: "Presença",
        subtitle: "Para grandes momentos",
        imageUrl: "/brand/collection-2.jpg",
        imageAlt: "Coleção Presença",
        href: "/store",
        ctaLabel: "Comprar agora",
      },
      {
        title: "Autêntica",
        subtitle: "Para vestir você",
        imageUrl: "/brand/collection-3.jpg",
        imageAlt: "Coleção Autêntica",
        href: "/store",
        ctaLabel: "Comprar agora",
      },
    ],
  },
  /**
   * A seção "Sobre" (o manifesto). Casa **7**: o protótipo redesenhado põe o
   * manifesto logo antes da faixa editorial, e é essa a ordem que a loja lê.
   */
  {
    id: "editorial",
    type: "editorial",
    enabled: true,
    position: 7,
    script: "Vista o seu valor.",
    /**
     * O eyebrow e o realce do título são os dois campos que a v10 acrescentou:
     * com eles o título sai em duas vozes, como no protótipo ("Você não precisa
     * provar nada." / "Só precisa se reconhecer.").
     *
     * A cópia do título continua sendo a da marca — o protótipo é a **régua do
     * desenho**, e a frase com que a REAL VALOR se apresenta não é detalhe de
     * layout. Quem a troca é o lojista, no CRM.
     */
    eyebrow: "NOSSA ESSÊNCIA",
    title: "A alfaiataria que valoriza você,",
    titleEmphasis: "não o seu status.",
    body: "A REAL VALOR acredita que elegância não é privilégio. É um direito. Criamos peças de alfaiataria feminina com estética sofisticada e preço acessível, para que mais mulheres possam se sentir bem vestidas na vida real.",
    ctaLabel: "Conheça a nossa história",
    ctaHref: "/store",
    imageUrl: "/brand/story-1.jpg",
    imageAlt: "Detalhes de alfaiataria Real Valor",
    imagePosition: "left",
  },
  /**
   * A faixa editorial (`banner`, "Banner editorial" no CRM): a última faixa do
   * protótipo redesenhado — a foto inteira, o eyebrow, o título em duas linhas
   * e o botão para o catálogo. Casa **8**, logo depois do manifesto; os extras
   * da loja (os destaques e o Instagram) ficam depois dela.
   *
   * A cópia é a do protótipo, palavra por palavra: aqui não havia cópia da
   * marca para preservar — a seção é nova. A foto é a `/brand/story-2.jpg` (a
   * outra do manifesto, que ainda não aparecia na home), e o destino do botão é
   * `/store`, o mesmo das outras chamadas.
   */
  {
    id: "banner",
    type: "banner",
    enabled: true,
    position: 8,
    eyebrow: "REAL VALOR, REAL HISTÓRIA",
    title: "Mais que roupa,",
    titleEmphasis: "é sobre você.",
    imageUrl: "/brand/story-2.jpg",
    imageAlt: "Editorial Real Valor",
    ctaLabel: "Descobrir a coleção",
    ctaHref: "/store",
  },
  {
    id: "featured",
    type: "featured",
    enabled: true,
    position: 9,
    eyebrow: "Shop",
    title: "Peças em destaque",
    subtitle:
      "Uma vitrine editorial com navegação simples, foco no produto e preço sempre visível.",
    viewAllLabel: "Ver todos os produtos",
  },
  /**
   * Rodapé. Como o `nav`, não é uma seção da home: o layout o renderiza
   * em todas as rotas. A casa dele é **10** — a que fecha o bloco ancorado —, e
   * é ela que a renumeração pula: as seções ordenáveis ocupam as casas livres
   * (5 a 9 e, a partir da sexta, 11) e nunca nascem na 10
   * (`FIXED_SECTION_POSITIONS`, no contrato).
   *
   * O fallback do storefront (`DEFAULT_FOOTER`) é derivado deste bloco pelo
   * gerador — não há segunda cópia.
   *
   * `columns` nasce com as **duas colunas da referência** —
   * "Institucional" e "Atendimento" —, e cada link delas é uma porta para uma
   * **página declarada** (`PAGE_SURFACES`): o `href` é o `id` da superfície, e
   * quem prefixa o país é o `nav-link`. Foi o PR1 do doc 14 que deu destino a
   * estas colunas; antes dele, "Institucional" seria um título prometendo o que
   * não existia — o defeito que o doc 13 mediu ("promessa no ar sem página que a
   * sustente").
   *
   * ⚠️ **A régua de publicação: um link só vai ao ar quando o destino responde
   * 200.** Dois dos oito respondem sem depender de copy — `/rastreio` (RV-044) e
   * o `mailto:` que o menu já publica —; os seis de página (`/sobre`,
   * `/trocas-e-devolucoes`, `/privacidade`, `/termos`, `/contato`,
   * `/perguntas-frequentes`) respondem **404 enquanto a página estiver vazia**
   * (decisão 7). O padrão é o **molde de lançamento**: ele traz as colunas
   * inteiras, e ativá-las sem a copy trocaria "o link não existe" por "o link
   * está quebrado".
   *
   * A coluna continua sendo conteúdo: o lojista insere, edita, reordena e
   * remove todas pelo mesmo editor do admin — digitando os links ou apontando a
   * coluna para o catálogo (`source`). O que o padrão entrega é o **nome** das
   * colunas e o destino certo já apontado (/rastreio, /sobre, …), para o
   * rodapé não depender de alguém lembrar da URL.
   */
  {
    id: "footer",
    type: "footer",
    enabled: true,
    position: 10,
    columns: [
      {
        title: "Institucional",
        source: "links",
        links: [
          {
            label: "Sobre",
            href: "/sobre",
          },
          {
            label: "Trocas e devoluções",
            href: "/trocas-e-devolucoes",
          },
          {
            label: "Privacidade",
            href: "/privacidade",
          },
          {
            label: "Termos de uso",
            href: "/termos",
          },
        ],
      },
      {
        title: "Atendimento",
        source: "links",
        links: [
          {
            label: "Contato",
            href: "/contato",
          },
          {
            label: "Perguntas frequentes",
            href: "/perguntas-frequentes",
          },
          {
            label: "Acompanhar pedido",
            href: "/rastreio",
          },
          {
            label: "contato@realvalor.com.br",
            href: "mailto:contato@realvalor.com.br",
          },
        ],
      },
    ],
    social: [
      {
        icon: "instagram",
        label: "Instagram",
        href: "https://instagram.com/realvalor",
      },
    ],
  },
  /**
   * O Instagram. É a **sexta seção ordenável** da vitrine, e por isso nasce na
   * casa **11**: a casa 10 é do rodapé (`FIXED_SECTION_POSITIONS`), e a
   * renumeração das ordenáveis a pula — 5, 6, 7, 8, 9 e 11. É também por isso
   * que este bloco é o **último do arquivo**: a lista é escrita na ordem das
   * casas, e a 11 vem depois da 10.
   *
   * O título deixou de ser "Mais que roupas, é sobre você.": essa linha passou a
   * ser a da faixa editorial (`banner`), que é onde o protótipo a escreve. Duas
   * faixas com o mesmo título na mesma página seriam repetição; o Instagram diz
   * o que ele é — o convite para seguir o perfil.
   */
  {
    id: "instagram",
    type: "instagram",
    enabled: true,
    position: 11,
    handle: "@realvalor",
    title: "Siga a Real Valor",
    images: [
      { imageUrl: "/brand/story-1.jpg", imageAlt: "Real Valor no Instagram" },
      { imageUrl: "/brand/story-2.jpg", imageAlt: "Real Valor no Instagram" },
      {
        imageUrl: "/brand/collection-1.jpg",
        imageAlt: "Real Valor no Instagram",
      },
      {
        imageUrl: "/brand/collection-2.jpg",
        imageAlt: "Real Valor no Instagram",
      },
    ],
  },
]
/**
 * As categorias que o padrão liga aos chips da vitrine.
 *
 * São **handles**, e não ids: o id de uma categoria é criado pelo seed a cada
 * base (`pcat_…`), então um id escrito aqui não existiria em lugar nenhum. O
 * `handle` é estável e legível — é o mesmo que a loja usa na URL do chip
 * (`/?peca=vestidos`) —, e quem resolve handle → id é quem cria a seção
 * (`modules/content/restore.ts`) e quem repõe os chips de uma base antiga
 * (`scripts/seed-content.ts`), os dois por `defaultFilterIds`
 * (`modules/content/filters.ts`).
 *
 * **A lista não mora na seção do padrão** (`DEFAULT_HOME_SECTIONS.featured`)
 * porque o chip não é conteúdo dela: é referência, e o link só existe depois de
 * a seção existir. O que estava lá era a cópia — `["Todos", "Blazers",
 * "Conjuntos", "Calças"]` —, e "Blazers" não existe no catálogo: aquele chip
 * devolvia zero peças em silêncio.
 */
export const DEFAULT_FEATURED_FILTERS = [
  "vestidos",
  "blusas-camisas",
  "calcas-alfaiataria",
  "conjuntos",
] as const



/**
 * O `data` de uma seção NOVA, por tipo — o que a rota admin usa quando o
 * lojista cria uma seção pelo CRM.
 *
 * A seção nasce igual à padrão (o título do hero, os quatro itens da faixa de
 * benefícios) e o lojista edita a partir daí. As duas alternativas são piores:
 * exigir os campos obrigatórios de uma seção que ainda não existe obrigaria o
 * formulário a pedir tudo antes de a seção aparecer na lista, e aceitar a
 * seção vazia seria gravar algo que a loja não sabe desenhar.
 *
 * Derivado de `DEFAULT_HOME_SECTIONS`, e não escrito de novo, porque é o
 * **mesmo** conteúdo: uma seção nova nasce com a cara da loja. Ficam de fora as
 * colunas do bloco (`id`, `enabled`, `position`) — quem decide as três é a
 * rota, e a posição da seção nova vai para o fim da lista.
 */
export const DEFAULT_SECTION_DATA: Record<string, Record<string, unknown>> =
  Object.fromEntries(
    DEFAULT_HOME_SECTIONS.map(
      ({ id: _id, enabled: _enabled, position: _position, type, ...data }) => [
        type,
        data,
      ]
    )
  )
/**
 * A primeira seção de um tipo no conteúdo padrão — o cromo (`nav`/`footer`).
 *
 * Morava no artefato gerado do storefront, que sintetizava os dois blocos a
 * partir de `DEFAULT_HOME_SECTIONS`. Com o contrato como pacote o dado voltou
 * para junto da lista que o origina: quem importa `@rv/contrato` recebe os três
 * (`DEFAULT_HOME_SECTIONS`, `DEFAULT_HEADER`, `DEFAULT_FOOTER`) e não há mais
 * como o mesmo bloco existir em dois formatos.
 */
function defaultSection<T extends HomeSection["type"]>(
  type: T
): Extract<HomeSection, { type: T }> {
  const found = DEFAULT_HOME_SECTIONS.find((section) => section.type === type)

  if (!found) {
    throw new Error(`Conteúdo padrão sem bloco "${type}".`)
  }

  return found as Extract<HomeSection, { type: T }>
}

/** Cabeçalho padrão (bloco `nav`) — o layout o usa em todas as rotas. */
export const DEFAULT_HEADER = defaultSection("nav")

/** Rodapé padrão (bloco `footer`) — idem. */
export const DEFAULT_FOOTER = defaultSection("footer")

/**
 * O conteúdo padrão de cada **página** — e por que ele está vazio.
 * -------------------------------------------------------------------------
 * A chave é o `id` da superfície (`PAGE_SURFACES`, no contrato) e o valor é a
 * lista de blocos que "Restaurar padrão" e o `make seed` criam naquela página.
 *
 * **Vazio é o valor deliberado, não um TODO esquecido.** Duas razões:
 *
 *   1. **A copy é do negócio, não do seed.** O que uma página institucional
 *      promete (prazo de troca, política de dados, horário de atendimento) é
 *      compromisso da loja com a cliente, e o seed não pode inventá-lo — é a
 *      mesma regra que fez o padrão da barra de anúncio não prometer frete
 *      grátis (`DEFAULT_HOME_SECTIONS`). Quem escreve a página é o lojista, no
 *      CRM, com o bloco que já existe (`editorial`, `banner`).
 *   2. **A página vazia responde 404, e isso é o estado honesto.** Um endereço
 *      que abre com texto de exemplo é pior do que um endereço que ainda não
 *      existe: o segundo some do índice sozinho, o primeiro anuncia uma página
 *      que a loja não escreveu. É a regra do defeito 4 do doc 14 — vazio em
 *      página é `notFound()`, **nunca** o fallback da vitrine.
 *
 * O que **não** é vazio é o mapa: toda página declarada tem a sua entrada (a
 * guarda de paridade cobra isso). É a entrada que faz `defaultsFor` responder
 * "esta página não tem padrão" em vez de cair no `DEFAULT_HOME_SECTIONS` — o
 * defeito 1 do doc 14, em que clicar em "Restaurar padrão" na aba de `/trocas`
 * criava a vitrine **inteira** dentro da página de trocas (barra de anúncio,
 * cabeçalho, capa e rodapé) e o painel dizia que tinha dado certo.
 *
 * Quando a copy existir, ela entra **aqui** e o botão passa a repor conteúdo
 * real; até então, o que ele repõe é a ausência, que é a verdade.
 */
export const DEFAULT_PAGE_SECTIONS: Record<string, HomeSection[]> = {
  /** `/sobre` — a história da marca: um `editorial` responde pela página. */
  sobre: [],
  /** `/trocas-e-devolucoes` — a política de troca e devolução. */
  "trocas-e-devolucoes": [],
  /** `/privacidade` — a política de privacidade que a LGPD pede. */
  privacidade: [],
  /** `/termos` — os termos de uso. */
  termos: [],
  /** `/contato` — os canais de atendimento (telefone, e-mail, WhatsApp). */
  contato: [],
  /** `/perguntas-frequentes` — hoje texto; o bloco de Q&A é da F2. */
  "perguntas-frequentes": [],
}

