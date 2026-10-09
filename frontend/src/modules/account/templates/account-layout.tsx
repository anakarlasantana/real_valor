import React from "react"

import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import AccountNav from "../components/account-nav"

interface AccountLayoutProps {
  customer: HttpTypes.StoreCustomer | null
  children: React.ReactNode
}

/**
 * A moldura da conta: a navegação à esquerda, o conteúdo à direita e o bloco de
 * atendimento no pé.
 *
 * A caixa era `max-w-5xl` com fundo branco e 240px de coluna — o desenho do
 * starter. Agora é o trilho da loja (`.rv-container`) com a coluna de 220px da
 * referência: a conta é uma página interna como as outras, e não um painel à
 * parte com fundo próprio.
 *
 * O bloco de atendimento ficou (é útil e a promessa é da loja), mas em pt-BR e nas
 * classes da casa — e com o **destino certo**. Ele apontava para
 * `/customer-service`, que não existe nesta loja (um 404 com cara de ajuda), e a
 * primeira correção apontou para `/#contato`, que também não existe: o rodapé não
 * tem seção com esse id. O que existe de verdade é `/rastreio` — a página de
 * rastreio —, e é ela que responde à pergunta que se faz nesta tela.
 */
const AccountLayout: React.FC<AccountLayoutProps> = ({
  customer,
  children,
}) => {
  return (
    <main className="rv-container" data-testid="account-page">
      <div className="rv-account-layout">
        {customer && <AccountNav customer={customer} />}

        <div>{children}</div>
      </div>

      <div className="rv-account-help">
        <div>
          <h2 className="rv-display text-xl mb-3">Precisa de ajuda?</h2>
          <p className="text-sm text-rv-muted">
            Acompanhe a sua encomenda pelo código de rastreio — e, se algo não
            bater, fale com a gente pelos canais do rodapé.
          </p>
        </div>

        <LocalizedClientLink href="/rastreio" className="rv-btn rv-btn-secondary">
          Acompanhar pedido
        </LocalizedClientLink>
      </div>
    </main>
  )
}

export default AccountLayout
