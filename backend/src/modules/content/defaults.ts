import type { HomeSection } from "./contract"

/**
 * Conteúdo padrão da home — a cópia exata do protótipo.
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
 * Nos três casos este arquivo é a única cópia: o fallback do storefront é
 * este mesmo dado, gerado para `contract.generated.ts` por
 * `scripts/gen-content.mjs`.
 *
 * Imagem aponta para `/brand/*.jpg` (servida pelo Next, em
 * `frontend/public/brand`) enquanto for a foto do protótipo. Depois do primeiro
 * envio pelo CRM o valor gravado é a **chave** do arquivo
 * (`1699999999-hero.jpg`): quem traduz chave → endereço é o `resolveMediaUrl`
 * do storefront (`frontend/src/lib/util/media.ts`), e por isso os dois formatos
 * convivem sem migração.
 */
export const DEFAULT_HOME_SECTIONS: HomeSection[] = [
  /**
   * Cabeçalho. Não é uma seção da home — o layout o renderiza em todas
   * as rotas —, mas é conteúdo como qualquer outro, então mora aqui e
   * ganha um bloco no seed. `position` 5 só serve para manter a lista
   * ordenada; ele é ignorado no render da home.
   *
   * O fallback do storefront (`DEFAULT_HEADER`) é derivado deste bloco pelo
   * gerador — não há segunda cópia.
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
   * em todas as rotas, então `position` 80 só mantém a lista ordenada.
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
    position: 80,
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
