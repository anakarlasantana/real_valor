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
   */
  {
    id: "hero",
    type: "hero",
    enabled: true,
    position: 3,
    eyebrow: "Nova coleção",
    headline: "Você não precisa ser rica para se",
    headlineEmphasis: "sentir elegante.",
    subtitle: "Alfaiataria para todas.",
    ctaLabel: "Conheça a coleção",
    ctaHref: "/store",
    imageUrl: "/brand/hero.jpg",
    imageAlt: "Alfaiataria feminina Real Valor",
    overlay: 0.72,
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
    items: [
      {
        icon: "quality",
        title: "Qualidade",
        subtitle: "que você sente",
      },
      {
        icon: "price",
        title: "Preços acessíveis",
        subtitle: "para a sua realidade",
      },
      {
        icon: "sizes",
        title: "Do PP ao GG",
        subtitle: "sem limitações",
      },
      {
        icon: "delivery",
        title: "Entrega segura",
        subtitle: "Para todo o Brasil",
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
  {
    id: "featured",
    type: "featured",
    enabled: true,
    position: 7,
    eyebrow: "Shop",
    title: "Peças em destaque",
    subtitle:
      "Uma vitrine editorial com navegação simples, foco no produto e preço sempre visível.",
    viewAllLabel: "Ver todos os produtos",
  },
  {
    id: "editorial",
    type: "editorial",
    enabled: true,
    position: 8,
    script: "Vista o seu valor.",
    title: "A alfaiataria que valoriza você, não o seu status.",
    body: "A REAL VALOR acredita que elegância não é privilégio. É um direito. Criamos peças de alfaiataria feminina com estética sofisticada e preço acessível, para que mais mulheres possam se sentir bem vestidas na vida real.",
    ctaLabel: "Conheça a nossa história",
    ctaHref: "/store",
    imageUrl: "/brand/story-1.jpg",
    imageAlt: "Detalhes de alfaiataria Real Valor",
    imagePosition: "left",
  },
  {
    id: "instagram",
    type: "instagram",
    enabled: true,
    position: 9,
    handle: "@realvalor",
    title: "Mais que roupas, é sobre você.",
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
  /**
   * Rodapé. Como o `nav`, não é uma seção da home: o layout o renderiza
   * em todas as rotas. A casa dele é **10** — a última da numeração da home —,
   * e é ela que fecha a faixa: as seções ordenáveis ocupam as casas livres do
   * meio (5 a 9) e nunca nascem na 10 (`FIXED_SECTION_POSITIONS`, no contrato).
   *
   * O fallback do storefront (`DEFAULT_FOOTER`) é derivado deste bloco pelo
   * gerador — não há segunda cópia.
   *
   * `columns` nasce vazia de propósito: coluna é conteúdo, não existe
   * coluna padrão, e o lojista insere quantas quiser no admin — digitando
   * os links ou apontando a coluna para o catálogo (`source`).
   */
  {
    id: "footer",
    type: "footer",
    enabled: true,
    position: 10,
    columns: [],
    social: [
      {
        icon: "instagram",
        label: "Instagram",
        href: "https://instagram.com/realvalor",
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

