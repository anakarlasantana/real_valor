/** A recusa do upload, provada sem HTTP. */
import {
  LIMITE_ABSOLUTO,
  LIMITE_DOCUMENTO,
  LIMITE_IMAGEM,
  recusaDoEnvio,
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

  it("o teto absoluto é o do documento — é o que o multer corta", () => {
    expect(LIMITE_ABSOLUTO).toBe(LIMITE_DOCUMENTO)
    expect(LIMITE_DOCUMENTO).toBeGreaterThan(LIMITE_IMAGEM)
  })
})
