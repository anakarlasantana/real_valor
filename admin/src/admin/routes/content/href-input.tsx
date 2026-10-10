/**
 * Campo de destino do editor de conteúdo (`kind: "href"`).
 * -------------------------------------------------------------------------
 * O mesmo campo de texto de antes, com a **lista das rotas que a loja tem** ao
 * lado. É o PR5 do doc 14, e o que ele fecha é a causa-raiz do doc 13: nove
 * botões apontando para `/store` não era desatenção de quem editou — era o
 * painel só oferecer texto livre, sem nada que dissesse ao lojista quais
 * endereços existem. O único que se podia conferir era `/store`, que existe e
 * sempre responde.
 *
 * **A lista sugere, não tranca — e isso é decisão, não descuido.** O valor
 * continua sendo uma string, porque nem todo destino é uma rota da loja:
 * `https://…` (as redes sociais), `mailto:`/`tel:` (o atendimento) e a âncora
 * da vitrine (`/#editorial`, que o `nav-link` rola até a seção) continuam
 * válidos e são **metade** dos destinos do padrão. Um `<select>` fechado
 * recusaria os três; um `<select>` ao lado de uma caixa de texto obrigaria a um
 * segundo estado ("não é da lista") e a uma regra de qual dos dois manda.
 * O `datalist` nativo faz as duas coisas num controle só: o campo é texto, e a
 * lista aparece no clique/na digitação.
 *
 * **A lista chega pelo `schema`** (`schema.destinations`,
 * `CONTENT_DESTINATIONS`), e não de uma constante aqui: o painel é outro pacote
 * e desenha o que o registro diz, como nos campos, nas marcas e na paleta. Uma
 * página nova no contrato aparece no seletor sem edição em React.
 *
 * ⚠️ **Dois limites declarados.** (1) Um registro gravado **antes da v14** não
 * tem `destinations`, e o campo degrada para caixa de texto — a lista é o que
 * falta, e `make seed-schema` a traz. (2) O servidor **não** confere o destino:
 * `validateData` continua sem tocar em `href` (é o que o doc 13 mediu), então um
 * `/stroe` digitado à mão ainda vai ao ar. O que este campo muda é que o
 * lojista deixa de ter `/store` como única alternativa.
 */
import { Input } from "@medusajs/ui"
import { useId } from "react"

import type { ContentDestination } from "@conteudo/contract"

export const HrefInput = ({
  value,
  onChange,
  destinations,
}: {
  value: unknown
  onChange: (value: string) => void
  /**
   * `schema.destinations` — as rotas conhecidas, com o rótulo de cada uma.
   * Opcional porque um registro anterior à v14 não a tem (ver o cabeçalho).
   */
  destinations?: readonly ContentDestination[]
}) => {
  /**
   * O `id` do `datalist` tem de ser **único na página**: a tela desenha dezenas
   * de campos de destino (todo link do menu e do rodapé é um), e dois
   * `datalist` com o mesmo `id` fariam o segundo oferecer a lista do primeiro —
   * o `useId` do React é estável por instância, e não um contador nosso.
   */
  const listId = useId()
  const stored = typeof value === "string" ? value : ""

  return (
    <div className="flex flex-col">
      <Input
        list={listId}
        value={stored}
        placeholder="/sobre"
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {(destinations ?? []).map((destination) => (
          <option key={destination.href} value={destination.href}>
            {destination.label}
          </option>
        ))}
      </datalist>
    </div>
  )
}
