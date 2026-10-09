import { type FooterSocial } from "@lib/content/home-sections"
import { resolveSocialIcon } from "@lib/content/social-icons"
import { clx } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Fileira de ícones sociais do rodapé.
 *
 * Componente de servidor: não tem estado nem gancho nenhum, só um link
 * por ícone — diferente do `nav-link`, que é client porque precisa
 * interceptar âncoras para rolar suave. Os destinos seguem o mesmo
 * contrato do menu: `https:`, `mailto:` e `tel:` saem da loja por um
 * `<a>` (os externos em nova aba) e o resto é rota interna, com o país
 * prefixado pelo `LocalizedClientLink`.
 *
 * O ícone é a chave guardada no CMS (`SOCIAL_ICON_KEYS`, em
 * `lib/content/social-icons.tsx`); uma chave desconhecida cai no globo. O
 * nome acessível vem do rótulo, porque o glifo não tem texto visível.
 *
 * A fileira veste o fundo em que está (`tone`), pelo mesmo motivo do
 * `footer-column`: `brand.css` perde para os utilitários, então a cor de
 * cada fundo tem de ser escolha de quem monta. O realce do hover é o rosa
 * da casa nos dois — sobre o preto ele dá 5,2:1 e passa no AA.
 */

/** Protocolos que saem da loja e nunca levam o país — mesma regra (e
 *  mesmo motivo) do `nav-link`. */
const EXTERNAL_PROTOCOL = /^(https?:|mailto:|tel:)/i

/**
 * A pastilha: 36px de alvo, borda de 1px, transição só de cor.
 *
 * O anel de foco **não** é escrito aqui de propósito. Esta linha tinha um
 * `focus-visible:outline-none` acompanhado de um anel próprio, e isso
 * desligava o anel que o fim de `brand.css` garante a todo elemento
 * focável da loja — a regra de lá é explícita: nenhum componente escreve
 * `outline: none`. O anel da casa (`--rv-focus-ring`, o rosa escuro) tem
 * 3,7:1 contra o preto, que é o mínimo para um indicador de foco, então
 * ele funciona também no rodapé.
 */
const LINK_CLASSES =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors"

/** A cor da pastilha por fundo. */
const TONE: Record<"light" | "dark", string> = {
  light:
    "border-rv-border text-rv-grafite hover:border-rv-rose hover:text-rv-rose",
  /* No escuro a borda sobe para o token de **campo**, e não para o filete
   * (`--rv-ondark-line`): a pastilha é um controle, não uma separação, e o
   * limite dela precisa ser visível — o mesmo motivo do campo da
   * newsletter. Ver os tokens em `brand.css`. */
  dark: "border-rv-ondark-field text-rv-offwhite hover:border-rv-rose hover:text-rv-rose",
}

export default function SocialLinks({
  items,
  tone = "light",
}: {
  items: FooterSocial[]
  /** O fundo em que a fileira está posta. O rodapé é preto: passa `dark`. */
  tone?: "light" | "dark"
}) {
  // Lista vazia é uma configuração legítima (o lojista apagou tudo): a
  // fileira some, sem deixar o espaço nem o título órfão.
  if (items.length === 0) {
    return null
  }

  return (
    <ul
      className="flex flex-wrap items-center gap-2"
      data-testid="footer-social"
    >
      {items.map((item) => {
        const Icon = resolveSocialIcon(item.icon)
        // Rótulo vazio não pode virar link sem nome acessível: a chave é
        // o segundo melhor nome, e é o que o admin oferece.
        const label = item.label || item.icon

        const shared = {
          className: clx(LINK_CLASSES, TONE[tone]),
          "aria-label": label,
          title: label,
          "data-testid": `footer-social-${item.icon}`,
        }

        const content = (
          <Icon className="h-4 w-4" aria-hidden="true" focusable="false" />
        )

        return (
          <li key={`${item.icon}-${item.href}`}>
            {EXTERNAL_PROTOCOL.test(item.href) ? (
              <a
                {...shared}
                href={item.href}
                {...(/^https?:/i.test(item.href)
                  ? { target: "_blank", rel: "noreferrer noopener" }
                  : {})}
              >
                {content}
              </a>
            ) : (
              <LocalizedClientLink {...shared} href={item.href}>
                {content}
              </LocalizedClientLink>
            )}
          </li>
        )
      })}
    </ul>
  )
}
