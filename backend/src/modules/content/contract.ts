/**
 * O contrato passou a ser um pacote — este arquivo é um re-export.
 * -----------------------------------------------------------------
 * Ele existe para o módulo de conteúdo continuar importando `./contract` como
 * sempre importou: **não declara nada**, só re-exporta `@rv/contrato/contract`
 * (o `export *` mantém a superfície que os outros arquivos daqui já usavam).
 *
 * **Onde mexer agora:** `packages/contrato/src/contract.ts`. Antes do G5 o
 * contrato era um arquivo daqui e o storefront recebia uma cópia gerada
 * (`frontend/src/lib/content/contract.generated.ts`); a cópia e o pedaço do
 * gerador que a escrevia morreram no G5 — os dois apps importam o mesmo
 * módulo, e quem confere a fronteira é o compilador.
 */
export * from "@rv/contrato/contract"
