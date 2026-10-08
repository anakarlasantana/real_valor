/**
 * Widget da página de produto: o que a loja mostra e o admin não tem onde pôr.
 * -------------------------------------------------------------------------
 * Cuidados, contraindicações e guia de medidas não são campos do Medusa — sem
 * este widget existiriam só em `metadata` escrito à mão no bloco "Metadata" da
 * página, que exige JSON válido e não valida nada. A cor de cada variante tem o
 * mesmo problema: o Medusa guarda o **nome** da cor na opção, e o hex não existe
 * em campo nenhum.
 *
 * Por que **widget** e não uma rota nova: isto se preenche no meio do cadastro da
 * peça, com o formulário do Medusa já aberto. Uma tela separada obrigaria o
 * lojista a sair da página, procurar o produto de novo e voltar — e ele deixaria
 * de preencher. `product.details.after` é a zona que renderiza logo depois das
 * seções do produto, dentro do `LayoutComposer` de `product-detail.tsx`.
 *
 * **O que o widget recebe, medido no dashboard instalado (2.18):** o
 * `SingleColumnPage` renderiza cada widget da zona com `widgetProps = { data }`,
 * ou seja, o produto que a página carregou. Mas a página pede `-variants`
 * (`product-detail/constants.ts`) e o default da Admin API não traz
 * `variants.metadata` — então **do `data` só se usa o `id`**: o resto vem da
 * nossa própria leitura, com os campos explícitos de `CAMPOS_DO_PRODUTO`.
 * Depender do `data` daria um widget que abre vazio, e vazio é indistinguível de
 * "esta peça não tem cuidados cadastrados".
 *
 * A regra de gravação (mesclar, nunca substituir; em branco apaga a chave) mora
 * em `./enriquecimento-form.tsx`, que é função pura e tem teste. O `.tsx` é
 * exigência do plugin do admin (ele só parseia TypeScript em `.tsx` dentro de
 * `widgets/` — a medição está no cabeçalho daquele arquivo). Aqui fica só a
 * tela: ler, mostrar, mandar salvar e dizer o que aconteceu.
 *
 * **A cor tem dois campos e um valor só.** O lojista escolhe pela **paleta**
 * (`<input type="color">`, nativo, sem dependência nova) ou digita o hex — os
 * dois chamam o mesmo `mudarHex`, então não há estado paralelo para dessincronizar
 * e o `salvar` continua lendo um lugar só. A paleta existe porque "que cor é
 * `#B97872`?" não se responde digitando; o hex continua visível porque é ele que
 * o contrato (12.4) grava e é ele que se apaga para tirar a chave.
 */
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

import {
  CAMPOS_DO_PRODUTO,
  CHAVES_DE_TEXTO,
  corDoSeletor,
  corpoDoEnriquecimento,
  estadoDoProduto,
  hexesInvalidos,
  normalizarHex,
  type ChaveDeTexto,
  type EstadoEnriquecimento,
  type ProdutoDoPainel,
  type Rotulos,
} from "./enriquecimento-form"

/** Os rótulos da tela, na ordem em que a cliente lê a página da peça. */
const ROTULOS: Rotulos = {
  care: {
    label: "Cuidados",
    placeholder: "Lavar à mão, não usar secadora, passar em temperatura baixa.",
    ajuda: "Aparece na seção de cuidados da página da peça.",
  },
  contraindications: {
    label: "Contraindicações",
    placeholder: "Não indicado para pele com sensibilidade a fibra sintética.",
    ajuda: "Aparece como aviso. Em branco, a seção não é desenhada.",
  },
  size_guide: {
    label: "Guia de medidas",
    placeholder: "https://exemplo.com.br/guia-de-medidas.pdf",
    ajuda: "Link do PDF ou da página. Em branco, a seção não é desenhada.",
  },
}

/** Do `data` da página só o `id` é usado — ver o cabeçalho. */
type Props = { data?: { id?: string } }

const MENSAGEM_HEX =
  "A cor precisa ser um hex no formato #RRGGBB (ex.: #B97872)."

