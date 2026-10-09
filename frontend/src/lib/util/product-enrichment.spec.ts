/**
 * O enriquecimento da peça: o que a página e o card leem do painel.
 * -------------------------------------------------------------------------
 * O que este arquivo protege são os três jeitos de a tela **mentir sem erro**:
 *
 *   - **cor que não aparece**: a lista vem da opção, e um título de opção com
 *     acento ou maiúscula ("Côr") não pode deixar a peça sem bolinha nenhuma;
 *   - **cor que vira preta**: hex escrito à mão (`"preto"`, `"#GGG"`) no painel do
 *     Medusa tem de cair para o **nome** da cor, não virar amostra inválida;
 *   - **cor repetida**: a mesma cor em três tamanhos é uma cor no card, e não
 *     três bolinhas iguais.
 *
 * E um quarto, que não é desta função e é o mais caro dos quatro: o `fields` que
 * o catálogo pede à Store API. Um `fields` explícito **substitui** os defaults —
 * o que não estiver lá não chega, sem erro. A conferência é de fonte, porque o
 * `products.ts` é `"use server"` e puxa o SDK da Medusa para dentro do teste.
 *
 * O quinto é a regra que aquele `fields` quebrou: num módulo `"use server"` só
 * pode sair do arquivo FUNÇÃO ASYNC. A lista de campos mora em
 * `data/product-fields.ts` exatamente por isso, e a guarda no fim deste arquivo
 * existe para ela não voltar para dentro do `products.ts` — onde derruba o
 * `next build` inteiro, sem quebrar o `tsc` nem um teste unitário sequer.
 */
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

// O PARSER do TypeScript, e não regex: a guarda do `"use server"` no fim deste
// arquivo precisa reconhecer o diretivo e o `async` como o compilador
// reconhece. Regex erra nos dois casos medidos: o `supported-sections.ts`
// *menciona* `"use server"` num comentário (e não é um módulo de action), e o
// `retrieveCustomer` do `customer.ts` escreve o `async` na linha de baixo.
import ts from "typescript"

// Import explícito, e não `globals: true`: o `tsc` deste pacote roda e os
// globais `describe`/`it`/`expect` dariam erro de tipo (ver `launches.spec.ts`).
import { describe, expect, it } from "vitest"

import {
  CHAVE_CUIDADOS,
  bolinhasDoCard,
  categoriaDaPeca,
  coresDoProduto,
  ehTituloDeCor,
  enriquecimentoDoProduto,
  hexDoMetadata,
  normalizarTitulo,
  textoDoMetadata,
  type ProdutoComEnriquecimento,
} from "./product-enrichment"

/** Uma peça com o que o painel grava: dois tamanhos por cor, um hex inválido. */
const PRODUTO: ProdutoComEnriquecimento = {
  metadata: {
    care: "Lavar à mão, não usar secadora.",
    size_guide: "https://exemplo.com.br/guia-de-medidas.pdf",
    numero: 7,
  },
  options: [
    {
      title: "Cor",
      values: [{ value: "Rosa" }, { value: "Preto" }, { value: "Rosa" }],
    },
    { title: "Tamanho", values: [{ value: "P" }, { value: "M" }] },
  ],
  variants: [
    { options: [{ value: "Rosa" }, { value: "P" }], metadata: { hex: "#B97872" } },
    { options: [{ value: "Rosa" }, { value: "M" }], metadata: { hex: "#B97872" } },
    {
      options: [{ value: "Preto" }, { value: "P" }],
      metadata: { hex: "preto" },
    },
  ],
}

describe("normalizarTitulo", () => {
  it("ignora caixa, acento e espaço das pontas", () => {
    // O lojista digita o título da opção no painel: "Côr", "COR" e "Cor" são a
    // mesma opção, e uma delas não pode custar a bolinha do card.
    expect(normalizarTitulo("  Côr ")).toBe("cor")
    expect(normalizarTitulo("COR")).toBe("cor")
    expect(normalizarTitulo("Cor")).toBe("cor")
    expect(normalizarTitulo("Tamanho")).toBe("tamanho")
  })
})

