/// <reference types="vite/client" />

/**
 * O endereço ABSOLUTO do backend, injetado no bundle pelo Vite do painel.
 * -------------------------------------------------------------------------
 * Quem define esta constante é o bundler do admin
 * (`define.__BACKEND_URL__`, em `getViteConfig` de `@medusajs/admin-bundler`), a
 * partir do `admin.backendUrl` do `backend/medusa-config.ts` — que lê
 * `MEDUSA_BACKEND_URL`. É por isso que o `make tunnel` reescreve essa variável
 * para `https://<endereço>/painel-api` enquanto o painel está publicado:
 * trocar o valor troca a base de TODA chamada que o painel faz (ver
 * `docs/real-valor/11-ambiente-local.md` §11.6.2).
 *
 * A declaração existe para o `tsc` do painel: sem ela, a leitura da constante em
 * `src/admin/lib/api-url.ts` seria `TS2304: Cannot find name '__BACKEND_URL__'`.
 * O tipo é o mesmo do `vite-env.d.ts` do dashboard instalado
 * (`declare const __BACKEND_URL__: string | undefined`) — é a MESMA constante, e
 * é ela que o SDK do dashboard usa como `baseUrl` das chamadas dele.
 *
 * `string | undefined` e não `string`: fora do bundle — o jest do CRM, que roda
 * em `node` — a constante não é definida, e quem a lê precisa tratar isso.
 */
declare const __BACKEND_URL__: string | undefined