import type { HomeSection } from "./contract"

/**
 * Conteúdo padrão da home — a cópia exata do protótipo.
 *
 * Usado por dois caminhos:
 *   1. `scripts/seed-content.ts` popula o banco com isto na primeira vez.
 *   2. O frontend usa como fallback se a API de conteúdo falhar, para
 *      que a vitrine nunca caia por causa do CMS.
 *
 * Imagens apontam para `/brand/*.jpg` (servidas pelo Next, em
 * `frontend/public/brand`) porque o `data` do CMS guarda URLs como o
 * navegador as consome. Trocar por fotografia definitiva é só editar
 * o campo no admin.
 */
export const DEFAULT_HOME_SECTIONS: HomeSection[] = [
  /**
   * Cabeçalho. Não é uma seção da home — o layout o renderiza em todas
   * as rotas —, mas é conteúdo como qualquer outro, então mora aqui e
   * ganha um bloco no seed. `position` 5 só serve para manter a lista
   * ordenada; ele é ignorado no render da home.
   *
   * Espelhado em `frontend/src/lib/content/home-sections.ts`
   * (`DEFAULT_HEADER`) — os dois são fallback um do outro.
   */
  {
    id: "nav",
    type: "nav",
    enabled: true,
    position: 5,
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
  {
    id: "announcement",
    type: "announcement",
    enabled: true,
    position: 10,
    text: "Frete seguro para todo o Brasil · Até 6x sem juros",
  },
  {
    id: "hero",
    type: "hero",
    enabled: true,
    position: 20,
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
  {
    id: "benefits",
    type: "benefits",
    enabled: true,
    position: 30,
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
    id: "collections",
    type: "collections",
    enabled: true,
    position: 40,
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
    position: 50,
    eyebrow: "Shop",
    title: "Peças em destaque",
    subtitle:
      "Uma vitrine editorial com navegação simples, foco no produto e preço sempre visível.",
    filters: ["Todos", "Blazers", "Conjuntos", "Calças"],
    viewAllLabel: "Ver todos os produtos",
  },
  {
    id: "editorial",
    type: "editorial",
    enabled: true,
    position: 60,
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
    position: 70,
    handle: "@realvalor",
    title: "Mais que roupas, é sobre você.",
    images: [
      { imageUrl: "/brand/story-1.jpg", imageAlt: "Real Valor no Instagram" },
      { imageUrl: "/brand/story-2.jpg", imageAlt: "Real Valor no Instagram" },
      { imageUrl: "/brand/collection-1.jpg", imageAlt: "Real Valor no Instagram" },
      { imageUrl: "/brand/collection-2.jpg", imageAlt: "Real Valor no Instagram" },
    ],
  },
]
