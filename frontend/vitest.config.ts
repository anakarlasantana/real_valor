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
  resolve: {
    alias: {
      "@lib": resolve(__dirname, "src/lib"),
      // O pacote do contrato é um workspace: sem este alias o vitest não
      // resolve `@rv/contrato/payment` (o subpath), e o teste do registry
      // falha no import antes de exercitar qualquer comportamento.
      "@rv/contrato": resolve(__dirname, "../packages/contrato/src/index.ts"),
      "@rv/contrato/payment": resolve(
        __dirname,
        "../packages/contrato/src/payment.ts"
      ),
    },
  },
})
