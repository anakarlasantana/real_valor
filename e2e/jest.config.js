/**
 * O runner dos testes do instrumento de e2e.
 *
 * `make test` roda os tres pacotes (backend, CRM e storefront), e nenhum deles
 * alcanca `e2e/` — o vitest do storefront esta preso a `frontend/` e o jest do
 * backend so aceita `src/`. Os helpers do instrumento ficavam sem prova unit
 * nenhuma, e foi assim que a senha hardcoded do painel sobreviveu: o teste que
 * a exercita e' de navegador, caro e raro.
 *
 * Este config usa o jest e o `@swc/jest` ja instalados na raiz (install unico).
 */
const path = require("path")

module.exports = {
  rootDir: path.join(__dirname, ".."),
  roots: ["<rootDir>/e2e"],
  testMatch: ["**/e2e/fixtures/__tests__/*.unit.spec.ts"],
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      { jsc: { parser: { syntax: "typescript" }, target: "es2022" } },
    ],
  },
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "js", "json"],
}
