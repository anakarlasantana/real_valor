import { ehTituloDeCor } from "@lib/util/product-enrichment"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import React from "react"
import type { ProductColor } from "types/global"

/**
 * O seletor de uma opção na página da peça — e a única escolha de cor que a loja
 * oferece de verdade.
 * -------------------------------------------------------------------------
 * **Aqui a bolinha é botão, e no card não é.** Lá (`product-preview/
 * color-swatches.tsx`) uma cor clicável seria `<a>` dentro de `<a>`; aqui o
 * botão é o certo, porque é nesta tela que a escolha tem consequência: estoque,
 * preço e imagem são da variante, e é o `updateOption` que troca os três.
 *
 * **A opção de cor deixa de escrever o nome.** Era o defeito de quem olha a
 * peça: botões com "Rosa", "Preto", "Floral Off-White" — texto no lugar da
 * coisa. Agora a linha de cores são **amostras** (o hex que o lojista escolheu no
 * widget do painel), e o nome fica onde ele informa sem ocupar a tela: `sr-only`
 * para leitor de tela, `title` para o ponteiro. Quem pergunta "é isso que eu
 * queria?" olha a cor; o nome é a resposta para quem não vê a cor.
 *
 * A lista de cores e a decisão de desenhar bolinha vêm de fora, e isso é de
 * propósito: o hex mora em `variants[].metadata.hex` e a lista na **opção** —
 * juntar as duas coisas é a regra de `coresDoProduto` (util, com teste), e não
 * uma segunda conta feita na tela. `ehTituloDeCor` é a mesma função que o card
 * usa, então a página e o card não conseguem discordar sobre qual opção é a cor.
 *
 * O rótulo era `Select {title}` — inglês do template, num storefront que é pt-BR.
 * Virou o **título da opção**: "Cor", "Tamanho", que é o que o lojista escreveu.
 */
type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (title: string, value: string) => void
  title: string
  disabled: boolean
  /**
   * As cores da peça (`coresDoProduto`): `name` é o valor da opção e `hex` o
   * enriquecimento, ou `null` quando não há. Passadas para **todas** as opções —
   * quem decide se usa é `ehTituloDeCor`, aqui dentro; assim quem chama não
   * precisa saber de antemão qual opção é de cor.
   */
  cores: ProductColor[]
  "data-testid"?: string
}

const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  cores,
  "data-testid": dataTestId,
  disabled,
}) => {
  const filteredOptions = (option.values ?? []).map((v) => v.value)

  // Uma pergunta, uma vez: esta opção é a cor da peça?
  const ehCor = ehTituloDeCor(title)

  return (
    <div className="flex flex-col gap-y-3">
      <span className="text-sm">{title}</span>
      <div
        className="flex flex-wrap items-center gap-2"
        data-testid={dataTestId}
      >
        {filteredOptions.map((v) => {
          const selecionada = v === current
          const hex = cores.find((cor) => cor.name === v)?.hex ?? null

          /*
           * Sem hex a amostra não existe: a bolinha mostra a **inicial do
           * nome**, como no card. Sumir diria à cliente que a peça tem menos
           * cores do que tem, e é o mesmo desenho nas duas telas.
           */
          return ehCor ? (
            <button
              onClick={() => updateOption(option.id, v)}
              key={v}
              aria-pressed={selecionada}
              title={v}
              className={clx(
                "flex h-10 w-10 items-center justify-center rounded-circle border-2 bg-ui-bg-subtle transition-all ease-in-out duration-150",
                {
                  "border-ui-border-interactive": selecionada,
                  "border-ui-border-base hover:border-ui-border-interactive":
                    !selecionada,
                }
              )}
              disabled={disabled}
              data-testid="option-button"
            >
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-circle border border-rv-border text-[0.5rem] leading-none"
                style={hex ? { backgroundColor: hex } : undefined}
              >
                {hex ? null : v.charAt(0).toUpperCase()}
              </span>
              <span className="sr-only">{v}</span>
            </button>
          ) : (
            <button
              onClick={() => updateOption(option.id, v)}
              key={v}
              className={clx(
                "border-ui-border-base bg-ui-bg-subtle border text-small-regular h-10 rounded-rounded p-2 flex-1 ",
                {
                  "border-ui-border-interactive": v === current,
                  "hover:shadow-elevation-card-rest transition-shadow ease-in-out duration-150":
                    v !== current,
                }
              )}
              disabled={disabled}
              data-testid="option-button"
            >
              {v}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default OptionSelect
