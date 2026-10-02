# 03 — Análise GAP

Comparativo entre o estado atual (verificado no código) e o estado desejado para uma loja de moda
feminina que venda de verdade.

**Prioridades** (seção 4 do briefing): **CRÍTICA** (para vender) · **ALTA** (experiência
profissional) · **MÉDIA** (melhoria importante) · **BAIXA** (melhoria futura).

---

## 3.1 Tabela principal

| Área | Situação atual | Situação desejada | Gap | Ação necessária | Prioridade |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pagamento** | Nenhum provedor registrado em `medusa-config.ts`; região com `pp_system_default` | Pix, cartão parcelado e boleto via Mercado Pago, com webhook | **Total** | Registrar provedor + camada de abstração + webhook | **CRÍTICA** |
| **Checkout — idioma** | "Checkout", rótulos em inglês | 100% pt-BR | Grande | Traduzir `modules/checkout` | **CRÍTICA** |
| **PDP — CTA** | "Add to cart" / "Out of stock" / "Select variant" | "Comprar" / "Esgotado" / "Selecione o tamanho" | Grande | Traduzir `product-actions` | **CRÍTICA** |
| **Idioma (catálogo)** | "Sort by", "Latest Arrivals", "Price: Low -> High" | Rótulos pt-BR | Média | Traduzir `sort-products` | **ALTA** |
| **Idioma (conta)** | "Sign in", "Orders", "Addresses", "Profile" | Rótulos pt-BR | Média | Traduzir `modules/account` + metadados | **ALTA** |
| **Busca** | Não existe | Busca com sugestões na home e página de resultados | **Total** | Criar componente + rota | **ALTA** |
| **Filtros** | Só ordenação (3 critérios) | Cor, tamanho, preço, disponibilidade — com contagem | **Total** | Implementar facetas em `refinement-list` | **ALTA** |
| **SEO — títulos** | `` `${title} | Medusa Store` `` vaza em produto, categoria e coleção | `%s | Real Valor` + descrição real | Média | Corrigir 3 `generateMetadata` | **ALTA** |
| **SEO — cobertura** | Sem sitemap, sem robots, sem JSON-LD | Sitemap dinâmico + robots + Product/Offer schema | **Total** | Criar `sitemap.ts`, `robots.ts`, JSON-LD na PDP | **ALTA** |
| **Frete — transportadora** | Opções manuais seedadas | Cálculo por transportadora (a definir) | **Total** | `ShippingAdapter` + registry; plugar o escolhido | **ALTA** |
| **PDP — parcelamento** | Não exibido | "6x de R$ X sem juros" e preço Pix | **Total** | Consumir a camada de pagamento | **ALTA** |
| **PDP — guia de medidas** | Não existe | Link ao lado do seletor de tamanho | **Total** | Modelar dado + criar página | **ALTA** |
| **Home — vitrines** | 10 tipos de seção; `featured` com chips de categoria | Completa e editável | **Nenhum** | — | — |
| **Header / Footer** | Conteúdo via CMS; drawer mobile | Completo | **Nenhum** | — | — |
| **Carrinho** | Itens, quantidade, cupom, frete, mismatch banner, nudge | Completo | **Nenhum** | — | — |
| **CMS** | Duas superfícies, upload, paleta, fontes, ordem | Completo | **Nenhum** | — | — |
| **Tema sazonal** | Swap por CSS vars, 4 temas | Completo | **Nenhum** | — | — |
| **PDP — galeria** | Galeria + thumbnails + hover | Completa | Pequeno | Indicador de zoom no desktop | **MÉDIA** |
| **PDP — desconto** | Preço riscado, sem % | Badge "-20%" | Pequeno | Usar `get-percentage-diff` no card | **MÉDIA** |
| **Card — tamanhos** | Não mostra | Chips de tamanho quando houver variantes | Pequeno | Adicionar ao `product-preview` | **MÉDIA** |
| **PDP — frete** | Só no carrinho | Calculadora de CEP na PDP | Média | Campo de CEP na PDP | **MÉDIA** |
| **Relacionados** | Componente existe | Ordenação por complementaridade | Pequeno | Ajustar critério | **MÉDIA** |
| **Acessibilidade** | Contraste documentado; foco definido | AA completo, teclado em todos os controles | Média | Auditoria de foco e rótulos | **MÉDIA** |
| **Newsletter** | Não existe na home | Captura de e-mail | Média | Bloco no rodapé (CMS) | **MÉDIA** |
| **Pagamento → pedido** | `workflows/` não existe; nenhum pedido é criado | Pagamento aprovado gera pedido com estoque reservado | **Total** | Criar workflow + subscriber (RV-042) | **CRÍTICA** |
| **Registro de envio** | Ninguém grava `tracking_number`/`carrier` | Admin registra o código de rastreio | **Total** | Campo no Admin (RV-043) | **ALTA** |
| **Rastreio (tela)** | Rota existe; **não há página** | Página pública sem login | **Total** | Tela `/rastreio` (RV-044) | **ALTA** |
| **Aviso de envio** | Não existe | Cliente recebe o código por e-mail | **Total** | Subscriber de notificação (RV-045) | **MÉDIA** |
| **Documentação** | `docs/` vazio; README cita 6 arquivos | Documentação viva e referenciada | **Total** | Este conjunto + corrigir README | **MÉDIA** |
| **Conta — senha** | `toast.info("Password update is not implemented")` | Troca de senha funcional | Pequena | Implementar ou remover a promessa | **BAIXA** |
| **Armazenamento** | Local + volume Docker | S3 + CDN | Médio | Trocar provider (sem migração de conteúdo) | **BAIXA** |
| **Produtos vistos** | Não existe | "Vistos recentemente" | Médio | `localStorage` + componente | **BAIXA** |
| **Lista de desejos** | Não existe | Wishlist | Médio | Módulo + rota | **BAIXA** |
| **Chat / atendimento** | Não existe | WhatsApp integrado | Baixo | Link no rodapé | **BAIXA** |

