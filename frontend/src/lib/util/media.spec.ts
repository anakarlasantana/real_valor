/**
 * O tradutor entre o que o conteúdo grava e o que o `next/image` sabe buscar.
 * ---------------------------------------------------------------------------
 * O que este teste protege é uma regressão que **não aparece em revisão**:
 * devolver a URL absoluta do backend parece certo (o arquivo está naquele
 * endereço) e funciona no navegador de quem está na mesma máquina — mas o
 * otimizador do `next/image` roda dentro do container do storefront, onde
 * `localhost:9000` é o próprio container. A foto some, sem erro visível.
 *
 * Por isso o caso central é "valor estranho vira caminho do próprio site", e
 * não a chave crua (que é o caso novo e óbvio).
 */
// Import explícito, e não `globals: true`: o `tsc` deste pacote roda e os
// globais `describe`/`it`/`expect` dariam erro de tipo (ver
// `supported-sections.spec.ts`, onde a mesma decisão está comentada).
import { describe, expect, it } from "vitest"

import { resolveMediaUrl } from "./media"

describe("resolveMediaUrl", () => {
  it("a chave crua do provider vira o caminho publicado pela loja", () => {
    expect(resolveMediaUrl("1699999999-hero.jpg")).toBe(
      "/uploads/1699999999-hero.jpg"
    )
  })

  it("caminho já resolvido passa igual (a função é idempotente)", () => {
    const resolved = resolveMediaUrl("1699999999-hero.jpg")

    expect(resolveMediaUrl(resolved)).toBe(resolved)
  })

  it("a imagem que vem no repositório passa igual", () => {
    expect(resolveMediaUrl("/brand/hero.jpg")).toBe("/brand/hero.jpg")
  })

  it("a URL absoluta do backend vira caminho do site (o caso que quebra o otimizador)", () => {
    expect(resolveMediaUrl("http://localhost:9000/static/1699-hero.jpg")).toBe(
      "/uploads/1699-hero.jpg"
    )
    // Dentro da rede do Compose o host e' `backend`, e a decisao e' a mesma:
    // quem resolve o nome e' o servidor do Next, nao o navegador.
    expect(resolveMediaUrl("http://backend:9000/static/1699-hero.jpg")).toBe(
      "/uploads/1699-hero.jpg"
    )
  })

  it("imagem de terceiro sai intacta (o host é liberado no next.config.js)", () => {
    const unsplash = "https://images.unsplash.com/photo-1234?w=800"

    expect(resolveMediaUrl(unsplash)).toBe(unsplash)
  })

  it("campo vazio, ausente ou de outro tipo não vira `src`", () => {
    expect(resolveMediaUrl("")).toBeUndefined()
    expect(resolveMediaUrl("   ")).toBeUndefined()
    expect(resolveMediaUrl(undefined)).toBeUndefined()
    expect(resolveMediaUrl(null)).toBeUndefined()
    expect(resolveMediaUrl(42)).toBeUndefined()
    expect(resolveMediaUrl({ url: "/uploads/x.jpg" })).toBeUndefined()
  })

  it("espaço em volta não muda o que a loja pede", () => {
    expect(resolveMediaUrl("  /uploads/1699-hero.jpg  ")).toBe(
      "/uploads/1699-hero.jpg"
    )
  })
})
