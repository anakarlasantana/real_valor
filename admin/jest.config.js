/**
 * O runner do CRM (R2).
 * -------------------------------------------------------------------------
 * Até a R2 o único teste do painel — o do formulário, que decide o que fica
 * "pendente" na tela — rodava no `jest` do backend por um `roots` que apontava
 * para `../admin/src`. Isso é o vizinho declarando o que é teste do painel: o
 * `jest.config.js` do backend precisava saber que `admin/` existe, e um dia em
 * que alguém arrumasse o `roots` (uma limpeza banal) a suíte do CRM sumiria de
 * `make test` **sem dizer nada**.
 *
 * Aqui a direção é a certa: o CRM declara a própria superfície de teste, e o
 * backend não sabe que este teste existe. O que continua vindo do vizinho é só
 * o **binário** e o transformador (`@swc/jest`), porque o CRM não tem
 * `node_modules` próprio — decisão da R7, medida no build: o painel é compilado
 * pelo Vite do backend, então quem instala as dependências dele é o `backend/`.
 * É exatamente o resto que a **G5** (instalação unificada) fecha.
 *
 * Como rodar (é o que o alvo `test` do Makefile chama):
 *   cd admin && ../backend/node_modules/.bin/jest -c jest.config.js
 *
 * O `setupFiles` do backend (`integration-tests/setup.js`, que zera o
 * `MetadataStorage` do MikroORM entre arquivos) NÃO vem para cá de propósito: o
 * teste do painel é de função pura — `fingerprint`, `isDirty` e `wireValue` não
 * tocam banco, ORM nem rede. Sem estado global compartilhado, nada aqui precisa
 * de `--runInBand`/`--forceExit` (os dois que o `make test` passa ao jest do
 * backend justamente por causa do `MetadataStorage`).
 */
const { join } = require("node:path")

// Onde o binário e o transformador moram, do ponto de vista do painel. O `paths`
// do `admin/tsconfig.json` aponta para cá pelo mesmo motivo: o CRM não tem
// instalação própria.
const BACKEND_MODULES = join(__dirname, "..", "backend", "node_modules")

module.exports = {
  rootDir: __dirname,
  testEnvironment: "node",

  /* Onde um teste do painel pode estar: `__tests__/` de qualquer pasta de
   * `src/`, com o mesmo sufixo de unidade que o backend usa (`.unit.spec`).
   * A extensão inclui `tsx` porque o CRM é React: o dia de um teste de
   * componente é um arquivo a mais aqui, não uma configuração nova. */
  testMatch: ["<rootDir>/src/**/__tests__/**/*.unit.spec.[jt]s?(x)"],

  /* O transformador do backend, resolvido pelo caminho absoluto dele: o jest
   * resolve o transform relativo ao `rootDir`, que aqui é `admin/` — sem
   * `require.resolve(..., { paths })` o `@swc/jest` seria procurado subindo a
   * partir de `admin/` e não existiria. */
  transform: {
    "^.+\\.[jt]sx?$": [
      require.resolve("@swc/jest", { paths: [BACKEND_MODULES] }),
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true, decorators: true },
        },
      },
    ],
  },
}
