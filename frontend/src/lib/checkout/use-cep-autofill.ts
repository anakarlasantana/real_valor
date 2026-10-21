"use client"

/**
 * A busca de CEP de um formulário de endereço — entrega e cobrança, a mesma.
 * Guarda o aviso, o erro e a diferença entre "veio do CEP" e "ela digitou": o
 * CEP preenche o que ela não escreveu e não apaga o que ela escreveu.
 * RV-041 em `19-debito-tecnico.md`.
 */
import { CEP_DIGITOS, formatarCep } from "@rv/contrato"
import type { EnderecoDoCep, ResultadoCep } from "@rv/contrato"
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from "react"

/** Quem busca — injetado porque R-C não deixa `lib/checkout` importar `lib/data`. */
export type BuscaCep = (
  cep: string,
  opcoes: { signal: AbortSignal }
) => Promise<ResultadoCep>
import { enderecoDoCep, type CampoDigitado } from "./endereco-pelo-cep"

/** O CEP respondeu que não existe: é para conferir o número digitado. */
export const AVISO_CEP_NAO_ENCONTRADO = "CEP não encontrado. Confira os números."

/** Ninguém respondeu (rede, prazo, provedor fora): o formulário segue digitável. */
export const AVISO_CEP_INDISPONIVEL =
  "Não foi possível buscar o CEP agora. Preencha o endereço à mão."

export type PrefixoDoEndereco = "shipping_address" | "billing_address"

type Formulario = Record<string, any>

export type CepAutofill = {
  buscandoCep: boolean
  erroCep: string | null
  registrarDigitacao: (nome: string, valor: string) => void
  /** O formulário recarregou do carrinho: o que está nos campos é do carrinho. */
  esquecerDigitacao: () => void
  /** No `onChange` do CEP: busca no oitavo dígito, sem esperar o `blur`. */
  aoMudarCep: (valor: string) => void
  /** No `blur` do CEP: autofill nem sempre passa pelo `onChange`. */
  aoSairCep: (valor: string) => void
  /** Enter também busca — o formulário não tem botão de buscar. */
  aoTeclarCep: (evento: KeyboardEvent<HTMLInputElement>) => void
}

