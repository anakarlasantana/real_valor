/**
 * As seções da página da peça: quais existem e o que cada uma é.
 * -------------------------------------------------------------------------
 * Antes isto era um componente com dois blocos fixos, e o resultado tinha dois
 * defeitos visíveis na loja:
 *
 *   1. **Campo vazio virava `"-"`.** Cinco travessões empilhados dizem à cliente
 *      que a peça tem ficha técnica — e ela não tem. A regra certa é: seção sem
 *      dado **não existe**; e a ficha só aparece se algum campo nativo existir.
 *   2. **Rótulo e texto em inglês** ("Product Information", "Type", "Weight",
 *      "Your package will arrive in 3-5 business days…") numa loja pt-BR — o
 *      mesmo defeito do RV-003, agora na página do produto.
 *
 * A decisão mora aqui, e não no componente, porque ela é **regra** (ordem, o que
 * existe, o que é link e o que é aviso) e regra se testa sem renderizar. O
 * componente ficou com o que é só dele: escolher a marcação de cada `kind`.
 *
 * O `kind` existe para a tela poder tratar diferente o que é diferente:
 * contraindicação é **aviso** (fundo e ícone próprios), guia de medidas é
 * **link**, ficha técnica é **lista de rótulo e valor**, e o resto é **texto**.
 * Sem o `kind`, o componente adivinharia pelo título — e adivinhar por texto é
 * como as duas telas divergem depois.
 */
import type { ProductEnrichment } from "types/global"

export type ItemDaFicha = { rotulo: string; valor: string }

export type SecaoDaPeca =
  | { kind: "texto"; titulo: string; texto: string }
  | { kind: "ficha"; titulo: string; itens: ItemDaFicha[] }
  | { kind: "link"; titulo: string; url: string; rotulo: string }
  | { kind: "aviso"; titulo: string; texto: string }

/**
 * O que este módulo lê do produto: os campos nativos da ficha técnica.
 *
 * Tipo estrutural, e não `StoreProduct`: são seis campos, e declará-los aqui é o
 * que permite testar a regra com um objeto de dez linhas (o mesmo critério de
 * `product-enrichment.ts` e `product-availability.ts`).
 */
export type ProdutoDaFicha = {
  description?: string | null
  material?: string | null
  origin_country?: string | null
  weight?: number | null
  length?: number | null
  width?: number | null
  height?: number | null
  type?: { value?: string | null } | null
}

/** Texto aparado, ou `null` quando não há o que mostrar (vazio é ausência). */
function textoLimpo(valor: string | null | undefined): string | null {
  if (typeof valor !== "string") {
    return null
  }

  const texto = valor.trim()

  return texto === "" ? null : texto
}

/**
 * O guia de medidas é um **link** quando é um endereço, e texto quando não é.
 *
 * O campo é livre de propósito (o lojista pode colar o PDF, a página do guia ou
 * escrever "medidas no chat"), e as duas formas precisam funcionar: forçar link
 * transformaria texto em link quebrado, e forçar texto esconderia a URL.
 */
export function urlDoGuia(valor: string | null): string | null {
  if (valor === null) {
    return null
  }

  return /^https?:\/\//i.test(valor) ? valor : null
}

/** A ficha técnica, com só os campos que existem. Vazia é lista vazia. */
export function fichaDaPeca(produto: ProdutoDaFicha): ItemDaFicha[] {
  const itens: ItemDaFicha[] = []

  const composicao = textoLimpo(produto.material)
  const origem = textoLimpo(produto.origin_country)
  const tipo = textoLimpo(produto.type?.value)

  if (composicao !== null) {
    itens.push({ rotulo: "Composição", valor: composicao })
  }

  if (tipo !== null) {
    itens.push({ rotulo: "Tipo", valor: tipo })
  }

  if (origem !== null) {
    itens.push({ rotulo: "Origem", valor: origem })
  }

  if (produto.weight) {
    itens.push({ rotulo: "Peso", valor: `${produto.weight} g` })
  }

  // As três medidas só valem juntas: meia medida não descreve a peça.
  if (produto.length && produto.width && produto.height) {
    itens.push({
      rotulo: "Medidas",
      valor: `${produto.length} × ${produto.width} × ${produto.height}`,
    })
  }

  return itens
}

/**
 * As seções da página, na ordem em que a cliente lê.
 *
 * A ordem é fixa e é essa: descrição (o que é), ficha (de que é feito), cuidados
 * (como tratar), guia (que tamanho serve) e contraindicações (para quem **não**
 * serve) por último, porque aviso não é argumento de venda — é o que ela lê
 * depois de gostar da peça.
 */
export function secoesDaPeca(
  produto: ProdutoDaFicha,
  enriquecimento: ProductEnrichment
): SecaoDaPeca[] {
  const secoes: SecaoDaPeca[] = []

  const descricao = textoLimpo(produto.description)

  if (descricao !== null) {
    secoes.push({ kind: "texto", titulo: "Descrição", texto: descricao })
  }

  const ficha = fichaDaPeca(produto)

  if (ficha.length > 0) {
    secoes.push({ kind: "ficha", titulo: "Composição e tecido", itens: ficha })
  }

  if (enriquecimento.care !== null) {
    secoes.push({
      kind: "texto",
      titulo: "Cuidados",
      texto: enriquecimento.care,
    })
  }

  if (enriquecimento.sizeGuide !== null) {
    const url = urlDoGuia(enriquecimento.sizeGuide)

    secoes.push(
      url !== null
        ? {
            kind: "link",
            titulo: "Guia de medidas",
            url,
            rotulo: "Abrir o guia de medidas",
          }
        : {
            kind: "texto",
            titulo: "Guia de medidas",
            texto: enriquecimento.sizeGuide,
          }
    )
  }

  if (enriquecimento.contraindications !== null) {
    secoes.push({
      kind: "aviso",
      titulo: "Contraindicações",
      texto: enriquecimento.contraindications,
    })
  }

  return secoes
}
