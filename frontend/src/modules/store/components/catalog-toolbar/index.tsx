"use client"

import { Popover, Transition } from "@headlessui/react"
import { Plus, XMark } from "@medusajs/icons"
import { Fragment } from "react"

import type { Faceta } from "@lib/util/catalog-filters"

import FilterPanel from "../filter-panel"
import SortProducts, { type SortOptions } from "../refinement-list/sort-products"

/**
 * A barra de ferramentas do catálogo: a contagem, os filtros e a ordem.
 *
 * A contagem é a primeira coisa que a cliente lê depois de filtrar ("12 peças"),
 * e por isso ela vem do resultado **já filtrado** — é o número que responde à
 * pergunta que ela acabou de fazer.
 *
 * No celular o painel de filtros não cabe ao lado da grade: ele vira a **gaveta**
 * do redesenho (`.rv-drawer`, a mesma classe do menu), aberta pelo botão
 * "Filtros". A gaveta é um `Popover` do Headless UI pelo mesmo motivo do menu:
 * fechar com Esc, prender o foco e devolvê-lo ao botão são coisas que o
 * navegador só garante com gestão de foco — uma `div` com `useState` não faz
 * nenhuma delas. E o botão do pé ("Ver N peças") **não aplica nada**: os filtros
 * já estão aplicados (a marcação escreve na URL na hora); ele só fecha a gaveta,
 * que é o gesto que a cliente espera depois de escolher.
 *
 * O que é `role="status"` na contagem: ela muda sem que ninguém tenha clicado
 * nela, e quem usa leitor de tela precisa saber que a grade mudou de tamanho.
 */
export default function CatalogToolbar({
  count,
  sortBy,
  facets,
  ativos,
}: {
  count: number
  sortBy: SortOptions
  facets: Faceta[]
  /** Quantas facetas estão marcadas — o número do rótulo do botão. */
  ativos: number
}) {
  const pecas = count === 1 ? "1 peça" : `${count} peças`

  return (
    <div className="rv-catalog-toolbar">
      <p className="rv-catalog-count" role="status" data-testid="catalog-count">
        {pecas}
      </p>

      {facets.length > 0 && (
        <Popover className="small:hidden">
          {({ open, close }) => (
            <>
              <Popover.Button
                className="rv-btn rv-btn-secondary"
                data-testid="filter-drawer-button"
              >
                {/* O número no rótulo é o do requisito ("Filtrar (n)"): quem
                    abre a gaveta precisa saber, antes de abrir, se esqueceu um
                    filtro ligado — porque no celular a barra lateral não existe
                    para lembrar. */}
                Filtros{ativos > 0 ? ` (${ativos})` : ""}
                <Plus aria-hidden="true" focusable="false" />
              </Popover.Button>

              {open && (
                <div
                  className="rv-drawer-backdrop"
                  onClick={close}
                  data-testid="filter-drawer-backdrop"
                />
              )}

              <Transition
                show={open}
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in duration-150"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              >
                <Popover.Panel className="rv-drawer" data-testid="filter-drawer">
                  <div className="rv-drawer-head">
                    <h3 className="rv-eyebrow text-rv-grafite">
                      Filtrar produtos
                    </h3>
                    <button
                      type="button"
                      className="rv-icon-btn"
                      onClick={close}
                      aria-label="Fechar filtros"
                      data-testid="close-filter-drawer"
                    >
                      <XMark aria-hidden="true" focusable="false" />
                    </button>
                  </div>

                  <FilterPanel facets={facets} />

                  <button
                    type="button"
                    className="rv-btn rv-btn-primary w-full"
                    onClick={close}
                  >
                    Ver {pecas}
                  </button>
                </Popover.Panel>
              </Transition>
            </>
          )}
        </Popover>
      )}

      <SortProducts sortBy={sortBy} data-testid="sort-by-container" />
    </div>
  )
}
