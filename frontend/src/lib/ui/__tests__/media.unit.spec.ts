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
// `supported-sections.unit.spec.ts`, onde a mesma decisão está comentada).
import { describe, expect, it } from "vitest"

import { mediaImageProps, resolveMediaUrl } from "../media"

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

  it("a mesma URL com o prefixo do túnel na frente também vira caminho do site", () => {
    // Quando a loja é publicada por um endereço só (`make tunnel`), o
    // `MEDUSA_BACKEND_URL` do backend passa a ser `https://<tunel>/painel-api` e
    // o provider de arquivos monta a URL com esse namespace. O `/static/` deixa
    // de estar no começo do caminho — e a foto não pode sumir por isso.
    expect(
      resolveMediaUrl(
        "https://algo.ngrok-free.dev/painel-api/static/1699-hero.jpg"
      )
    ).toBe("/uploads/1699-hero.jpg")
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

/**
 * O par que os blocos espalham no `<Image>` — e o segundo elemento dele nasceu
 * de um defeito medido, não de simetria.
 *
 * `resolveMediaUrl` devolve o endereço de fora intacto (é o certo: a foto é a que
 * a lojista escolheu), e o `defaultLoader` do `next/image` **lança** para um host
 * que não está em `images.remotePatterns` — durante a renderização, no servidor.
 * O estrago não é daquela foto: é da página. Com o conteúdo real da loja (uma
 * foto colada do site antigo em `cdn.awsli.com.br`, no bloco de coleções) a home
 * respondia **HTTP 500**. Quem impede isso é a segunda metade do par.
 */
describe("mediaImageProps", () => {
  it("arquivo do próprio site é otimizado (upload, chave crua ou URL do backend)", () => {
    // É o caso que o otimizador existe para servir: `/uploads/...` é reescrito
    // para o backend pelo `next.config.js` e `/brand/...` vem no repositório.
    expect(mediaImageProps("1699999999-hero.jpg")).toEqual({
      src: "/uploads/1699999999-hero.jpg",
      unoptimized: false,
    })
    expect(mediaImageProps("/uploads/1699999999-hero.jpg")).toEqual({
      src: "/uploads/1699999999-hero.jpg",
      unoptimized: false,
    })
    expect(mediaImageProps("/brand/collection-1.jpg")).toEqual({
      src: "/brand/collection-1.jpg",
      unoptimized: false,
    })
    expect(
      mediaImageProps("http://localhost:9000/static/1699-hero.jpg")
    ).toEqual({ src: "/uploads/1699-hero.jpg", unoptimized: false })
  })

  it("foto de host de terceiro vai como veio e SEM otimizar", () => {
    // O caso medido, com o endereço real que derrubou a home.
    const doSiteAntigo =
      "https://cdn.awsli.com.br/1000x1000/899/899677/produto/399308871/calca.jpg"

    expect(mediaImageProps(doSiteAntigo)).toEqual({
      src: doSiteAntigo,
      unoptimized: true,
    })

    // E não há lista nenhuma a consultar: qualquer host de fora — inclusive os
    // que estão liberados hoje para o catálogo — é entregue como veio.
    expect(
      mediaImageProps("https://images.unsplash.com/photo-1234?w=800")
    ).toEqual({
      src: "https://images.unsplash.com/photo-1234?w=800",
      unoptimized: true,
    })
    expect(
      mediaImageProps(
        "https://hiatto.cdn.magazord.com.br/img/2025/09/produto/18684/blazer.png?ims=630x945"
      )
    ).toEqual({
      src: "https://hiatto.cdn.magazord.com.br/img/2025/09/produto/18684/blazer.png?ims=630x945",
      unoptimized: true,
    })
  })

  it("host de terceiro sem esquema também não vai ao otimizador", () => {
    // `//host/arquivo.jpg` começa com `/` e passaria por caminho do site: o
    // loader o trata como externo, com a mesma exceção de host não liberado.
    expect(mediaImageProps("//cdn.externo.com/foto.jpg")).toEqual({
      src: "//cdn.externo.com/foto.jpg",
      unoptimized: true,
    })
  })

  it("sem endereço não há imagem — e o bloco continua de pé", () => {
    expect(mediaImageProps("")).toBeUndefined()
    expect(mediaImageProps("   ")).toBeUndefined()
    expect(mediaImageProps(undefined)).toBeUndefined()
    expect(mediaImageProps(null)).toBeUndefined()
    expect(mediaImageProps(42)).toBeUndefined()
    expect(mediaImageProps({ url: "/uploads/x.jpg" })).toBeUndefined()
  })
})
