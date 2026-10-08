/**
 * A regra do widget de enriquecimento: o que ele grava e o que ele preserva.
 * -------------------------------------------------------------------------
 * O teste que importa é o de **preservação**, e ele tem dois lados:
 *
 *  - o `metadata` do produto, que o Medusa **substitui inteiro** a cada update:
 *    gravar `care` sem levar junto o resto já é perder dado;
 *  - o que o lojista escreveu **fora** do widget (o bloco "Metadata" do próprio
 *    painel do Medusa), que não pode sumir só porque ele editou os cuidados.
 *
 * O outro é o de **ausência**: campo apagado tem de SAIR do objeto, porque o
 * storefront decide se desenha a seção pela presença da chave — `care: ""`
 * desenharia uma seção vazia na página da peça.
 */
import {
  CAMPOS_DO_PRODUTO,
  COR_PADRAO_DO_SELETOR,
  corDoSeletor,
  corpoDoEnriquecimento,
  estadoDoProduto,
  hexesInvalidos,
  hexValido,
  normalizarHex,
  textoDe,
  type ProdutoDoPainel,
} from "../enriquecimento-form"

const PRODUTO: ProdutoDoPainel = {
  id: "prod_1",
  title: "Vestido Midi",
  metadata: {
    care: "Lavar à mão.",
    alguma_chave_do_medusa: "intocada",
    numero: 7,
  },
  variants: [
    {
      id: "var_rosa",
      title: "Rosa / P",
      metadata: { hex: "#B97872", lote: "A" },
    },
    { id: "var_preto", title: "Preto / M", metadata: { hex: "#111111" } },
    { id: "var_nova", title: "Verde / G", metadata: null },
  ],
}

const estadoDe = () => estadoDoProduto(PRODUTO)

describe("CAMPOS_DO_PRODUTO", () => {
  it("pede o metadata da variante, que não vem por padrão", () => {
    // O default do admin tem `*variants` e NÃO `variants.metadata`; e a página
    // de produto ainda pede `-variants`. Sem este `+`, o widget abre vazio e o
    // hex salvo nunca volta para a tela.
    expect(CAMPOS_DO_PRODUTO).toContain("+variants.metadata")
  })
})

describe("textoDe e hexValido", () => {
  it("não-string e ausente leem como vazio", () => {
    expect(textoDe(PRODUTO.metadata, "numero")).toBe("")
    expect(textoDe(PRODUTO.metadata, "nao_existe")).toBe("")
    expect(textoDe(null, "care")).toBe("")
  })

  it("aceita só #RRGGBB", () => {
    expect(hexValido("#B97872")).toBe(true)
    expect(hexValido("  #b97872  ")).toBe(true)
    expect(hexValido("B97872")).toBe(false)
    expect(hexValido("#B9787")).toBe(false)
    expect(hexValido("#GGGGGG")).toBe(false)
    expect(hexValido("rosa")).toBe(false)
  })
})

/**
 * A paleta (`<input type="color">`) e o campo de texto são o mesmo valor: o que
 * a tela escolhe é normalizado antes de chegar no estado, senão o navegador
 * devolve minúsculo, o `corpoDoEnriquecimento` compara com o maiúsculo gravado e
 * a peça "muda" a cada save sem ninguém ter mudado nada.
 */
describe("a paleta do navegador", () => {
  it("abre no hex gravado, em minúsculo, que é o que o input devolve", () => {
    expect(corDoSeletor("#B97872")).toBe("#b97872")
    expect(corDoSeletor("  #B97872 ")).toBe("#b97872")
  })

  it("sem hex (ou com texto inválido) abre no padrão — o input não tem vazio", () => {
    // Não existe `<input type="color">` sem cor: abrir a tela numa variante sem
    // hex tem de mostrar alguma coisa, e essa coisa precisa ser declarada.
    expect(corDoSeletor("")).toBe(COR_PADRAO_DO_SELETOR)
    expect(corDoSeletor("   ")).toBe(COR_PADRAO_DO_SELETOR)
    expect(corDoSeletor("rosa")).toBe(COR_PADRAO_DO_SELETOR)
    expect(corDoSeletor("#B9787")).toBe(COR_PADRAO_DO_SELETOR)
  })

  it("normalizarHex deixa o hex válido em maiúsculo", () => {
    expect(normalizarHex("#b97872")).toBe("#B97872")
    expect(normalizarHex("  #b97872  ")).toBe("#B97872")
    expect(normalizarHex("#B97872")).toBe("#B97872")
  })

  it("texto inválido passa como foi digitado — quem reprova o salvar é outro", () => {
    // Apagar o que a pessoa está digitando seria a tela brigando com ela; o
    // bloqueio é do `hexesInvalidos`, com mensagem na tela.
    expect(normalizarHex("  rosa ")).toBe("rosa")
    expect(normalizarHex("")).toBe("")
  })
})

