"use client"

import { MagnifyingGlass } from "@medusajs/icons"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState, type FormEvent } from "react"

/**
 * O campo da busca — a única parte da página que precisa do navegador.
 *
 * Ele escreve **na URL**, e não em estado: `?q=blazer` é o resultado, o
 * histórico e o link que se compartilha. A página é um componente de
 * servidor que lê esse parâmetro e monta a lista, então digitar é navegar
 * — e é por isso que o campo não guarda os resultados.
 *
 * Três decisões que não são óbvias:
 *
 *   1. **A espera de 350ms.** Sem ela, cada letra digitada seria uma
 *      requisição ao backend e um render do servidor (a busca é `q`, e o
 *      `q` só existe quando o termo inteiro existe). Com ela, quem digita
 *      "alfaiataria" faz uma busca, não onze.
 *   2. **`replace`, e não `push`.** Um termo em construção não é um
 *      destino: se cada letra empilhasse histórico, o botão "voltar"
 *      desfaria a digitação tecla por tecla — e sair da busca viraria
 *      apertar "voltar" doze vezes. O `scroll: false` é a outra metade:
 *      trocar de resultado não é trocar de página, e o campo não pode
 *      pular para fora da tela a cada letra.
 *   3. **Enter navega na hora**, sem esperar a pausa. Quem aperta Enter
 *      já disse que terminou.
 *
 * E uma regra de dado: **busca nova volta para a primeira página.** Sem o
 * `page` apagado da URL, procurar "vestido" estando na página 3 de outra
 * busca daria um resultado vazio, sem que nada explique por quê.
 *
 * O valor do campo **segue a URL** quando a URL muda por fora (uma
 * sugestão clicada, por exemplo), mas sem apagar o que está sendo
 * digitado: o efeito de sincronia só mexe no campo quando o termo dele já
 * não é o da URL — que é exatamente o caso do clique na sugestão, e nunca
 * o caso da digitação, porque ali os dois coincidem.
 */

/** A pausa antes de buscar, em milissegundos. */
const DEBOUNCE_MS = 350

export default function SearchField({ query }: { query: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [value, setValue] = useState(query)

  const goTo = useCallback(
    (next: string) => {
      const term = next.trim()
      const params = new URLSearchParams(searchParams.toString())

      if (term) {
        params.set("q", term)
      } else {
        params.delete("q")
      }

      params.delete("page")

      const search = params.toString()

      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      })
    },
    [pathname, router, searchParams]
  )

  useEffect(() => {
    const term = value.trim()

    // Já é o que está na URL: nada a buscar (é o estado de repouso, e o
    // que acontece logo depois de cada navegação que este efeito mesmo
    // disparou).
    if (term === query) {
      return
    }

    const timer = setTimeout(() => goTo(term), DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [goTo, query, value])

  // A URL mudou por fora do campo (sugestão clicada, link colado):
  // o campo se alinha a ela. Enquanto se digita, os dois já são iguais.
  useEffect(() => {
    setValue((current) => (current.trim() === query ? current : query))
  }, [query])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    goTo(value)
  }

  return (
    /*
     * `role="search"` no formulário, e não numa `div`: é a marcação que
     * anuncia a região de busca, e o `<label>`/`id` abaixo é o que dá nome
     * ao campo para quem não vê o texto de apoio da faixa.
     */
    <form className="rv-search-field" role="search" onSubmit={handleSubmit}>
      <MagnifyingGlass aria-hidden="true" focusable="false" />
      <label className="sr-only" htmlFor="rv-search-input">
        Buscar peças
      </label>
      <input
        id="rv-search-input"
        type="search"
        name="q"
        autoComplete="off"
        autoFocus
        enterKeyHint="search"
        placeholder="O que você procura?"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </form>
  )
}
