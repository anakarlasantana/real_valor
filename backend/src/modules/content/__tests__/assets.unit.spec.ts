/**
 * As checagens que **nenhuma linguagem vê**: CSS, binário e espelho de dado
 * entre os dois pacotes.
 *
 * São testes porque leem arquivo de verdade e comparam o resultado — mas o
 * que se compara é dado, não o texto de um `const` (a diferença entre um assert
 * que envelhece e um teste que descreve o invariante). E porque aqui a leitura é
 * justificada: `appearance.ts` escreve uma variável e o `brand.css` consome, uma
 * fonte é um `.woff2` que precisa estar nos **dois** pacotes para a prévia do
 * painel não mentir, e o registro de ícones da loja precisa casar com as
 * chaves que o CRM oferece.
 *
 * Ficam neste arquivo justamente porque vão sobreviver à guarda: o alvo, um dia,
 * é **gerar** os tokens e o `@font-face` do contrato (aí não há o que comparar).
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"

import {
  ICON_LABELS,
  ITEM_FIELDS,
  SECTION_FIELDS,
  THEME_COLOR_HEXES,
  THEME_COLOR_TOKENS,
  THEME_FONTS,
  THEME_FONTS as FONTS,
  type FontRole,
} from "../contract"

// `__dirname` e nao `import.meta.url`: o `tsconfig` do backend compila
// `.ts` para CommonJS (`module: Node16`), onde `import.meta` nao existe.
const here = __dirname
const root = join(here, "../../../../..")
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8")

const brandCss = read("frontend", "src", "styles", "brand.css")
const appearanceSource = read("frontend", "src", "lib", "content", "appearance.ts")
const iconsSource = read("frontend", "src", "lib", "content", "icons.ts")
const socialSource = read("frontend", "src", "lib", "content", "social-icons.tsx")
const themeTs = read("frontend", "src", "lib", "theme.ts")
const defaultTheme = JSON.parse(
  read("frontend", "themes", "default", "theme.json")
) as {
  colors: Record<string, string>
  fonts: Record<string, string>
}

const stringList = (source: string, name: string): string[] =>
  (new RegExp(`export const ${name} = \\[([^\\]]*)\\]`).exec(source)?.[1] ?? "")
    .split(",")
    .map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean)

const storefrontDirs = [
  join(root, "frontend", "src", "app"),
  join(root, "frontend", "src", "modules"),
]

function walk(dir: string, extensions: string[]): string[] {
  let found: string[] = []

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)

    if (entry.isDirectory()) {
      found = found.concat(walk(full, extensions))
      continue
    }

    if (extensions.some((extension) => entry.name.endsWith(extension))) {
      found.push(full)
    }
  }

  return found
}

const storefrontSource = storefrontDirs
  .flatMap((dir) => walk(dir, [".tsx"]))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n")

describe("CSS da aparência", () => {
  it("toda variável de aparência escrita é consumida no brand.css", () => {
    // `--rv-section-*` que a vitrine escreve inline e o CSS não consome é
    // declaration morta: o lojista escolhe a cor, a tela não muda, e nada falha.
    const written = [
      ...appearanceSource.matchAll(/"(--rv-section-[a-z-]+)"/g),
    ].map((match) => match[1])
    const orfas = written.filter((variable) => !brandCss.includes(variable))

    expect(written.length).toBeGreaterThan(0)
    expect(orfas).toEqual([])
  })

  it("toda classe de aparência definida é usada na loja, e vice-versa", () => {
    // `(?:-[a-z]+)*` (e não `[a-z-]*`) para um comentário que escreve o
    // prefixo — "as classes `.rv-section-*` do brand.css" — casar `rv-section`,
    // e não um "rv-section-" que não é classe nenhuma.
    const defined = [
      ...brandCss.matchAll(/^\.(rv-section[a-z-]*)[ ,{]/gm),
    ].map((match) => match[1])
    const used = [
      ...storefrontSource.matchAll(/\brv-section(?:-[a-z]+)*/g),
    ].map((match) => match[0])

    expect(defined.length).toBeGreaterThan(0)
    expect(used.length).toBeGreaterThan(0)
    // CSS morto: ninguém lembra de apagar.
    expect(defined.filter((name) => !used.includes(name))).toEqual([])
    // Erro de digitação: uma classe usada que não existe em lugar nenhum.
    expect(used.filter((name) => !defined.includes(name))).toEqual([])
  })
})

