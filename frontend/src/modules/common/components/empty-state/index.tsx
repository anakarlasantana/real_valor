import { type ReactNode } from "react"

/**
 * O estado vazio — a resposta que a página dá quando **não** tem o que
 * mostrar: a busca que não encontrou nada, e (adiante) a sacola sem item.
 *
 * Ele é um componente, e não um trecho copiado, por um motivo prático: o
 * vazio é o estado em que a loja é julgada com mais facilidade. Uma frase
 * escrita de novo em cada tela vira três vozes diferentes para a mesma
 * situação ("nada encontrado", "sem resultados", "não há itens"), e a que
 * ficasse mais velha seria justamente a que a cliente vê quando algo dá
 * errado. Aqui o desenho e o tom moram num lugar só.
 *
 * O componente é **burro**: não decide texto, ícone nem destino. Quem
 * chama passa as três coisas, porque só a tela sabe o que oferecer — a
 * busca oferece o catálogo inteiro, a sacola oferece a vitrine.
 *
 * A forma (`min-height`, faixa elevada, centralização) está em
 * `.rv-empty-state`, no `brand.css`: o tamanho do ícone e o traço rosa são
 * decisão de desenho, e por isso o ícone entra sem classe nenhuma.
 */
export default function EmptyState({
  icon,
  title,
  text,
  children,
  "data-testid": dataTestId,
}: {
  /** O glifo do cabeçalho do vazio. Sem ele, o bloco começa no título. */
  icon?: ReactNode
  title: string
  text?: ReactNode
  /** A saída: o botão que tira a cliente da tela vazia. */
  children?: ReactNode
  "data-testid"?: string
}) {
  return (
    <div className="rv-empty-state" data-testid={dataTestId ?? "empty-state"}>
      {icon}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {children}
    </div>
  )
}