describe("textoDoMetadata", () => {
  it("devolve o texto aparado", () => {
    expect(textoDoMetadata({ care: "  Lavar à mão.  " }, "care")).toBe(
      "Lavar à mão."
    )
  })

  it("chave ausente, valor que não é texto e texto em branco são todos `null`", () => {
    // Os três significam a mesma coisa para quem desenha — "não há o que
    // mostrar" — e é o que evita seção vazia na página.
    expect(textoDoMetadata(PRODUTO.metadata, "nao_existe")).toBeNull()
    expect(textoDoMetadata(PRODUTO.metadata, "numero")).toBeNull()
    expect(textoDoMetadata({ care: "   " }, "care")).toBeNull()
    expect(textoDoMetadata(null, "care")).toBeNull()
    expect(textoDoMetadata(undefined, CHAVE_CUIDADOS)).toBeNull()
  })
})

describe("hexDoMetadata", () => {
  it("aceita só #RRGGBB", () => {
    expect(hexDoMetadata({ hex: "#B97872" })).toBe("#B97872")
    expect(hexDoMetadata({ hex: "  #b97872 " })).toBe("#b97872")
    expect(hexDoMetadata({ hex: "B97872" })).toBeNull()
    expect(hexDoMetadata({ hex: "#B9787" })).toBeNull()
    expect(hexDoMetadata({ hex: "preto" })).toBeNull()
    expect(hexDoMetadata({ hex: 123 })).toBeNull()
    expect(hexDoMetadata(null)).toBeNull()
  })
})

describe("ehTituloDeCor", () => {
  it("é a MESMA pergunta do card e do seletor da página", () => {
    // O card pergunta "esta peça tem cor?" para desenhar as bolinhas; o seletor
    // da página pergunta o mesmo para decidir entre bolinha e botão de texto. Se
    // cada um tivesse a própria lista, a mesma peça apareceria com cor no card e
    // com nome na página.
    expect(ehTituloDeCor("Cor")).toBe(true)
    expect(ehTituloDeCor(" CÔR ")).toBe(true)
    expect(ehTituloDeCor("cor")).toBe(true)
    expect(ehTituloDeCor("Color")).toBe(true)
    expect(ehTituloDeCor("Colour")).toBe(true)
    expect(ehTituloDeCor("Tamanho")).toBe(false)
    // O Medusa permite opção sem título: `undefined` não é cor.
    expect(ehTituloDeCor(null)).toBe(false)
    expect(ehTituloDeCor(undefined)).toBe(false)
    expect(ehTituloDeCor("")).toBe(false)
  })
})

describe("coresDoProduto", () => {
  it("lista as cores uma vez cada, com o hex de quem tem", () => {
    expect(coresDoProduto(PRODUTO)).toEqual([
      { name: "Rosa", hex: "#B97872" },
      // Hex inválido não é cor: cai para o nome, sem bolinha preta.
      { name: "Preto", hex: null },
    ])
  })

  it("acha o hex na variante seguinte quando a primeira não tem", () => {
    // O lojista cadastra P e M e enriquece só uma: a cor continua tendo hex.
    const produto: ProdutoComEnriquecimento = {
      options: [{ title: "Cor", values: [{ value: "Verde" }] }],
      variants: [
        { options: [{ value: "Verde" }], metadata: null },
        { options: [{ value: "Verde" }], metadata: { hex: "#00FF00" } },
      ],
    }

    expect(coresDoProduto(produto)).toEqual([{ name: "Verde", hex: "#00FF00" }])
  })

  it("aceita o título da opção em português ou inglês, e só ele", () => {
    const comOpcao = (title: string): ProdutoComEnriquecimento => ({
      options: [{ title, values: [{ value: "Rosa" }] }],
      variants: [{ options: [{ value: "Rosa" }], metadata: { hex: "#B97872" } }],
    })

    expect(coresDoProduto(comOpcao("Cor"))).toHaveLength(1)
    expect(coresDoProduto(comOpcao(" CÔR "))).toHaveLength(1)
    expect(coresDoProduto(comOpcao("Color"))).toHaveLength(1)
    // "Tamanho" nunca vira cor, mesmo com valores parecidos com nomes de cor.
    expect(coresDoProduto(comOpcao("Tamanho"))).toEqual([])
  })

  it("peça sem opção de cor devolve lista vazia, e não `undefined`", () => {
    expect(coresDoProduto({})).toEqual([])
    expect(coresDoProduto({ options: [] })).toEqual([])
    expect(coresDoProduto({ options: [{ title: "Cor", values: [] }] })).toEqual(
      []
    )
  })
})

