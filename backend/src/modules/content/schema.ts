/**
 * O schema do CRM passou a ser um pacote — este arquivo é um re-export.
 * -----------------------------------------------------------------
 * O `buildSchema()` (o schema que o painel desenha e a validação usa) vive em
 * `packages/contrato/src/schema.ts`, ao lado do contrato de que ele é
 * construído. Aqui não há declaração nenhuma: o módulo continua importando
 * `./schema` e recebendo a mesma coisa.
 */
export * from "@rv/contrato/schema"
