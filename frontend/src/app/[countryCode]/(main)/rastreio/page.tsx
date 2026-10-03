import type { Metadata } from "next"

import RastreioTemplate from "@modules/tracking/templates"

/**
 * /rastreio — a consulta pública de pedido.
 * -------------------------------------------------------------------------
 * Rota da tela do RV-044. O nome é em português, como as outras rotas da loja
 * (`/carrinho`, `/checkout`, `/conta`), e não `/track` como a API: a URL é o que
 * a cliente digita e o que ela recebe por e-mail.
 *
 * Esta página é um server component que **não busca nada**: ela só entrega o
 * formulário. A consulta acontece quando a cliente aperta "Consultar", no
 * navegador, e é por isso que o CPF nunca entra na URL — se a busca fosse feita
 * aqui, o CPF iria para o `searchParams`, para o log do servidor e para o
 * histórico do navegador.
 *
 * Por isso a página não declara `generateMetadata` dinâmico: o título é fixo e
 * vale para todas as consultas, e nenhuma consulta acontece no servidor.
 */
export const metadata: Metadata = {
  title: "Rastrear pedido",
  description: "Acompanhe o envio do seu pedido pelo número e documento da compra.",
}

export default function RastreioPage() {
  return <RastreioTemplate />
}