export function useCepAutofill(
  prefixo: PrefixoDoEndereco,
  setFormData: Dispatch<SetStateAction<Formulario>>,
  opcoes: {
    buscarCep: BuscaCep
    aoPreencher?: (endereco: EnderecoDoCep) => void
  }
): CepAutofill {
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [erroCep, setErroCep] = useState<string | null>(null)

  /** O último CEP buscado: o `blur` depois do oitavo dígito não repete. */
  const cepCarregadoRef = useRef("")
  /** Qual busca é a atual: a resposta de um CEP antigo não pisa na de um novo. */
  const requisicaoRef = useRef(0)
  const digitadoRef = useRef<Record<string, string>>({})
  /** Quantas buscas já preencheram bairro/cidade/UF. `0` = o campo é dela. */
  const buscasRef = useRef(0)

  const controleRef = useRef<AbortController | null>(null)
  const vivoRef = useRef(true)

  /** A cliente saiu no meio da busca: nem gravar estado, nem segurar a conexão. */
  useEffect(
    () => () => {
      vivoRef.current = false
      controleRef.current?.abort()
    },
    []
  )

  // `aoPreencher` muda de identidade a cada render; a ref evita recriar `preencher`.
  const aoPreencherRef = useRef(opcoes.aoPreencher)
  const buscarRef = useRef(opcoes.buscarCep)

  useEffect(() => {
    aoPreencherRef.current = opcoes.aoPreencher
    buscarRef.current = opcoes.buscarCep
  }, [opcoes.aoPreencher, opcoes.buscarCep])

  const campoDigitado = (campo: keyof CampoDigitado): boolean =>
    campo === "address_1"
      ? Boolean(digitadoRef.current.address_1)
      : buscasRef.current === 0

  const registrarDigitacao = (nome: string, valor: string) => {
    if (!nome.startsWith(`${prefixo}.`)) return

    const campo = nome.slice(prefixo.length + 1)

    digitadoRef.current[campo] = valor

    // Mexeu em bairro/cidade/UF: esses três passam a ser dela, não do CEP.
    if (campo === "bairro" || campo === "city" || campo === "province") {
      buscasRef.current = 0
    }
  }

  const esquecerDigitacao = () => {
    digitadoRef.current = {}
    buscasRef.current = 0
  }

  const preencher = async (cepDigitado: string) => {
    const cep = formatarCep(cepDigitado).replace(/\D/g, "")

    // CEP incompleto, ou o mesmo que já está na tela: não refaz o pedido.
    if (cep.length !== CEP_DIGITOS || cepCarregadoRef.current === cep) return

    cepCarregadoRef.current = cep

    const pedido = ++requisicaoRef.current

    // Outro CEP foi pedido: a resposta do anterior não interessa mais.
    controleRef.current?.abort()
    const controle = new AbortController()
    controleRef.current = controle

    setErroCep(null)
    setBuscandoCep(true)

    try {
      const resultado = await buscarRef.current(cep, { signal: controle.signal })

      if (!vivoRef.current || pedido !== requisicaoRef.current) return

      if (!resultado.encontrado) {
        // Deixa tentar de novo: rede fora não é "este CEP não tem endereço".
        cepCarregadoRef.current = ""

        setErroCep(
          resultado.motivo === "cep-inexistente"
            ? AVISO_CEP_NAO_ENCONTRADO
            : AVISO_CEP_INDISPONIVEL
        )
        return
      }

      const { endereco } = resultado

      setFormData((prev: Formulario) => {
        const preenchido = enderecoDoCep(
          {
            address_1: prev[`${prefixo}.address_1`] || "",
            bairro: prev[`${prefixo}.bairro`] || "",
            city: prev[`${prefixo}.city`] || "",
            province: prev[`${prefixo}.province`] || "",
          },
          endereco,
          {
            address_1: campoDigitado("address_1"),
            bairro: campoDigitado("bairro"),
            city: campoDigitado("city"),
            province: campoDigitado("province"),
          }
        )

        return {
          ...prev,
          [`${prefixo}.address_1`]: preenchido.address_1,
          [`${prefixo}.bairro`]: preenchido.bairro,
          [`${prefixo}.city`]: preenchido.city,
          [`${prefixo}.province`]: preenchido.province,
        }
      })

      // A partir daqui, bairro/cidade/UF nos campos são do CEP, não da cliente.
      buscasRef.current += 1

      // O componente decide onde o cursor vai depois (o número da casa, por ex.).
      aoPreencherRef.current?.(endereco)
    } catch (erro) {
      // `buscarCep` não lança: se algo escapar, é defeito nosso. A tela diz isso
      // e o console guarda a linha — antes a falha sumia sem uma nem outra.
      console.error("[cep] falha ao preencher o endereço", erro)

      if (vivoRef.current && pedido === requisicaoRef.current) {
        setErroCep(AVISO_CEP_INDISPONIVEL)
      }
    } finally {
      // Só a busca atual apaga o aviso: a resposta velha não some com o da nova.
      if (vivoRef.current && pedido === requisicaoRef.current) {
        setBuscandoCep(false)
      }
    }
  }

  const aoMudarCep = (valor: string) => {
    // Autofill e Enter não disparam `blur`; a ref impede repetir a cada tecla.
    if (formatarCep(valor).replace(/\D/g, "").length === CEP_DIGITOS) {
      void preencher(valor)
    }
  }

  const aoSairCep = (valor: string) => {
    void preencher(valor)
  }

  const aoTeclarCep = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key !== "Enter") return

    evento.preventDefault()
    void preencher(evento.currentTarget.value)
  }

  return {
    buscandoCep,
    erroCep,
    registrarDigitacao,
    esquecerDigitacao,
    aoMudarCep,
    aoSairCep,
    aoTeclarCep,
  }
}
