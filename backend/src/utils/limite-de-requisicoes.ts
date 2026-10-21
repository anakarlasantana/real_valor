/** O limitador de requisições: janela deslizante em memória, por chave. */

export type Janela = { limite: number; janelaMs: number }

/** O veredito de uma tentativa; `restantes` é o que sobra depois dela. */
export type Veredito = {
  permitido: boolean
  restantes: number
  esperarSegundos: number
}

/** O teto de chaves antes de varrer as vencidas: sem isso o mapa só cresce. */
const VARREDURA_A_CADA = 500

type Historico = Map<string, number[]>

export function criarLimitador(janela: Janela) {
  let marcas: Historico = new Map()
  let entradas = 0

  /** Registra uma tentativa da chave e diz se ela passa. */
  function tentar(chave: string, agora: number = Date.now()): Veredito {
    entradas += 1

    // A varredura vem antes do registro: feita depois, a chave que acabou de
    // tentar perderia o histórico e ganharia a cota de volta.
    if (entradas % VARREDURA_A_CADA === 0) {
      varrer(agora)
    }

    const anteriores = (marcas.get(chave) ?? []).filter(
      (marca) => marca > agora - janela.janelaMs
    )

    if (anteriores.length >= janela.limite) {
      marcas.set(chave, anteriores)

      // Só libera quando a marca mais antiga sai da janela: é o que a faz
      // deslizante, e não um balde que zera de hora em hora.
      const falta = anteriores[0] + janela.janelaMs - agora

      return {
        permitido: false,
        restantes: 0,
        esperarSegundos: Math.max(1, Math.ceil(falta / 1000)),
      }
    }

    anteriores.push(agora)
    marcas.set(chave, anteriores)

    return {
      permitido: true,
      restantes: janela.limite - anteriores.length,
      esperarSegundos: 0,
    }
  }

  /** Descarta as chaves sem nenhuma marca dentro da janela. */
  function varrer(agora: number) {
    const inicio = agora - janela.janelaMs
    const proximo: Historico = new Map()

    for (const [chave, valor] of marcas) {
      const vivas = valor.filter((marca) => marca > inicio)

      if (vivas.length > 0) {
        proximo.set(chave, vivas)
      }
    }

    marcas = proximo
  }

  function tamanho(): number {
    return marcas.size
  }

  function limpar() {
    marcas = new Map()
    entradas = 0
  }

  return { tentar, varrer, tamanho, limpar }
}

export function chaveDoPedido(cabecalhos: {
  forwarded?: unknown
  ip?: string
}): string {
  const bruto = cabecalhos.forwarded

  // O cabeçalho vem do cliente e dos proxies na mesma linha: o primeiro salto
  // é de quem chamou, e confiar nele deixa escolher a própria chave.
  if (typeof bruto === "string" && bruto.trim()) {
    const saltos = bruto
      .split(",")
      .map((salto) => salto.trim())
      .filter(Boolean)
    const ultimo = saltos[saltos.length - 1]

    if (ultimo) {
      return ultimo
    }
  }

  return cabecalhos.ip?.trim() || "desconhecido"
}

/** As regras por prefixo de rota; o prefixo mais longo vence. */
export const REGRAS_DE_LIMITE: readonly { prefixo: string; janela: Janela }[] = [
  // A cotação gasta a carteira do SuperFrete: 20 em cinco minutos cobrem três CEPs.
  { prefixo: "/store/shipping", janela: { limite: 20, janelaMs: 5 * 60_000 } },
  // O provedor reenvia webhook em rajada: alto, para não perder evento.
  { prefixo: "/webhooks/", janela: { limite: 120, janelaMs: 60_000 } },
  { prefixo: "/store/checkout", janela: { limite: 30, janelaMs: 60_000 } },
  { prefixo: "/internal/", janela: { limite: 120, janelaMs: 60_000 } },
]
/** A regra que vale para um caminho — a de prefixo mais longo, ou nenhuma. */
export function regraPara(caminho: string): Janela | undefined {
  const candidatas = REGRAS_DE_LIMITE.filter(({ prefixo }) =>
    caminho.startsWith(prefixo)
  ).sort((a, b) => b.prefixo.length - a.prefixo.length)

  return candidatas[0]?.janela
}