describe("estadoDoProduto", () => {
  it("lê os três textos e o hex de cada variante", () => {
    const estado = estadoDe()

    expect(estado.textos).toEqual({
      care: "Lavar à mão.",
      contraindications: "",
      size_guide: "",
    })
    expect(estado.hexes).toEqual({
      var_rosa: "#B97872",
      var_preto: "#111111",
      var_nova: "",
    })
  })
})

describe("hexesInvalidos", () => {
  it("lista só quem tem texto que não é hex", () => {
    const estado = estadoDe()

    expect(hexesInvalidos(estado)).toEqual([])

    estado.hexes.var_preto = "preto"

    expect(hexesInvalidos(estado)).toEqual(["var_preto"])
  })

  it("campo vazio não é inválido — é o jeito de tirar a chave", () => {
    const estado = estadoDe()

    estado.hexes.var_rosa = ""

    expect(hexesInvalidos(estado)).toEqual([])
  })
})

describe("corpoDoEnriquecimento", () => {
  it("não manda nada quando nada mudou", () => {
    expect(corpoDoEnriquecimento(PRODUTO, estadoDe())).toEqual({})
  })

  it("grava o texto novo PRESERVANDO o metadata que já existia", () => {
    const estado = estadoDe()

    estado.textos.care = "Lavar à mão, não usar secadora."

    const corpo = corpoDoEnriquecimento(PRODUTO, estado)

    expect(corpo.metadata).toEqual({
      care: "Lavar à mão, não usar secadora.",
      alguma_chave_do_medusa: "intocada",
      numero: 7,
    })
    expect(corpo.variants).toBeUndefined()
  })

  it("campo apagado SAI do objeto, e não vira string vazia", () => {
    const estado = estadoDe()

    estado.textos.care = "   "

    const corpo = corpoDoEnriquecimento(PRODUTO, estado)

    expect(corpo.metadata).toEqual({
      alguma_chave_do_medusa: "intocada",
      numero: 7,
    })
    expect(corpo.metadata).not.toHaveProperty("care")
  })

  it("manda só a variante que mudou, com o metadata dela preservado", () => {
    const estado = estadoDe()

    estado.hexes.var_rosa = "#AABBCC"

    const corpo = corpoDoEnriquecimento(PRODUTO, estado)

    expect(corpo.metadata).toBeUndefined()
    expect(corpo.variants).toEqual([
      { id: "var_rosa", metadata: { hex: "#AABBCC", lote: "A" } },
    ])
  })

  it("a paleta em minúsculo NÃO é mudança quando o gravado é maiúsculo", () => {
    // O `<input type="color">` devolve `#b97872` para um `#B97872` gravado. Sem
    // normalizar antes de comparar, todo save reescreveria a variante (e o
    // metadata dela) com o mesmo valor — e, na tela, isso apareceria como
    // "salvou" sem ninguém ter escolhido nada.
    const estado = estadoDe()

    estado.hexes.var_rosa = "#b97872"

    expect(corpoDoEnriquecimento(PRODUTO, estado)).toEqual({})
  })

  it("o que a paleta escolhe é gravado no formato do contrato: #RRGGBB", () => {
    const estado = estadoDe()

    estado.hexes.var_preto = "#aabbcc"

    const corpo = corpoDoEnriquecimento(PRODUTO, estado)

    expect(corpo.variants).toEqual([
      { id: "var_preto", metadata: { hex: "#AABBCC" } },
    ])
  })

  it("apagar o hex tira a chave da variante, sem tocar nas outras", () => {
    const estado = estadoDe()

    estado.hexes.var_preto = ""

    const corpo = corpoDoEnriquecimento(PRODUTO, estado)

    expect(corpo.variants).toEqual([{ id: "var_preto", metadata: {} }])
  })

  it("variante que o estado não conhece não é apagada por omissão", () => {
    // Entre a leitura e a gravação alguém pode ter criado uma variante nova no
    // painel do Medusa: "não carregada" não é "sem cor".
    const estado = estadoDe()

    delete estado.hexes.var_rosa

    expect(corpoDoEnriquecimento(PRODUTO, estado)).toEqual({})
  })
})
