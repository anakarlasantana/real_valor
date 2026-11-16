import { isDeepStrictEqual } from "node:util"

import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CONTENT_MODULE } from "../../modules/content"
import { PAGE_SURFACES, THEME_SURFACE } from "../../modules/content/contract"
import type {
  QueryGraph,
  RemoteLink,
} from "../../modules/content/curation"
import { retireTextFilters } from "../../modules/content/filters"
import { restoreDefaultSections } from "../../modules/content/restore"
import {
  SCHEMA_KEY,
  SCHEMA_VERSION,
  buildSchema,
  contratoEmDia,
  type ContentSchemaPayload,
} from "../../modules/content/schema"
import type ContentModuleService from "../../modules/content/service"

/**
 * A camada de **edição**: as seções da vitrine, as estações do tema e o
 * registro do contrato.
 *
 * Sem estas linhas o storefront continua bonito (ele cai nos mesmos padrões,
 * embutidos no bundle), mas o CRM abre vazio — não há o que o lojista edite. É
 * por isso que elas entram no seed, e só elas: a **copy** de uma página
 * institucional é do negócio e continua não nascendo aqui.
 */

type Container = ExecArgs["container"]

/**
 * Popula as superfícies de conteúdo: vitrine, tema e cada página declarada.
 *
 * Idempotente pela mesma regra do botão "Restaurar padrão" do CRM
 * (`restoreDefaultSections`): cria o que falta, não encosta no que existe. Uma
 * página declarada sem padrão (hoje todas) não vira linha — quem responde 404 é
 * a rota, e é o estado honesto.
 */
export async function gravarConteudo(
  container: Container,
  { forcar = false }: { forcar?: boolean } = {}
): Promise<void> {
  const service: ContentModuleService = container.resolve(CONTENT_MODULE)
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const link = container.resolve(
    ContainerRegistrationKeys.REMOTE_LINK
  ) as RemoteLink

  const superficies = [
    "home",
    THEME_SURFACE,
    ...PAGE_SURFACES.map((page) => page.id),
  ]

  for (const surface of superficies) {
    if (forcar) {
      const existentes = await service.listContentSections({ surface })

      if (existentes.length) {
        await service.deleteContentSections(
          existentes.map((section) => section.id)
        )
      }
    }

    const { created, kept } = await restoreDefaultSections(service, {
      surface,
      link,
      query,
    })

    if (created.length) {
      console.log(
        `[Real Valor] "${surface}": ${created.length} seção(ões) criada(s) — ` +
          `${kept} já existia(m).`
      )
    }
  }

  // O fecho da conversão dos chips de **texto** (bases anteriores à R1): a chave
  // antiga sai do `data` e a seção sem chips no link recebe os do padrão. Numa
  // base já convertida não grava nada (ver `retireTextFilters`).
  //
  // A linha **crua** (`listContentSections`), e não a achatada (`listSections`):
  // quem sabe onde a chave mora é o `data`, e é ele que a conversão reescreve.
  const { cleaned, chipped } = await retireTextFilters({
    service,
    link,
    query,
    sections: await service.listContentSections({ surface: "home" }),
  })

  if (cleaned.length) {
    console.log(
      `[Real Valor] chips de texto aposentados em: ${cleaned.join(", ")}.` +
        (chipped.length
          ? ` Chips padrão ligados em: ${chipped.join(", ")}.`
          : "")
    )
  }
}

/** Grava o registro do contrato (o schema que o CRM desenha). Idempotente. */
export async function gravarContrato(container: Container): Promise<void> {
  const service: ContentModuleService = container.resolve(CONTENT_MODULE)
  const schema = buildSchema()
  const { version, source } = await service.getContract()

  await service.saveContract({ schema, version: SCHEMA_VERSION })

  console.log(
    `[Real Valor] contrato gravado (chave "${SCHEMA_KEY}", v${SCHEMA_VERSION}, ` +
      `${schema.types.length} tipo(s)). Era ${source === "db" ? `v${version}` : "inexistente"}.`
  )
}

/**
 * Confere o registro sem gravar. Devolve o código de saída (0 = em dia).
 *
 * É o que a CI chama: "mudei o contrato e esqueci de rodar o seed" vira falha
 * de build em vez de um schema velho servindo formulário velho em silêncio.
 */
export async function conferirContrato(container: Container): Promise<number> {
  const service: ContentModuleService = container.resolve(CONTENT_MODULE)
  const { schema, version, source } = await service.getContract()

  if (contratoEmDia(schema, version, source)) {
    console.log(
      `Registro do schema em dia (chave "${SCHEMA_KEY}", versão ${version}).`
    )
    return 0
  }

  if (source === "contract") {
    console.error(
      `O registro do schema não existe no banco (chave "${SCHEMA_KEY}"): ` +
        `a API está servindo o bootstrap do contrato. Rode: make seed`
    )
    return 1
  }

  console.error(
    `O registro do schema está velho (gravado v${version}, contrato v${SCHEMA_VERSION}):\n` +
      `  ${diff(schema, buildSchema()).join("\n  ")}\n` +
      `  Rode: make seed`
  )
  return 1
}

/** As chaves de primeiro nível que diferem, com o tipo dentro de `fields`. */
function diff(
  stored: ContentSchemaPayload,
  fresh: ContentSchemaPayload
): string[] {
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

