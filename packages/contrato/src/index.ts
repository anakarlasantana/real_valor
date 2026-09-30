/**
 * O contrato de conteúdo, como pacote (G5).
 * -----------------------------------------------------------------
 * O que os dois lados precisam do contrato, num lugar só:
 *
 *   `./contract`  os tipos das seções, as listas fechadas (tipos, paleta,
 *                 papéis de fonte, trilhos, ícones) e o que o storefront lê
 *                 em runtime;
 *   `./defaults`  o conteúdo padrão — o fallback da vitrine quando a API de
 *                 conteúdo falha, e o seed do banco.
 *
 * O `./schema` (o schema do CRM, construído do contrato) fica num subcaminho
 * à parte (`@rv/contrato/schema`): é só do backend e do painel, e o storefront
 * não tem o que fazer com ele.
 *
 * Até o G5 estes dois arquivos eram um só no backend e o storefront recebia
 * uma **cópia gerada** (`frontend/src/lib/content/contract.generated.ts`,
 * escrita por `scripts/gen-content.mjs`). A cópia morreu: os dois pacotes
 * declaram `@rv/contrato` como dependência de workspace e importam o mesmo
 * arquivo — a fronteira contrato ⇔ loja passou a ser do compilador.
 */
export * from "./contract.ts"
export * from "./defaults.ts"