describe("enriquecimentoDoProduto", () => {
  it("junta os textos e as cores numa leitura só", () => {
    expect(enriquecimentoDoProduto(PRODUTO)).toEqual({
      care: "Lavar à mão, não usar secadora.",
      contraindications: null,
      sizeGuide: "https://exemplo.com.br/guia-de-medidas.pdf",
      colors: [
        { name: "Rosa", hex: "#B97872" },
        { name: "Preto", hex: null },
      ],
    })
  })

  it("peça sem nada cadastrado não inventa valor padrão", () => {
    // Nenhum texto ("Consulte a etiqueta") e nenhuma cor: quem desenha decide não
    // desenhar a seção, e é essa decisão que mantém a página limpa.
    expect(enriquecimentoDoProduto({})).toEqual({
      care: null,
      contraindications: null,
      sizeGuide: null,
      colors: [],
    })
  })
})

describe("bolinhasDoCard", () => {
  const cores = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ name: `Cor ${i}`, hex: null }))

  it("até o limite, mostra tudo e nenhum `+n`", () => {
    expect(bolinhasDoCard(cores(3))).toEqual({ visiveis: cores(3), restantes: 0 })
  })

  it("acima do limite, corta e o `+n` bate com o que ficou de fora", () => {
    // O número do "+n" tem de sair da mesma conta que o corte; contado de novo na
    // tela, ele mente — e o defeito é silencioso (a bolinha a mais não aparece).
    const { visiveis, restantes } = bolinhasDoCard(cores(8))

    expect(visiveis).toHaveLength(5)
    expect(restantes).toBe(3)
  })
})

describe("categoriaDaPeca", () => {
  it("escreve o nome da primeira categoria", () => {
    // A mesma leitura da página da peça: a primeira da lista, e não "a mais
    // específica" — o card e a página não podem discordar sobre a peça.
    expect(
      categoriaDaPeca({
        categories: [
          { name: "Alfaiataria", handle: "alfaiataria" },
          { name: "Blusas", handle: "blusas" },
        ],
      })
    ).toBe("Alfaiataria")
  })

  it("sem nome, o handle é o rótulo", () => {
    // Categoria pela metade no painel: o `handle` cru é o caminho por onde a
    // cliente chegou, e é melhor do que a linha do card não existir.
    expect(categoriaDaPeca({ categories: [{ handle: "blusas-e-camisas" }] })).toBe(
      "blusas-e-camisas"
    )
  })

  it("nome em branco não vira rótulo — cai para o handle", () => {
    expect(
      categoriaDaPeca({ categories: [{ name: "   ", handle: "vestidos" }] })
    ).toBe("vestidos")
  })

  it("espaço em volta é apara, não rótulo", () => {
    expect(categoriaDaPeca({ categories: [{ name: "  Vestidos  " }] })).toBe(
      "Vestidos"
    )
  })

  it("sem categoria utilizável, não há linha para reservar", () => {
    // O card de uma peça sem categoria não pode ficar mais alto do que o das
    // outras — mesma regra das bolinhas de cor.
    expect(categoriaDaPeca({})).toBeNull()
    expect(categoriaDaPeca({ categories: [] })).toBeNull()
    expect(categoriaDaPeca({ categories: [{ name: "  " }] })).toBeNull()
    expect(categoriaDaPeca({ categories: [{}] })).toBeNull()
  })
})

