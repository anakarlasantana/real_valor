---
paths:
  - "backend/src/**"
---
# Backend (Medusa v2)

**Módulo e provider se registram em `backend/medusa-config.ts`.** No array
`modules`, módulo usa `Module(...)`; provider (arquivo, frete, pagamento,
notificação) usa `ModuleProvider(...)` dentro de `providers` do módulo dono.
Registrar provider como módulo estoura no `defineConfig`.

**Migration é schema + backfill, nunca dado novo.** Fica em
`src/modules/<módulo>/migrations`. `alter table`/`create index` podem vir
acompanhados de `update` sobre linhas que **já existem** (foi o caso do
`content_section.fixed`). `insert` de conteúdo numa migration é erro: banco novo
em 2027 nasceria com o dado de 2026.

**Dado de loja é seed.** `src/scripts/seed.ts` (orquestrador) → `seed/loja.ts`
(canal, região, frete, caixa, chave) e `seed/conteudo.ts` (vitrine, tema,
contrato). `make seed` é o comando único; é idempotente.

**A publishable key é presa a UM canal.** Com dois, o `/store/products` recusa
calcular inventário e a página de produto responde 500.

**Estoque:** `inventory_quantity` é a soma dos locais. Um local duplicado
(seed antigo) faz a peça aparecer com o dobro — mantenha **um** local.

Rotas customizadas: `src/api/**/route.ts`; middlewares e guards em
`src/api/middlewares.ts` (é lá que vivem o teto do upload e o rate limit).
