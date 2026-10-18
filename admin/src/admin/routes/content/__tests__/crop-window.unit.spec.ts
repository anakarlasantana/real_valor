/**
 * A janela do recorte: o que cada gesto grava — o arrasto vira o ponto do meio,
 * o zoom para no teto, o valor sai canônico e o vazio vale o centro.
 */
import {
  CENTER_CROP,
  cropFromPoint,
  cropOf,
  fitFrame,
  pointFromCrop,
  ratioOf,
  ratioValue,
  slotBox,
  stepCrop,
  valueOf,
  variantBox,
  zoomCrop,
} from "../lib/crop-window"

describe("cropOf", () => {
  it("lê o valor gravado", () => {
    expect(cropOf("center:34:1.4")).toEqual({ x: "center", y: 34, z: 1.4 })
  })

  it("vazio, ausente ou ilegível é o centro da foto", () => {
    expect(cropOf(undefined)).toEqual(CENTER_CROP)
    expect(cropOf("")).toEqual(CENTER_CROP)
    expect(cropOf("esquerda:meio")).toEqual(CENTER_CROP)
    expect(cropOf(42)).toEqual(CENTER_CROP)
  })
})

describe("cropFromPoint", () => {
  it("o ponto arrastado vira o eixo do recorte", () => {
    expect(cropFromPoint({ x: 20, y: 80 })).toEqual({ x: 20, y: 80, z: 1 })
  })

  it("prende o ponto nas bordas da moldura", () => {
    expect(cropFromPoint({ x: -40, y: 160 })).toEqual({ x: 0, y: 100, z: 1 })
  })

  it("arredonda: o valor gravado é inteiro, e o campo não vira decimal", () => {
    expect(cropFromPoint({ x: 33.4, y: 66.6 })).toEqual({ x: 33, y: 67, z: 1 })
  })

  it("preserva o zoom em uso", () => {
    expect(cropFromPoint({ x: 50, y: 50 }, 2)).toEqual({ x: 50, y: 50, z: 2 })
  })
})

describe("pointFromCrop", () => {
  it("o centro é o meio da caixa", () => {
    expect(pointFromCrop(CENTER_CROP)).toEqual({ x: 50, y: 50 })
  })

  it("o inverso do `cropFromPoint`", () => {
    const point = { x: 20, y: 80 }

    expect(pointFromCrop(cropFromPoint(point))).toEqual(point)
  })
})

describe("o zoom", () => {
  it("para na faixa do contrato (1 a 3)", () => {
    expect(zoomCrop(CENTER_CROP, 9).z).toBe(3)
    expect(zoomCrop(CENTER_CROP, 0.2).z).toBe(1)
  })

  it("um degrau sobe e desce, e no teto não passa", () => {
    expect(stepCrop(CENTER_CROP, 1).z).toBe(1.25)
    expect(stepCrop({ ...CENTER_CROP, z: 1.25 }, -1).z).toBe(1)
    expect(stepCrop({ ...CENTER_CROP, z: 2.95 }, 1).z).toBe(3)
  })

  it("o degrau é fino perto do teto e grosso no começo", () => {
    expect(stepCrop({ ...CENTER_CROP, z: 2.5 }, 1).z).toBe(2.55)
    expect(stepCrop({ ...CENTER_CROP, z: 1.5 }, 1).z).toBe(1.75)
  })
})

describe("valueOf", () => {
  it("grava a forma canônica: sem zoom não há sufixo", () => {
    expect(valueOf(CENTER_CROP)).toBe("center:center")
    expect(valueOf({ x: 20, y: 34, z: 1 })).toBe("20:34")
    expect(valueOf({ x: 20, y: 34, z: 1.4 })).toBe("20:34:1.4")
  })

  it("ida e volta: o gravado é o que o modal abre", () => {
    for (const value of ["center:center", "0:100", "50:34:1.25"]) {
      expect(valueOf(cropOf(value))).toBe(value)
    }
  })
})