describe("a fiação do catálogo", () => {
  it("o `fields` pede o hex da variante e as opções", () => {
    // Um `fields` explícito SUBSTITUI os defaults da Store API (medido em
    // `api/store/products/query-config.js`): o que não estiver nesta linha não
    // chega, e não há erro nenhum — o card simplesmente fica sem cor. Por isso a
    // conferência é de fonte.
    //
    // A lista mudou de casa: o arquivo conferido é o DONO dela
    // (`data/product-fields.ts`), desde que o `"use server"` reprovou a string
    // dentro do `products.ts` — ver a guarda no fim deste arquivo.
    const fonte = readFileSync(
      join(__dirname, "..", "data", "product-fields.ts"),
      "utf8"
    )

    expect(fonte).toContain("+variants.metadata")
    expect(fonte).toContain("*variants.options")
    expect(fonte).toContain("*options.values")
    expect(fonte).toContain("+metadata")
  })

  it("a listagem usa a lista, e não um `fields` recriado na consulta", () => {
    // Sem esta linha, mover a lista para outro arquivo deixaria a consulta com um
    // `fields` copiado na mão — "com os campos certos" e fora do alcance da
    // conferência de cima. O que se afirma aqui é a LIGAÇÃO entre os dois
    // arquivos, e não o texto do campo.
    const fonte = readFileSync(
      join(__dirname, "..", "data", "products.ts"),
      "utf8"
    )

    expect(fonte).toContain("fields: CAMPOS_DO_CATALOGO")
  })

  it("nenhuma tela que lista peças recria a lista de campos", () => {
    /*
     * A varredura é das **telas que listam**, e não de todo `fields` do projeto:
     * `*orders`, `*products` de coleção e `id, email` são de outras consultas, e
     * proibi-los seria proibir o que eles precisam. O que se procura é a linha que
     * já custou caro — uma tela passando um `fields` próprio para `listProducts`,
     * que **substitui** a lista do catálogo e faz a peça chegar sem estoque, sem
     * hex de cor e sem categoria, sem erro nenhum (o defeito está contado em
     * `data/product-fields.ts`).
     */
    const arquivos: string[] = []

    const anda = (dir: string) => {
      for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        const caminho = join(dir, entrada.name)

        if (entrada.isDirectory()) {
          anda(caminho)
        } else if (/\.(ts|tsx)$/.test(entrada.name) && !/\.spec\./.test(entrada.name)) {
          arquivos.push(caminho)
        }
      }
    }

    anda(join(__dirname, "..", "..", "modules"))

    const listadores = arquivos.filter((caminho) =>
      readFileSync(caminho, "utf8").includes("listProducts(")
    )

    // A guarda não pode passar por vácuo: se ninguém mais chama `listProducts`,
    // ela deixou de guardar coisa alguma e quem tem de saber disso é este teste.
    expect(listadores.length).toBeGreaterThan(0)

    for (const caminho of listadores) {
      expect(readFileSync(caminho, "utf8"), caminho).not.toMatch(/fields:\s*"/)
    }
  })
})

/**
 * A cor no seletor da página da peça.
 *
 * A conferência também é de fonte — componente de cliente `.tsx`, e o vitest
 * deste pacote roda em `node`, sem DOM. O que se afirma é a **ligação**: quem
 * passa as cores, quem pergunta se a opção é a de cor, e onde o nome da cor
 * fica. Sem esta guarda, um `cores={cores}` removido amanhã devolveria os botões
 * de texto ("Rosa", "Preto") sem quebrar nenhum tipo: quem lê o JSX não sente
 * falta de uma prop que chega por parâmetro, e o defeito é visual.
 */
describe("a cor no seletor da página da peça", () => {
  it("a opção de cor é decidida pela MESMA regra do card", () => {
    expect(fonteDoSeletor("option-select.tsx")).toContain("ehTituloDeCor(title)")
  })

  it("o rótulo visível é o título da opção, e o nome do valor só existe para quem lê", () => {
    // O rótulo era `Select {title}` (inglês do template) e cada botão escrevia o
    // valor por extenso. Agora o cabeçalho do seletor é o **título da opção**
    // ("Cor") com o valor escolhido ao lado ("Cacau"), e a fileira de cores são
    // amostras: o nome de cada uma fica no `sr-only` (leitor de tela) e no
    // `title` (ponteiro). O que a guarda protege continua sendo o mesmo: a cor é
    // mostrada, não soletrada.
    const fonte = fonteDoSeletor("option-select.tsx")

    expect(fonte).toContain("<span>{title}</span>")
    expect(fonte).toContain("{current && <strong>{current}</strong>}")
    expect(fonte).toContain('className="sr-only">{v}')
    expect(fonte).toContain("title={v}")
  })

  it("as cores (opção + hex da variante) chegam ao seletor nas duas telas", () => {
    // O desktop e o modal do celular desenham o mesmo seletor: um deles sem a
    // lista mostraria nome onde o outro mostra cor.
    for (const arquivo of ["index.tsx", "mobile-actions.tsx"]) {
      const fonte = fonteDoSeletor(arquivo)

      expect(fonte).toContain("coresDoProduto(product)")
      expect(fonte).toContain("cores={cores}")
    }
  })
})

/** O texto de um arquivo do seletor — a pasta dele é `modules/`, não `lib/`. */
function fonteDoSeletor(arquivo: string): string {
  return readFileSync(
    join(
      __dirname,
      "..",
      "..",
      "modules",
      "products",
      "components",
      "product-actions",
      arquivo
    ),
    "utf8"
  )
}

// ---------------------------------------------------------------------------
// A guarda do `"use server"`
// ---------------------------------------------------------------------------

/** Um arquivo de `src/lib/data` já lido pelo parser do TypeScript. */
function analisar(caminho: string): ts.SourceFile {
  return ts.createSourceFile(
    caminho,
    readFileSync(caminho, "utf8"),
    ts.ScriptTarget.Latest,
    true
  )
}

