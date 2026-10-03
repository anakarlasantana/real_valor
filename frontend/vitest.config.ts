import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

/**
 * O alias `@lib` vem do `tsconfig.json` (é como o storefront importa o
 * conteúdo), e o vitest não lê `tsconfig` para resolver caminho — sem repetir
 * aqui, o teste não acha o módulo e falha no import.
 *
 * Só isso: nenhuma configuração de ambiente especial, porque o que se testa
 * aqui é função pura (a tolerância da loja ao tipo desconhecido), e puxar o SDK
 * da Medusa para o teste seria peso sem retorno.
 */
export default defineConfig({
  /**
   * JSX nos testes.
   *
   * O `tsconfig.json` usa `"jsx": "preserve"` (o padrão do Next, que deixa o
   * SWC tratar). O vite 8 transforma com **oxc**, não com esbuild — e a opção
   * `esbuild` é IGNORADA (o próprio vite avisa). Sem isto, o adapter do Stripe
   * (`.tsx`, importado pelo registry) chega ao oxc como JSX cru e morre com
   * `Failed to parse source for import analysis`.
   *
   * Só apareceu quando um teste passou a importar um `.tsx`; os anteriores eram
   * todos função pura em `.ts`.
   *
   * `runtime: "automatic"` = o runtime do React 19, sem `import React`.
   */
  oxc: {
    jsx: { runtime: "automatic" },
  },
  resolve: {
    // **A ordem importa.** O Vite resolve o alias por PREFIXO: com
    // `@rv/contrato` antes de `@rv/contrato/payment`, o import do subpath vira
    // `…/src/index.ts/payment` e o teste morre com
    // `ENOTDIR: not a directory`. O mais específico vem PRIMEIRO.
    alias: {
      "@rv/contrato/payment": resolve(
        __dirname,
        "../packages/contrato/src/payment.ts"
      ),
      "@rv/contrato": resolve(__dirname, "../packages/contrato/src/index.ts"),
      "@lib": resolve(__dirname, "src/lib"),
      // O `@modules` entra aqui pelo mesmo motivo do `@rv/contrato/payment`:
      // o adapter do Stripe é um componente e importa o skeleton e o container
      // por esse apelido. Sem esta linha o teste morre em `Cannot find
      // package '@modules/...'` — que é onde ele morreu da primeira vez.
      "@modules": resolve(__dirname, "src/modules"),
      // `server-only` lança de propósito fora do servidor. No teste unitário
      // não há essa separação (o registry é cliente e puxa o adapter, que
      // chama `placeOrder`), então ele vira um módulo vazio. Ver o stub.
      "server-only": resolve(__dirname, "vitest.server-only-stub.ts"),
    },
  },
})