describe("slotBox: a janela única do modal", () => {
  it("escolhe a proporção **mais alta** entre os degraus", () => {
    // Hero: o celular abre em 320px (alto demais para a foto) e o monitor em
    // 1440/760. A janela fica com a do celular — a que mais corta.
    const box = slotBox([
      { label: "Celular", from: 320, height: 570 },
      { label: "Tela larga", from: 1024, height: 760 },
    ])

    expect(box).toEqual({ fit: "ratio", ratio: "0.9/1" })
  })

  it("degrau de proporção é a própria proporção", () => {
    expect(slotBox([{ label: "Sobre", from: 0, ratio: "5/6" }])).toEqual({
      fit: "ratio",
      ratio: "5/6",
    })
    expect(slotBox([{ label: "Instagram", from: 0, ratio: "1/1" }])).toEqual({
      fit: "ratio",
      ratio: "1/1",
    })
  })

  it("sem degraus, a foto inteira (`cover`)", () => {
    expect(slotBox([])).toEqual({ fit: "cover" })
  })

  it("`collections`: o card em pé (1/3) e o banner deitado (1/2)", () => {
    const frames = [
      { label: "Celular", from: 0, height: 450 },
      { label: "Tablet", from: 560, height: 520 },
      { label: "Tela larga", from: 1024, height: 650 },
    ]

    // A régua: o degrau de celular abre em 0 (largura da tela larga) e o de
    // tablet em 560px. Um terço da largura sobre 450 e 520 de altura dá o card
    // mais alto no tablet — 896 ÷ 3 ÷ 520 = 0.57.
    expect(variantBox(frames, "collections", "cards")).toEqual({
      fit: "ratio",
      ratio: "0.57/1",
    })
    // Dois banners lado a lado (metade da largura) no mesmo degrau.
    expect(variantBox(frames, "collections", "banners")).toEqual({
      fit: "ratio",
      ratio: "0.86/1",
    })
    // Ausente é o desenho de antes do campo: `cards`.
    expect(variantBox(frames, "collections")).toEqual(
      variantBox(frames, "collections", "cards"),
    )
  })

  it("a seção sem formato usa a moldura dela", () => {
    const hero = [{ label: "Celular", from: 0, height: 570 }]

    expect(variantBox(hero, "hero", "banners")).toEqual(slotBox(hero))
  })
})

describe("fitFrame: a moldura no maior tamanho que cabe no palco", () => {
  it("área larga e baixa limita pela altura", () => {
    expect(
      fitFrame({ fit: "ratio", ratio: "1.8/1" }, { width: 1600, height: 600 }),
    ).toEqual({ width: 1022, height: 568 })
  })

  it("área alta e estreita limita pela largura (o celular)", () => {
    expect(fitFrame({ fit: "cover" }, { width: 358, height: 900 })).toEqual({
      width: 326,
      height: 136,
    })
  })

  it("a moldura em pé (5/6) também encaixa", () => {
    expect(
      fitFrame({ fit: "ratio", ratio: "5/6" }, { width: 900, height: 500 }),
    ).toEqual({ width: 390, height: 468 })
  })

  it("área sem medida ainda não tem tamanho", () => {
    expect(fitFrame({ fit: "cover" }, { width: 0, height: 0 })).toBeUndefined()
  })
})

describe("ratioOf: a proporção como o CSS a escreve", () => {
  it("usa espaços em volta da barra", () => {
    expect(ratioOf({ fit: "ratio", ratio: "5/6" })).toBe("5 / 6")
    expect(ratioOf({ fit: "height", height: 760 })).toBe("1440 / 760")
    expect(ratioOf({ fit: "cover" })).toBe("24 / 10")
  })
})

describe("ratioValue: a proporção como número, para o calc do CSS", () => {
  it("divide os dois lados da mesma razão que o ratioOf escreve", () => {
    expect(ratioValue({ fit: "ratio", ratio: "1024/570" })).toBeCloseTo(
      1024 / 570,
      6,
    )
    expect(ratioValue({ fit: "height", height: 760 })).toBeCloseTo(
      1440 / 760,
      6,
    )
    expect(ratioValue({ fit: "cover" })).toBe(2.4)
  })

  it("não devolve NaN nem 0 numa razão torta", () => {
    // O valor entra num `calc(100cqh * x)` inline: `NaN`/`0` ali é uma largura
    // inválida, e a moldura voltaria a ser só as bordas — o defeito que este
    // número existe para consertar.
    expect(ratioValue({ fit: "ratio", ratio: "0/0" })).toBe(2.4)
    expect(ratioValue({ fit: "ratio", ratio: "" })).toBe(2.4)
  })
})
