import { ExecArgs } from "@medusajs/framework/types"
import { isDeepStrictEqual } from "node:util"

import { CONTENT_MODULE } from "../modules/content"
import {
  SCHEMA_KEY,
  SCHEMA_VERSION,
  buildSchema,
  type ContentSchemaPayload,
} from "../modules/content/schema"
import type ContentModuleService from "../modules/content/service"
import { scriptFlags } from "./flags"

/**
 * Grava (ou confere) o registro do schema do CRM no Postgres.
 * -------------------------------------------------------------------------
 * Rode com:
 *   ./node_modules/.bin/medusa exec ./src/scripts/seed-schema.ts
 *   yarn seed-schema
 *
 * Este é o **writer**: `contract.ts` é o bootstrap e esta linha é a fonte em
 * runtime (`service.getSchema()` prefere o banco). A migration cria só a
 * tabela — deixar o `insert` numa migration faria o histórico depender do
 * código do dia em que rodou, e um banco novo em 2027 nasceria com o schema de
 * 2027 enquanto o de 2026 tem o de 2026.
 *
 * Idempotente: é sempre a mesma linha (`SCHEMA_KEY`), reescrita com a versão
 * carimbada. Rodar mil vezes deixa o banco num estado só.
 *
 * `--check` não grava nada: compara o registro com o contrato e sai com
 * código 1 na divergência. É o que a CI chama — é assim que "mudei o contrato
 * e esqueci de atualizar o registro" vira falha de build em vez de um schema
 * velho servindo formulário velho em silêncio.
 */
export default async function seedSchema({
  container,
  args,
}: ExecArgs & { args?: string[] }) {
  const service: ContentModuleService = container.resolve(CONTENT_MODULE)
  const check = scriptFlags(args).includes("--check")

  const fromContract = buildSchema()
  const { schema: stored, version, source } = await service.getSchema()

  if (check) {
    // `isDeepStrictEqual`, e não comparar string: o `data` é `jsonb`, que não
    // preserva a ordem das chaves — o `JSON.stringify` acusaria divergência
    // numa base recem-gravada e o `--check` viraria alarme falso.
    if (source === "db" && isDeepStrictEqual(stored, fromContract)) {
      console.log(
        `Registro do schema em dia (chave "${SCHEMA_KEY}", versão ${version}).`
      )
      return
    }

    if (source === "contract") {
      console.error(
        `O registro do schema não existe no banco (chave "${SCHEMA_KEY}"): ` +
          `a API está servindo o bootstrap do contrato. Rode: make seed-schema`
      )
      process.exitCode = 1
      return
    }

    console.error(
      `O registro do schema está velho (gravado v${version}, contrato v${SCHEMA_VERSION}):\n` +
        `  ${diff(stored, fromContract).join("\n  ")}\n` +
        `  Rode: make seed-schema`
    )
    process.exitCode = 1
    return
  }

  await service.saveSchema({ schema: fromContract, version: SCHEMA_VERSION })

  console.log(
    `Schema gravado (chave "${SCHEMA_KEY}", versão ${SCHEMA_VERSION}, ` +
      `${fromContract.types.length} tipo(s) de seção). ` +
      `Era ${source === "db" ? `v${version}` : "inexistente"}.`
  )
}

/** As chaves de primeiro nível que diferem, com o tipo dentro de `fields`. */
function diff(stored: ContentSchemaPayload, fresh: ContentSchemaPayload): string[] {
  const changed: string[] = []

  for (const key of Object.keys(fresh) as (keyof ContentSchemaPayload)[]) {
    if (isDeepStrictEqual(stored[key], fresh[key])) {
      continue
    }

    const before = stored[key] as Record<string, unknown> | undefined
    const after = fresh[key] as Record<string, unknown> | undefined

    if (isMap(before) && isMap(after)) {
      const touched = Object.keys(after).filter(
        (sub) => !isDeepStrictEqual(before[sub], after[sub])
      )
      const gone = Object.keys(before).filter((sub) => !(sub in after))

      changed.push(
        `${key}: ${[...touched, ...gone.map((sub) => `-${sub}`)].join(", ")}`
      )
      continue
    }

    changed.push(key)
  }

  return changed
}

/** Só mapas de verdade: `palette` e `fonts` são, `types` é lista. */
function isMap(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
