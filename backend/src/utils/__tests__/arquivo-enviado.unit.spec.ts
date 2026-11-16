/** A recusa do upload, provada sem HTTP. */
import {
  LIMITE_ABSOLUTO,
  LIMITE_DOCUMENTO,
  LIMITE_IMAGEM,
  recusaDoEnvio,
  recusaDoPedido,
} from "../arquivo-enviado"

const MB = 1024 * 1024

describe("recusaDoEnvio", () => {
  it.each([
    ["JPEG", "image/jpeg"],
    ["PNG", "image/png"],
    ["WebP", "image/webp"],
    ["AVIF", "image/avif"],
    ["GIF", "image/gif"],
    ["PDF", "application/pdf"],
  ])("aceita %s dentro do limite", (_nome, mimetype) => {
    expect(recusaDoEnvio({ mimetype, size: 1024 })).toBeUndefined()
  })

  it("aceita o tipo em maiúsculas: o cliente escolhe como escreve", () => {
    expect(recusaDoEnvio({ mimetype: "IMAGE/JPEG", size: 10 })).toBeUndefined()
  })

  it.each([
    ["SVG", "image/svg+xml"],
    ["HTML", "text/html"],
    ["ZIP", "application/zip"],
    ["genérico", "image/*"],
    ["executável", "application/x-msdownload"],
    ["vazio", ""],
    ["ausente", undefined],
  ])("recusa tipo %s", (_nome, mimetype) => {
    expect(recusaDoEnvio({ mimetype, size: 10 })).toMatch(/não permitido/)
  })

  it("recusa imagem acima de 8 MB e aceita exatamente 8", () => {
    expect(
      recusaDoEnvio({ mimetype: "image/jpeg", size: LIMITE_IMAGEM })
    ).toBeUndefined()
    expect(
      recusaDoEnvio({ mimetype: "image/jpeg", size: LIMITE_IMAGEM + 1 })
    ).toMatch(/limite para este tipo é 8\.0 MB/)
  })

  it("recusa PDF acima de 25 MB e aceita exatamente 25", () => {
    expect(
      recusaDoEnvio({ mimetype: "application/pdf", size: LIMITE_DOCUMENTO })
    ).toBeUndefined()
    expect(
      recusaDoEnvio({ mimetype: "application/pdf", size: LIMITE_DOCUMENTO + 1 })
    ).toMatch(/limite para este tipo é 25\.0 MB/)
  })

  it("dá ao PDF o teto maior, e não o da imagem", () => {
    const pdfDe12MB = { mimetype: "application/pdf", size: 12 * MB }
    const fotoDe12MB = { mimetype: "image/jpeg", size: 12 * MB }

    expect(recusaDoEnvio(pdfDe12MB)).toBeUndefined()
    expect(recusaDoEnvio(fotoDe12MB)).toMatch(/12\.0 MB/)
  })

  it("nomeia o arquivo na mensagem de tamanho", () => {
    expect(
      recusaDoEnvio({
        originalname: "capa.png",
        mimetype: "image/png",
        size: 9 * MB,
      })
    ).toContain('"capa.png"')
  })

  it("não deixa aspas vazias quando o nome não veio", () => {
    const recusa = recusaDoEnvio({ mimetype: "image/png", size: 9 * MB })

    expect(recusa).not.toContain('""')
    expect(recusa).toMatch(/O arquivo\s+tem 9\.0 MB/)
  })

  it("o teto absoluto é o do documento — é o que o content-length confere", () => {
    expect(LIMITE_ABSOLUTO).toBe(LIMITE_DOCUMENTO)
    expect(LIMITE_DOCUMENTO).toBeGreaterThan(LIMITE_IMAGEM)
  })
})

describe("recusaDoPedido", () => {
  const png = { originalname: "capa.png", mimetype: "image/png", size: 1024 }

  it("aceita o pedido sem cabeçalho e com arquivo válido", () => {
    expect(recusaDoPedido(undefined, [png])).toBeUndefined()
  })

  it("aceita o cabeçalho exatamente no teto absoluto", () => {
    expect(recusaDoPedido(LIMITE_ABSOLUTO, [png])).toBeUndefined()
    expect(recusaDoPedido(String(LIMITE_ABSOLUTO), [png])).toBeUndefined()
  })

  it("recusa pelo cabeçalho acima do teto, sem depender do arquivo", () => {
    expect(recusaDoPedido(LIMITE_ABSOLUTO + 1, [png])).toBe(
      `O arquivo excede o limite de ${LIMITE_ABSOLUTO / MB} MB.`
    )
  })

  it("cabeçalho que não é número é tratado como ausente", () => {
    expect(recusaDoPedido("", [png])).toBeUndefined()
    expect(recusaDoPedido("abc", [png])).toBeUndefined()
  })

  it("pedido sem arquivo nenhum passa (quem recusa é a rota)", () => {
    expect(recusaDoPedido(undefined, [])).toBeUndefined()
  })

  it("recusa o tipo proibido que veio na lista", () => {
    expect(
      recusaDoPedido(undefined, [{ mimetype: "text/html", size: 10 }])
    ).toMatch(/não permitido/)
  })

  it("recusa a imagem acima do teto do tipo, mesmo abaixo do absoluto", () => {
    expect(
      recusaDoPedido(undefined, [{ mimetype: "image/png", size: 9 * MB }])
    ).toMatch(/limite para este tipo é 8\.0 MB/)
  })
})
