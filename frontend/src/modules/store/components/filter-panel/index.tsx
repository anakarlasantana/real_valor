"use client"

import { Plus } from "@medusajs/icons"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import {
  selecaoDaUrl,
  type ChaveDeFaceta,
  type Faceta,
} from "@lib/util/catalog-filters"

/**
 * O painel de filtros — os acordeões do redesenho, com valores do catálogo.
 *
 * **A marcação mora na URL, não aqui.** Cada caixa marcada escreve no endereço
 * (`?cor=Preto,Azul`), e o estado do componente é lido de volta dela — por isso o
 * filtro é compartilhável, sobrevive ao "voltar" e o painel do celular (a gaveta)
 * e o do desktop (a barra lateral) mostram **a mesma coisa** sem nenhum estado
 * compartilhado entre os dois: os dois leem o mesmo endereço.
 *
 * Ele é montado duas vezes na página de propósito — uma na barra lateral, uma na
 * gaveta — e é por isso que as caixas **não têm `id`**: o `<label>` envolve o
 * `<input>`, que é a associação implícita do HTML, e id nenhum é repetido.
 *
 * O `<details>` é controlado por um `useState`, e não pelo `open` solto. Em HTML
 * o `open` é atributo de estado inicial; em React ele é reintroduzido a cada
 * render em que o valor da prop muda de ideia, e o que se ganha com o controle
 * explícito é a certeza de que o acordeão que a cliente fechou continua fechado
 * depois de qualquer re-render (o `onToggle` sincroniza os dois).
 *
 * A gaveta de filtros do catálogo é a **mesma** geometria da gaveta do menu
 * (`.rv-drawer`): quem decide onde ela mora é o `catalog-toolbar`.
 */
export default function FilterPanel({ facets }: { facets: Faceta[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Os dois primeiros acordeões nascem abertos — é o que a referência faz, e é
  // onde os filtros se leem sem um clique.
  const [abertos, setAbertos] = useState<string[]>(() =>
    facets.slice(0, 2).map((faceta) => faceta.key)
  )

  const selecao = selecaoDaUrl(searchParams)

  const alternar = (chave: ChaveDeFaceta, valor: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const marcados = new Set(selecao[chave] ?? [])

    if (marcados.has(valor)) {
      marcados.delete(valor)
    } else {
      marcados.add(valor)
    }

    const valores = Array.from(marcados)

    if (valores.length > 0) {
      params.set(chave, valores.join(","))
    } else {
      params.delete(chave)
    }

    /*
     * Filtrar **volta para a primeira página**. Sem isto, marcar um filtro na
     * página 3 de 4 mostraria a página 3 do resultado novo — que pode não existir
     * —, e a cliente veria uma grade vazia com um filtro aplicado.
     */
    params.delete("page")

    const search = params.toString()

    router.push(search ? `${pathname}?${search}` : pathname)
  }

  return (
    <div className="rv-filter-panel" data-testid="filter-panel">
      {facets.map((faceta) => {
        const marcados = new Set(selecao[faceta.key] ?? [])

        return (
          <details
            key={faceta.key}
            open={abertos.includes(faceta.key)}
            onToggle={(event) => {
              const aberto = event.currentTarget.open

              setAbertos((anteriores) =>
                aberto
                  ? Array.from(new Set([...anteriores, faceta.key]))
                  : anteriores.filter((chave) => chave !== faceta.key)
              )
            }}
          >
            <summary>
              {faceta.title}
              {/* O glifo do acordeão é do desenho: gira 45° quando aberto
                  (vira um ×), que é a única pista de que ele fecha. */}
              <Plus
                aria-hidden="true"
                focusable="false"
                className="rv-filter-icon"
              />
            </summary>

            <div className="rv-filter-options">
              {faceta.options.map((opcao) => {
                const marcado = marcados.has(opcao.value)

                /*
                 * A opção que a combinação não alcança nasce **desabilitada**, e
                 * não escondida: escondida, ela diria que a loja não tem aquele
                 * valor; desabilitada, ela diz que não tem naquele recorte — que
                 * é o que aconteceu. O `disabled` do HTML é o que tira a caixa da
                 * ordem de foco (ninguém navega por Tab até um controle morto) e o
                 * `aria-disabled` repete a informação para quem ouve a lista.
                 *
                 * O valor **marcado** nunca fica desabilitado, nem quando a
                 * contagem dele é zero: é a caixa que desfaz o filtro.
                 */
                const vazio = opcao.count === 0 && !marcado

                return (
                  <label key={opcao.value} data-vazio={vazio || undefined}>
                    <input
                      type="checkbox"
                      name={faceta.key}
                      value={opcao.value}
                      checked={marcado}
                      disabled={vazio}
                      aria-disabled={vazio || undefined}
                      onChange={() => alternar(faceta.key, opcao.value)}
                    />
                    <span>
                      {opcao.label} ({opcao.count})
                    </span>
                  </label>
                )
              })}
            </div>
          </details>
        )
      })}
    </div>
  )
}
