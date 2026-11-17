# Desenho — RV-006 (frete plugável)

## Onde vive

| Camada | Arquivo | Papel |
| :--- | :--- | :--- |
| contrato do Medusa | `@medusajs/utils` → `AbstractFulfillmentProviderService` | a abstração já existe; não criamos uma paralela |
| provider (tabela) | `backend/src/modules/fulfillment/tabela/*` | preço por região/faixa, sem rede |
| provider (SuperFrete) | `backend/src/modules/fulfillment/superfrete/*` | cota, etiqueta, rastreio |
| volumes | `backend/src/modules/fulfillment/pacotes/volumes.ts` | item → caixa → peso taxável |
| dinheiro | `backend/src/modules/fulfillment/dinheiro.ts` | centavos ↔ decimal do Medusa |
| registro | `backend/medusa-config.ts` (`ModuleProvider`) | é o que faz a opção existir |
| storefront | `frontend/src/lib/checkout/delivery-availability.ts` | `null` ≠ `[]`: indisponível ≠ sem opções |
| storefront | `frontend/src/lib/data/fulfillment.ts` | consome `/store/shipping-options` (`no-store`) |

## Fronteira

- Nada de registry de frete no storefront: o checkout só consome
  `StoreCartShippingOption`, que é uniforme por definição.
- `frontend/src` não importa `modules` (R-A); o tipo caminha com o dono.
- Nenhum adapter de transportadora é importado fora de `lib/payments`-like
  fachada — aqui nem existe fachada porque não há decisão no cliente.

## Riscos anotados

- **Caixa única** por volume: pedido grande vira N volumes (o peso taxável soma).
- **CEP de origem** vem do local de estoque; local duplicado dobra estoque e
  muda a cotação (foi o `seed-limpar`).
- **Cache L2**: cotação sem Redis funciona, só perde cache.

## Aprovação retroativa

Este requisito já estava entregue e testado antes da esteira existir. A
aprovação foi registrada em 18/11/2026 como **piloto do mecanismo** (hash dos
critérios + identidade); a partir da fase C ela é interativa (TTY obrigatório) e
nenhum agente consegue assinar.