## 3.2 Leitura da tabela

**Três frentes, três naturezas diferentes:**

1. **Venda** — Pagamento é o único item **CRÍTICA** que não é cosmético. Enquanto o provedor não
   existir, nenhum outro item desta lista gera receita. As outras duas CRÍTICA (idioma no checkout e
   na PDP) estão no mesmo caminho: são os últimos 200px antes do pagamento.

2. **Descoberta** — Busca e filtros juntos separam "a cliente chegou por anúncio" de "a cliente
   navegou e comparou". Sem eles, o catálogo é bonito e inacessível por critério.

3. **Produção** — SEO técnico, acessibilidade e armazenamento transformam "funciona" em "pronto".
   Nenhum bloqueia venda; todos custam tráfego e confiança.

**O que já está pronto merece ser dito:** Home, Header, Footer, Carrinho, CMS e Tema sazonal estão
com **gap zero** nesta tabela. É a parte que a maioria dos projetos de e-commerce não tem — e ela já
foi feita.

---

## 3.3 Risco de cronograma

**Sequência obrigatória:** Pagamento (CRÍTICA) → Idioma (CRÍTICA) → Filtros/Busca (ALTA).

A ordem importa porque o idioma e a PDP de pagamento tocam **os mesmos arquivos** que a camada de
pagamento vai consumir. Traduzir **antes** de construir o registry evita traduzir duas vezes os
mesmos rótulos.

**O risco que este projeto corre:** a camada de abstração compete por prazo com a vitrine, e **não há
rede de segurança entre o registry e o Mercado Pago**.

**Um stop-gap com Stripe foi considerado e descartado.** Três motivos verificados:

1. O Stripe não atende o parcelamento da forma necessária para o mercado brasileiro.
2. O código dele é **tokenização de cartão**, e o MP é **redirecionamento** — configurar o Stripe não
   antecipa nada do MP.
3. O custo não é "poucas linhas": `@medusajs/payment-stripe` não está declarado no
   `backend/package.json`, e faltariam credencial, migration e teste de compra real.

**Consequência aceita:** se o Mercado Pago estourar o prazo, **a loja não vende**. A ordem foi
definida para reduzir esse risco — o RV-003 (idioma) e o RV-017 (tokens) são feitos antes, porque são
independentes do MP e podem ocupar o tempo enquanto ele se develops; e o registry (RV-001) é pequeno,
então o caminho entre ele e o MP é curto.

**Se o prazo apertar de verdade**, as saídas possíveis são, em ordem de qualidade:
1. Pix por link manual gerado fora do site (vende, mas perde o carrinho)
2. Antecipar o MP e cortar escopo de vitrine

O registro detalhado do cancelamento está no backlog, item RV-015.

---

## 3.4 Itens que exigem decisão antes de implementar

Registrados como pergunta, não como suposição:

| Questão | Bloqueia | Quem decide |
| :--- | :--- | :--- |
| Qual modalidade do Mercado Pago? (Point, Pro, Advanced) | Parcelamento e split | Comercial |
| Provedor de frete definitivo | `ShippingAdapter` real | Comercial |
| Tabela de medidas: `metadata` ou módulo novo? | Guia de medidas | Arquitetura |
| Quantidade de imagens por produto | Layout da galeria | Comercial |
| Catálogo real: tamanho e número de categorias | Facetas de filtro, paginação | Comercial |
| Configuração fiscal / emissão de NF | Produção | Fiscal |
| Brand guide definitivo: logo vetorial e TOM da marca | Wordmark e tipografia | Marca |

As duas últimas já têm indicativos no código (comentário do logo vetorial; tokens derivados de um
brand guide), mas **não foram confirmadas** nesta auditoria.

Ver `04-requisitos-funcionais.md` para o detalhe de cada requisito.