describe("as fontes da prévia do painel", () => {
  const fontFamily = (source: string): string[] => [
    ...source.matchAll(/@font-face\s*\{[^}]*font-family:\s*"([^"]+)"[\s\S]*?\}/g),
  ].map((match) => match[1])

  const md5 = (file: string): string =>
    createHash("md5").update(readFileSync(file)).digest("hex")

  it("o appearance.css declara @font-face para cada papel, apontando para ./fonts", () => {
    const appearanceCss = read(
      "backend", "src", "admin", "routes", "content", "appearance.css"
    )
    const familias = fontFamily(appearanceCss)
    const esperadas = Object.values(THEME_FONTS).map((font) => font.family)

    expect(familias).toEqual(expect.arrayContaining(esperadas))
    expect(appearanceCss).toContain("./fonts")
  })

  it("os .woff2 do painel são os mesmos do storefront (md5)", () => {
    // Conferir a família sem conferir o arquivo deixaria passar a pior falha
    // possível: a prévia desenhada numa fonte que o painel não tem — que é o que
    // acontece quando o nome está certo e o arquivo sumiu.
    //
    // O caminho da loja é `<familia>/<familia>-latin.woff2` (é o que o
    // `src/app/fonts/README.md` documenta), e o do painel é a cópia na mesma
    // pasta do CSS do admin — daí percorrer as famílias, e não os arquivos.
    const panelFonts = join(
      root, "backend", "src", "admin", "routes", "content", "fonts"
    )
    const storefrontFonts = join(root, "frontend", "src", "app", "fonts")

    for (const family of Object.values(THEME_FONTS).map((font) => font.family)) {
      const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      const file = `${slug}-latin.woff2`
      const loja = join(storefrontFonts, slug, file)
      const painel = join(panelFonts, file)

      expect(existsSync(loja)).toBe(true)
      expect(existsSync(painel)).toBe(true)
      expect(md5(painel)).toBe(md5(loja))
    }
  })
})

describe("o tema que a prévia mostra", () => {
  it("cada hex da paleta é o que o tema padrão declara", () => {
    const divergentes = THEME_COLOR_TOKENS.filter(
      (token) =>
        (THEME_COLOR_HEXES[token] ?? "").toLowerCase() !==
        String(defaultTheme.colors?.[token] ?? "").toLowerCase()
    )

    expect(divergentes).toEqual([])
  })

  it("cada família é a que o tema padrão declara", () => {
    const divergentes = (Object.keys(THEME_FONTS) as FontRole[]).filter(
      (role) => THEME_FONTS[role].family !== defaultTheme.fonts?.[role]
    )

    expect(divergentes).toEqual([])
  })

  it("cada pilha é a que o theme.ts escreve para a loja", () => {
    // A pilha é montada pela **fórmula da loja**, lida do próprio `theme.ts`:
    // comparar com uma reescrita do que ele diz não provaria nada.
    const divergentes = (Object.keys(FONTS) as FontRole[]).filter((role) => {
      const template = new RegExp(
        `"--rv-font-${role}":\\s*\`"\\$\\{theme\\.fonts\\.${role}\\}([^\`]*)\``
      ).exec(themeTs)

      return (
        !template ||
        `"${THEME_FONTS[role].family}${template[1]}` !== THEME_FONTS[role].stack
      )
    })

    expect(divergentes).toEqual([])
  })
})

