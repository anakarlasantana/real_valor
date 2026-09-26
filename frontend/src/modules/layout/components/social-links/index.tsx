import { type FooterSocial } from "@lib/content/home-sections"
import { resolveSocialIcon } from "@lib/content/social-icons"
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
 */

/** Protocolos que saem da loja e nunca levam o país — mesma regra (e
 *  mesmo motivo) do `nav-link`. */
const EXTERNAL_PROTOCOL = /^(https?:|mailto:|tel:)/i

const LINK_CLASSES =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-rv-border text-rv-grafite transition-colors hover:border-rv-rose hover:text-rv-rose focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rv-rose"

export default function SocialLinks({ items }: { items: FooterSocial[] }) {
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
          className: LINK_CLASSES,
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
