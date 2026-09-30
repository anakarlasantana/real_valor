/**
 * O conteúdo padrão passou a ser um pacote — este arquivo é um re-export.
 * -----------------------------------------------------------------
 * Mesmo caso de `./contract`: nada é declarado aqui, só re-exportado. O
 * conteúdo padrão vive em `packages/contrato/src/defaults.ts`, junto do
 * contrato que ele preenche — e é dele também que o storefront tira o
 * fallback (`DEFAULT_HOME_SECTIONS`), em vez da cópia gerada que existia
 * até o G5.
 */
export * from "@rv/contrato/defaults"
