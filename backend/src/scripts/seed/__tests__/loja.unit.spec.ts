/** O mínimo da loja: o que o seed cria e o que ele **não** cria. */
import {
  CANAL_ONLINE,
  ENDERECO_ORIGEM,
  PACOTE_PADRAO,
  SERVICOS_MINIMOS,
} from "../loja"

describe("mínimo da loja", () => {
  it("um canal só, o do storefront", () => {
    expect(CANAL_ONLINE).toBe("Loja Online Real Valor")
  })

  it("a origem da cotação é Fortaleza/CE, com CEP", () => {
    expect(ENDERECO_ORIGEM).toMatchObject({
      city: "Fortaleza",
      province: "CE",
      postal_code: "60352-680",
      country_code: "BR",
    })
    expect(ENDERECO_ORIGEM.address_1).toContain("388")
  })

  it("três serviços, todos dos Correios", () => {
    expect(SERVICOS_MINIMOS.map((servico) => servico.servico)).toEqual([
      "PAC",
      "SEDEX",
      "MINI",
    ])
  })

  it("Jadlog, J&T e Loggi nascem fora do seed", () => {
    const servicos = SERVICOS_MINIMOS.map((servico) => servico.servico)

    for (const fora of ["JADLOG", "JNT", "LOGGI"]) {
      expect(servicos).not.toContain(fora)
    }
  })

  it("uma caixa, e é a padrão", () => {
    expect(PACOTE_PADRAO.padrao).toBe(true)
    expect(PACOTE_PADRAO.nome).toBe("Caixa padrão")
  })
})
