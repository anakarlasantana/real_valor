/** O documento, conferido de verdade: o CPF inventado morre na etiqueta, não aqui. */
import {
  apenasDigitos,
  documentoDoDestinatario,
  documentoValido,
  formatarCep,
  formatarCepCompleto,
  formatarDocumento,
  formatarTelefone,
  lerDocumento,
} from "@rv/contrato";

/**
 * CPFs **oficiais**. O spec antigo usava `10000000091`, inventado, que só passava
 * por causa do bug do segundo dígito — o teste blindava o defeito.
 */
const CPF_VALIDO = "52998224725";
const CPF_VALIDO_MASCARADO = "529.982.247-25";
const CPF_VALIDO_OUTRO = "12345678909";
const CNPJ_VALIDO = "11222333000181";

describe("lerDocumento — CPF", () => {
  it("aceita o CPF com o dígito certo, com ou sem máscara", () => {
    expect(lerDocumento(CPF_VALIDO)).toEqual({
      valido: true,
      documento: { tipo: "CPF", numero: CPF_VALIDO },
    });

    // A máscara não muda o veredito.
    expect(lerDocumento(CPF_VALIDO_MASCARADO)).toEqual({
      valido: true,
      documento: { tipo: "CPF", numero: CPF_VALIDO },
    });
  });

  it("aceita os CPFs oficiais — o segundo dígito verificador também confere", () => {
    for (const cpf of [CPF_VALIDO, CPF_VALIDO_OUTRO, "11144477735"]) {
      expect(lerDocumento(cpf).valido).toBe(true);
    }
  });

  it("recusa o CPF com um dígito trocado", () => {
    const errado = "52998224724";
    const lido = lerDocumento(errado);

    expect(lido.valido).toBe(false);
    expect(lido).toEqual({
      valido: false,
      mensagem: "CPF inválido. Confira os números.",
    });
  });

  it("recusa o CPF de dígitos repetidos, que passa na conta do verificador", () => {
    for (const repetido of ["11111111111", "00000000000", "99999999999"]) {
      expect(lerDocumento(repetido).valido).toBe(false);
    }
  });

  it("compara os DOIS dígitos verificadores, não só o último", () => {
    // Só o último certo (`09`, de `12345678909`): conferir um só passaria.
    expect(lerDocumento("12345678900").valido).toBe(false);
    // Só o primeiro certo (`9`, de `52998224725`).
    expect(lerDocumento("52998224744").valido).toBe(false);
  });

  it("diz o que fazer quando o campo está vazio, em vez de chamar de inválido", () => {
    for (const vazio of ["", "   ", null, undefined, ".--"]) {
      expect(lerDocumento(vazio)).toEqual({
        valido: false,
        mensagem: "Informe o CPF.",
      });
    }
  });

  it("recusa tamanho que não é CPF nem CNPJ, dizendo quantos números cada um tem", () => {
    for (const curto of ["1234567890", "123456789012"]) {
      expect(lerDocumento(curto)).toEqual({
        valido: false,
        mensagem:
          "O CPF tem 11 números e o CNPJ tem 14. Confira o que foi digitado.",
      });
    }
  });
});

describe("lerDocumento — CNPJ", () => {
  it("aceita o CNPJ com o dígito certo", () => {
    expect(lerDocumento("11.222.333/0001-81")).toEqual({
      valido: true,
      documento: { tipo: "CNPJ", numero: CNPJ_VALIDO },
    });
  });

  it("recusa o CNPJ com o dígito errado", () => {
    expect(lerDocumento("11222333000182").valido).toBe(false);
  });
});