function InformacoesDaPecaWidget({ data }: Props) {
  const id = data?.id

  const [produto, setProduto] = useState<ProdutoDoPainel | null>(null)
  const [rascunho, setRascunho] = useState<EstadoEnriquecimento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async (productId: string) => {
    setCarregando(true)

    try {
      const res = await fetch(
        `/admin/products/${productId}?fields=${CAMPOS_DO_PRODUTO}`,
        { credentials: "include" }
      )
      const json = await res.json()

      if (!res.ok) {
        // A tela DIZ que não conseguiu ler. Um widget em branco numa falha de
        // leitura é lido como "esta peça não tem nada cadastrado" — e a próxima
        // gravação sairia por cima do que existia.
        setErro(json.message ?? "Falha ao carregar as informações da peça.")
        return
      }

      const lido = json.product as ProdutoDoPainel

      setProduto(lido)
      setRascunho(estadoDoProduto(lido))
      setErro(null)
    } catch {
      setErro("Não foi possível falar com o servidor. Tente de novo.")
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (!id) {
      setCarregando(false)
      setErro("Não foi possível identificar o produto nesta tela.")
      return
    }

    void carregar(id)
  }, [id, carregar])

  const salvar = async () => {
    if (!produto || !rascunho) {
      return
    }

    if (hexesInvalidos(rascunho).length > 0) {
      toast.error(MENSAGEM_HEX)
      return
    }

    const corpo = corpoDoEnriquecimento(produto, rascunho)

    if (Object.keys(corpo).length === 0) {
      toast.info("Nada mudou.")
      return
    }

    setSalvando(true)

    try {
      const res = await fetch(`/admin/products/${produto.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      })
      const json = await res.json()

      if (!res.ok) {
        // A mensagem de validação é do backend e é a que vale: aqui não há
        // segunda regra para divergir da primeira.
        toast.error(json.message ?? "Falha ao salvar as informações da peça.")
        return
      }

      toast.success("Informações da peça salvas.")

      // Recarrega: a gravação seguinte nasce do que o servidor tem, e é isso
      // que impede a segunda de desfazer a primeira.
      await carregar(produto.id)
    } catch {
      toast.error("Não foi possível falar com o servidor.")
    } finally {
      setSalvando(false)
    }
  }

  const mudarTexto = (chave: ChaveDeTexto, valor: string) => {
    setRascunho((atual) =>
      atual ? { ...atual, textos: { ...atual.textos, [chave]: valor } } : atual
    )
  }

  const mudarHex = (varianteId: string, valor: string) => {
    setRascunho((atual) =>
      atual
        ? { ...atual, hexes: { ...atual.hexes, [varianteId]: valor } }
        : atual
    )
  }

  const variantes = produto?.variants ?? []

  return (
    <Container>
      <Heading level="h2">Informações da peça</Heading>
      <Text size="small" color="fg-subtle">
        É o que a cliente lê na página da peça. Campo em branco não desenha a
        seção — preencha só o que a peça tem.
      </Text>

      {erro && (
        <Text size="small" color="fg-danger" className="mt-2">
          {erro}
        </Text>
      )}

      {carregando && (
        <Text size="small" className="mt-2">
          Carregando…
        </Text>
      )}

      {!carregando && !erro && rascunho && (
        <>
          {CHAVES_DE_TEXTO.map((chave) => (
            <div key={chave} className="mt-3 flex flex-col gap-y-1">
              <Label size="small" htmlFor={`rv-${chave}`}>
                {ROTULOS[chave].label}
              </Label>
              <Textarea
                id={`rv-${chave}`}
                rows={2}
                value={rascunho.textos[chave]}
                placeholder={ROTULOS[chave].placeholder}
                onChange={(e) => mudarTexto(chave, e.target.value)}
              />
              <Text size="xsmall" color="fg-subtle">
                {ROTULOS[chave].ajuda}
              </Text>
            </div>
          ))}

          <Heading level="h3" className="mt-5">
            Cor de cada variante
          </Heading>
          <Text size="xsmall" color="fg-subtle">
            Escolha na paleta ou digite o hex no formato #RRGGBB — os dois são o
            mesmo campo. Em branco, a loja mostra a inicial do nome da cor em vez
            da amostra.
          </Text>

          {variantes.length === 0 && (
            <Text size="small" className="mt-2">
              Esta peça ainda não tem variantes: a cor entra depois de cadastrar
              as opções e as variantes.
            </Text>
          )}

          {variantes.map((variante) => {
            const hex = rascunho.hexes[variante.id] ?? ""

            return (
              <div key={variante.id} className="mt-2 flex items-center gap-x-3">
                <Label size="small" htmlFor={`rv-hex-${variante.id}`}>
                  {variante.title ?? variante.id}
                </Label>
                {/*
                  A paleta do navegador, ao lado do hex e não no lugar dele: ela
                  é o jeito rápido de escolher a cor, e o campo de texto continua
                  sendo onde o valor aparece por escrito (e onde se apaga, que é
                  como a chave sai do metadata). `aria-label` próprio porque o
                  `<input type="color">` não aceita `<Label>`: sem ele, o leitor
                  de tela anuncia dois campos sem nome na mesma linha.
                */}
                <input
                  type="color"
                  aria-label={`Escolher a cor de ${variante.title ?? variante.id}`}
                  title="Escolher a cor na paleta"
                  value={corDoSeletor(hex)}
                  onChange={(e) =>
                    mudarHex(variante.id, normalizarHex(e.target.value))
                  }
                  className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-ui-border-base bg-transparent p-0"
                  data-testid={`rv-paleta-${variante.id}`}
                />
                <Input
                  id={`rv-hex-${variante.id}`}
                  size="small"
                  value={hex}
                  placeholder="#B97872"
                  onChange={(e) => mudarHex(variante.id, e.target.value)}
                />
              </div>
            )
          })}

          <div className="mt-4 flex gap-2">
            <Button
              size="small"
              onClick={salvar}
              disabled={salvando}
              isLoading={salvando}
            >
              Salvar informações
            </Button>
          </div>
        </>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
  // Id estável: a ordem e a visibilidade que o lojista escolher na página ficam
  // presas a este nome, então mudar o arquivo de lugar não pode perdê-las. O
  // prefixo evita colisão com widget de plugin — é a recomendação do próprio SDK.
  id: "real-valor:informacoes-da-peca",
})

export default InformacoesDaPecaWidget