/**
 * Os módulos de Server Action do storefront: os arquivos de `src/lib/data` cujo
 * diretivo é a PRIMEIRA instrução — a mesma exigência do Next, e a razão de a
 * detecção ser pelo parser (comentário de abertura não engana) em vez de por
 * `startsWith` na primeira linha do texto.
 */
function modulosDeServidor(): string[] {
  const diretorio = join(__dirname, "..", "data")

  return readdirSync(diretorio)
    .filter((nome) => nome.endsWith(".ts") && !nome.endsWith(".spec.ts"))
    .map((nome) => join(diretorio, nome))
    .filter((caminho) => {
      const primeiro = analisar(caminho).statements[0]

      if (!primeiro) {
        return false
      }

      return (
        ts.isExpressionStatement(primeiro) &&
        ts.isStringLiteral(primeiro.expression) &&
        primeiro.expression.text === "use server"
      )
    })
}

/**
 * O que o Next RECUSA num módulo `"use server"`: todo export que não seja função
 * async. O tipo sai da lista porque não existe em tempo de execução — `export
 * type`/`interface` são apagados na compilação.
 *
 * Devolve as infrações, uma por linha, e string vazia quando o arquivo está
 * limpo — a asserção é `toEqual([])`, para a falha nomear o arquivo e a linha.
 */
function exportsQueNaoSaoFuncaoAsync(caminho: string): string[] {
  const fonte = analisar(caminho)
  const naLinha = (no: ts.Node) =>
    fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1
  const modificadores = (no: ts.Node): readonly ts.ModifierLike[] =>
    ts.canHaveModifiers(no) ? ts.getModifiers(no) ?? [] : []
  const tem = (no: ts.Node, kind: ts.SyntaxKind) =>
    modificadores(no).some((modificador) => modificador.kind === kind)

  const problemas: string[] = []

  for (const no of fonte.statements) {
    if (!tem(no, ts.SyntaxKind.ExportKeyword)) {
      continue
    }

    if (ts.isTypeAliasDeclaration(no) || ts.isInterfaceDeclaration(no)) {
      continue
    }

    if (ts.isFunctionDeclaration(no)) {
      if (!tem(no, ts.SyntaxKind.AsyncKeyword)) {
        problemas.push(`${caminho}:${naLinha(no)} ${no.name?.text ?? "function"}`)
      }

      continue
    }

    if (ts.isVariableStatement(no)) {
      for (const declaracao of no.declarationList.declarations) {
        const inicializador = declaracao.initializer
        const ehFuncaoAsync =
          inicializador !== undefined &&
          (ts.isArrowFunction(inicializador) ||
            ts.isFunctionExpression(inicializador)) &&
          tem(inicializador, ts.SyntaxKind.AsyncKeyword)

        if (!ehFuncaoAsync) {
          problemas.push(
            `${caminho}:${naLinha(no)} ${declaracao.name.getText(fonte)}`
          )
        }
      }

      continue
    }

    problemas.push(`${caminho}:${naLinha(no)} ${ts.SyntaxKind[no.kind]}`)
  }

  return problemas
}

describe('os módulos "use server"', () => {
  it("não exportam valor nenhum — só função async", () => {
    // MEDIDO: `export const CAMPOS_DO_CATALOGO = "<texto>"` dentro do
    // `products.ts` (que abre com `"use server"`) derrubou o build inteiro da
    // loja, na coleta de dados de página:
    //
    //     Failed to collect page data for /[countryCode]/collections/[handle]
    //     [cause]: Error: A "use server" file can only export async functions,
    //     found string
    //
    // E NADA antes disso acusou: o `tsc` do storefront passa (a regra não é de
    // tipo) e os testes unitários passam (nenhum deles carrega um módulo de
    // action). Pior: o build ABORTA na PRIMEIRA página que importa o módulo, o
    // que esconde as outras — a falha chega ao fim do build, não ao começo.
    // Aqui ela chega em milissegundos.
    const modulos = modulosDeServidor()

    // Uma guarda que não vigia mais nada não pode ficar verde: se `data/` mudar
    // de lugar e a lista vier vazia, o `toEqual([])` de baixo passaria sozinho.
    expect(modulos.length).toBeGreaterThan(0)
    expect(modulos.flatMap(exportsQueNaoSaoFuncaoAsync)).toEqual([])
  })
})