describe("formatarDocumento", () => {
  it("monta a máscara do CPF", () => {
    expect(formatarDocumento(CPF_VALIDO)).toBe("529.982.247-25");
  });

  it("monta a máscara do CNPJ", () => {
    expect(formatarDocumento(CNPJ_VALIDO)).toBe("11.222.333/0001-81");
  });

  it("formata o que já foi digitado, crescendo", () => {
    expect(formatarDocumento("")).toBe("");
    expect(formatarDocumento("529")).toBe("529");
    expect(formatarDocumento("5299")).toBe("529.9");
    expect(formatarDocumento("5299822")).toBe("529.982.2");
    // Até o 11º cabe CPF; do 12º em diante, CNPJ.
    expect(formatarDocumento("11222")).toBe("112.22");
    expect(formatarDocumento("1122233300")).toBe("112.223.330-0");
    expect(formatarDocumento("112223330001")).toBe("11.222.333/0001");
  });

  it("não inventa dígitos", () => {
    expect(formatarDocumento("123456789012345678")).toBe("12.345.678/9012-34");
  });
});

/** O atalho diz o mesmo que `lerDocumento`. */
describe("documentoValido", () => {
  it("concorda com o veredito completo", () => {
    expect(documentoValido(CPF_VALIDO)).toBe(true);
    expect(documentoValido("52998224724")).toBe(false);
  });
});

describe("documentoDoDestinatario", () => {
  it("devolve o formato do SuperFrete (type + number sem máscara)", () => {
    expect(documentoDoDestinatario("529.982.247-25")).toEqual({
      type: "CPF",
      number: CPF_VALIDO,
    });
  });

  it("devolve null para documento inválido — quem emite tem de recusar", () => {
    expect(documentoDoDestinatario("")).toBe(null);
    expect(documentoDoDestinatario("12345678900")).toBe(null);
  });
});

describe("apenasDigitos", () => {
  it("tira tudo que não é número, e não quebra com nulo", () => {
    expect(apenasDigitos(CPF_VALIDO_MASCARADO)).toBe(CPF_VALIDO);
    expect(apenasDigitos(CPF_VALIDO)).toBe(CPF_VALIDO);
    expect(apenasDigitos(undefined)).toBe("");
    expect(apenasDigitos({})).toBe("");
  });
});

describe("formatarCep", () => {
  it("põe o traço depois do quinto número", () => {
    expect(formatarCep("01310100")).toBe("01310-100");
    expect(formatarCep("01310-100")).toBe("01310-100");
    expect(formatarCep("1301000")).toBe("13010-00");
  });

  it("formata enquanto cresce, sem traço solto", () => {
    // O parcial fica inteiro: "0131" não vira "0131-".
    expect(formatarCep("0")).toBe("0");
    expect(formatarCep("01310")).toBe("01310");
    expect(formatarCep("013101")).toBe("01310-1");
  });

  it("não aceita mais que oito números", () => {
    expect(formatarCep("013101009999")).toBe("01310-100");
  });
});

describe("formatarCepCompleto", () => {
  it("devolve o CEP só quando ele tem os oito números", () => {
    expect(formatarCepCompleto("01310100")).toBe("01310-100");
    expect(formatarCepCompleto("0131010")).toBe(null);
    expect(formatarCepCompleto("")).toBe(null);
    expect(formatarCepCompleto(undefined)).toBe(null);
  });
});

describe("formatarTelefone", () => {
  it("monta o celular com o nono dígito", () => {
    expect(formatarTelefone("11912345678")).toBe("(11) 91234-5678");
  });

  it("monta o fixo com oito dígitos", () => {
    expect(formatarTelefone("1134567890")).toBe("(11) 3456-7890");
  });

  it("formata enquanto cresce, sem inventar parêntese nem traço", () => {
    expect(formatarTelefone("")).toBe("");
    expect(formatarTelefone("11")).toBe("11");
    expect(formatarTelefone("119")).toBe("(11) 9");
    expect(formatarTelefone("11912345")).toBe("(11) 9123-45");
  });

  it("não duplica a máscara de quem já veio formatado", () => {
    expect(formatarTelefone("(11) 91234-5678")).toBe("(11) 91234-5678");
    // E não passa dos onze números.
    expect(formatarTelefone("119123456789999")).toBe("(11) 91234-5678");
  });
});
