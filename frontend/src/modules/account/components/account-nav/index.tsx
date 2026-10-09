"use client"

import { ArrowRightOnRectangle } from "@medusajs/icons"
import { clx } from "@medusajs/ui"
import { useParams, usePathname } from "next/navigation"

import { signout } from "@lib/data/customer"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * A navegação da conta — quatro destinos e a saída.
 *
 * Ela dizia "Account", "Overview", "Profile", "Addresses" e "Orders": metade em
 * inglês numa loja pt-BR, e em **duas versões distintas** (a lista do desktop e o
 * bloco do celular), cada uma com o seu desenho e os seus ícones. Agora é uma
 * lista só, com os destinos em português, que se deita na horizontal abaixo de
 * 1024px (`.rv-account-nav`, no `brand.css`) — a versão de celular é a mesma
 * lista, e não uma segunda tela para manter.
 *
 * Os ícones saíram porque repetiam o rótulo escrito ao lado, e os `data-testid`
 * continuam os mesmos (`overview-link`, `profile-link`, `addresses-link`,
 * `orders-link`, `logout-button`): são o contrato dos testes de ponta a ponta.
 *
 * O "Sair" é botão, e não link, porque ele **faz** algo (encerra a sessão no
 * servidor) em vez de levar a algum lugar.
 */
const DESTINOS = [
  { href: "/account", label: "Visão geral", testId: "overview-link" },
  { href: "/account/profile", label: "Perfil", testId: "profile-link" },
  { href: "/account/addresses", label: "Endereços", testId: "addresses-link" },
  { href: "/account/orders", label: "Pedidos", testId: "orders-link" },
] as const

const AccountNav = ({
  customer,
}: {
  customer: HttpTypes.StoreCustomer | null
}) => {
  const route = usePathname()
  const { countryCode } = useParams() as { countryCode: string }

  const handleLogout = async () => {
    await signout(countryCode)
  }

  const atual = route.split(countryCode)[1]

  return (
    <div className="flex flex-col gap-y-4">
      {/* O nome de quem está do outro lado. Fica fora da lista porque não é um
          destino, e some no celular, onde a lista é uma linha só. */}
      <p className="hidden text-sm text-rv-muted small:block">
        Olá{customer?.first_name ? `, ${customer.first_name}` : ""}
      </p>

      <nav
        className="rv-account-nav"
        aria-label="Minha conta"
        data-testid="account-nav"
      >
        {DESTINOS.map((destino) => (
          <LocalizedClientLink
            key={destino.href}
            href={destino.href}
            className={clx("rv-btn rv-btn-text", {
              active: atual === destino.href,
            })}
            aria-current={atual === destino.href ? "page" : undefined}
            data-testid={destino.testId}
          >
            {destino.label}
          </LocalizedClientLink>
        ))}

        <button
          type="button"
          onClick={handleLogout}
          className="rv-btn rv-btn-text"
          data-testid="logout-button"
        >
          <ArrowRightOnRectangle aria-hidden="true" focusable="false" />
          Sair
        </button>
      </nav>
    </div>
  )
}

export default AccountNav