describe("o registro de ícones da loja", () => {
  const iconKeys = (kind: string) =>
    ITEM_FIELDS[kind]?.find((field) => field.name === "icon")?.options ?? []

  it("o CRM oferece exatamente as chaves que a loja desenha", () => {
    expect(iconKeys("list:benefit")).toEqual(
      stringList(iconsSource, "BENEFIT_ICON_KEYS")
    )
    expect(iconKeys("list:action")).toEqual(
      stringList(iconsSource, "HEADER_ACTION_ICON_KEYS")
    )
    expect(iconKeys("list:social")).toEqual(
      stringList(socialSource, "SOCIAL_ICON_KEYS")
    )
  })

  it("toda chave oferecida tem ícone no registro da loja, e vice-versa", () => {
    // Chave nova num lado só ofereceria no admin um ícone que a loja não
    // desenha (ou o contrário, um ícone que ninguém consegue escolher).
    //
    // São **dois** registros, e cada um cobre os seus `kind`: `ICONS`
    // (benefícios e ações do cabeçalho, com os ícones do `@medusajs/icons`) e
    // `SOCIAL_ICONS` (as redes, que desenham SVG próprio). Comparar as redes
    // contra o `ICONS` acusaria uma falha que não existe — foi o que este teste
    // respondeu na primeira rodada, e a resposta ficou no código.
    //
    // Os dois são mapas, e `AVAILABLE_ICON_KEYS` é `Object.keys(ICONS)`, ou
    // seja, **derivado**: o que se lê são as chaves do próprio mapa.
    const registryKeys = (source: string) =>
      new Set(
        [...source.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*):/gm)].map(
          (match) => match[1]
        )
      )

    const icones = registryKeys(iconsSource)
    const sociais = registryKeys(socialSource)
    const deSecao = [...iconKeys("list:benefit"), ...iconKeys("list:action")]
    const deSocial = iconKeys("list:social")

    expect(deSecao.filter((key) => !icones.has(key))).toEqual([])
    expect([...icones].filter((key) => !deSecao.includes(key))).toEqual([])
    expect(deSocial.filter((key) => !sociais.has(key))).toEqual([])
    expect([...sociais].filter((key) => !deSocial.includes(key))).toEqual([])
  })

  it("toda chave de ícone tem rótulo, e nenhum rótulo é órfão", () => {
    const oferecidas = [
      ...iconKeys("list:benefit"),
      ...iconKeys("list:action"),
      ...iconKeys("list:social"),
    ]

    expect(oferecidas.filter((key) => !ICON_LABELS[key])).toEqual([])
    expect(
      Object.keys(ICON_LABELS).filter((key) => !oferecidas.includes(key))
    ).toEqual([])
  })
})

describe("os campos de aparência, dos dois lados", () => {
  it("a loja lê todos os campos de aparência que o contrato declara", () => {
    const declarados = Object.values(SECTION_FIELDS)
      .flat()
      .map((field) => field.name)
      .filter((name) => name.startsWith("appearance"))

    const naoLidos = declarados.filter(
      (name) => !appearanceSource.includes(name)
    )

    expect(declarados.length).toBeGreaterThan(0)
    expect(naoLidos).toEqual([])
  })

  it("a loja não lê campo de aparência que o contrato não declara", () => {
    // O inverso é pior: a loja lê um campo que o contrato tirou, e o CRM nunca
    // vai oferecer a escolha — a seção fica sem a aparência que o dev achou que
    // configurou.
    const declarados = new Set(
      Object.values(SECTION_FIELDS)
        .flat()
        .map((field) => field.name)
        .filter((name) => name.startsWith("appearance"))
    )
    const lidos = [
      ...appearanceSource.matchAll(/source\.appearance[A-Za-z]+/g),
    ].map((match) => match[0].replace("source.", ""))
    const fantasma = [...new Set(lidos)].filter((name) => !declarados.has(name))

    expect(fantasma).toEqual([])
  })
})
