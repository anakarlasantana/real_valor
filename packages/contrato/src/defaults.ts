import {
  ANNOUNCEMENT_SPEED_DEFAULT,
  INSTAGRAM_SPEED_DEFAULT,
  type HomeSection,
} from "./contract.ts"

/**
 * Conteúdo padrão da home — a cópia do protótipo, com a exceção marcada na
 * própria seção: `lancamentos`, que não existe nele. Usado pelo seed, pelo
 * "Restaurar padrão" do CRM e pelo fallback do frontend quando a API falha.
 * A imagem aponta `/brand/*.jpg` ou a chave do arquivo (`resolveMediaUrl`).
 */
export const DEFAULT_HOME_SECTIONS: HomeSection[] = [
  {
    id: "announcement",
    type: "announcement",
    enabled: true,
    position: 1,
    /** A mensagem única (o que a barra mostra sem ticker) e o ticker com a
     * **mesma informação** em duas mensagens. Nada de copy nova no padrão. */
    text: "Frete seguro para todo o Brasil · Até 6x sem juros",
    messages: ["Frete seguro para todo o Brasil", "Até 6x sem juros"],
    speedSeconds: ANNOUNCEMENT_SPEED_DEFAULT,
  },
  /** Cabeçalho: não é seção da home (o layout o renderiza em todas as rotas),
   * mas é conteúdo e mora aqui — casa **2**, e `DEFAULT_HEADER` deriva daqui. */
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
  /** A capa: a **abertura da home**, desenhada pela vitrine mas fora da ordem
   * das setas (casa 3, com os benefícios). Nasce com **um** slide — a capa
   * estática —, e sem slide nenhum não há capa. */
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
    /** A nota da capa: a linha do canto sobre a foto, **da faixa** — no
     * carrossel ela não troca junto com a foto. */
    note: "Peças que acompanham quem você é — e quem está se tornando.",
  },
  /** A faixa de benefícios. Fecha a **abertura da home** (casa 4) e nasce fixa,
   * como a capa: o que o lojista ordena pelas setas começa depois dela. */
  {
    id: "benefits",
    type: "benefits",
    enabled: true,
    position: 4,
    /** Os **três** itens do protótipo (a faixa nasceu com quatro). A cópia é a
     * dele e é promessa comercial: quem confere se a loja cumpre é o lojista.
     * As chaves de ícone são as que o registro do storefront já tem. */
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
    // Cópia escrita AQUI: o protótipo não tem esta seção.
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
  /** A seção "Sobre" (o manifesto). Casa **7**: o protótipo põe o manifesto
   * logo antes da faixa editorial. */
  {
    id: "editorial",
    type: "editorial",
    enabled: true,
    position: 7,
    script: "Vista o seu valor.",
    /** O eyebrow e o realce do título (o título em duas vozes, como no
     * protótipo). A cópia do título é a da marca: quem a troca é o lojista. */
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
  /** A faixa editorial (`banner`): a última do protótipo — foto inteira, eyebrow,
   * título em duas linhas e botão. Casa **8**, logo depois do manifesto. */
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
  /** Rodapé: como o `nav`, aparece em todas as rotas (quem desenha é o layout) e
   * a casa dele é **10** — a renumeração a pula. `DEFAULT_FOOTER` deriva daqui.
   *
   * ⚠️ **A régua de publicação: um link só vai ao ar quando o destino responde
   * 200.** Os seis links de página respondem **404 enquanto a página estiver
   * vazia**, então ativar as colunas sem a copy trocaria "o link não existe" por
   * "o link está quebrado" — o padrão é o molde de lançamento. */
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
  /** O Instagram: a **sexta seção ordenável**, que nasce na casa **11** (a 10 é
   * do rodapé), e por isso é o último bloco do arquivo. */
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
    /** A faixa **rola** já no padrão: quatro fotos no ritmo comum do
     * `INSTAGRAM_SPEED_DEFAULT`, que é por imagem, como no ticker da barra. */
    secondsPerImage: INSTAGRAM_SPEED_DEFAULT,
  },
]
/** As categorias que o padrão liga aos chips da vitrine — **handles**, e não
 * ids (o id é criado pelo seed a cada base); quem resolve é `defaultFilterIds`
 * (`modules/content/filters.ts`). Não mora na seção do padrão porque o chip é
 * referência — a cópia ("Blazers") devolvia zero peças em silêncio. */
export const DEFAULT_FEATURED_FILTERS = [
  "vestidos",
  "blusas-camisas",
  "calcas-alfaiataria",
  "conjuntos",
] as const



/**
 * O `data` de uma seção NOVA, por tipo — o que a rota admin usa quando o lojista
 * cria uma seção pelo CRM. Derivado de `DEFAULT_HOME_SECTIONS` porque é o
 * **mesmo** conteúdo; ficam de fora `id`, `enabled` e `position`, que a rota
 * decide. `prose` e `faq` vêm da tabela ao lado (só existem em página), e o
 * `defaults.unit.spec.ts` cobra uma entrada por tipo de `SECTION_TYPES`.
 */
const DEFAULT_PAGE_SECTION_DATA: Record<string, Record<string, unknown>> = {
  prose: {
    // Em branco: a página já se chama pelo `label` da superfície no `pageSeo`.
    title: "",
    blocks: [{ kind: "paragraph", text: "", items: [] }],
    // Sem anexo e sem rótulo: o botão de baixar só existe quando há arquivo.
    documentUrl: "",
    documentLabel: "",
  },
  faq: {
    // Como o `prose`: sem título e com **um** item em branco, pronto para escrever.
    title: "",
    items: [{ question: "", answer: "" }],
  },
}

export const DEFAULT_SECTION_DATA: Record<string, Record<string, unknown>> = {
  ...Object.fromEntries(
    DEFAULT_HOME_SECTIONS.map(
      ({ id: _id, enabled: _enabled, position: _position, type, ...data }) => [
        type,
        data,
      ]
    )
  ),
  ...DEFAULT_PAGE_SECTION_DATA,
}
/** A primeira seção de um tipo no conteúdo padrão — o cromo (`nav`/`footer`).
 * Com o contrato como pacote, o storefront importa os três daqui. */
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
 * O conteúdo padrão de cada **página** — e por que ele está vazio. **Vazio é
 * deliberado:** a copy de uma página institucional é compromisso da loja com a
 * cliente, e a página vazia responde 404, que é o estado honesto. O que **não**
 * é vazio é o mapa (uma entrada por página, cobrado pela paridade): é ele que
 * faz `defaultsFor` dizer "esta página não tem padrão", em vez de o "Restaurar
 * padrão" de `/trocas` criar a vitrine inteira (defeito 1 do doc 14).
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

