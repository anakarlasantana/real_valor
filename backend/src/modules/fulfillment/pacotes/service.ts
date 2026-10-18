import { MedusaService } from "@medusajs/framework/utils"

import PacoteModel from "./models/pacote"
import { PACOTES_PADRAO } from "./defaults"
import { comPadraoUnico, problemasDaCaixa, type Pacote } from "./pacotes"
import { calcularVolumes, type CalculoDeVolumes, type ItemDoPedido } from "./volumes"


class PacotesModuleService extends MedusaService({ Pacote: PacoteModel }) {
  async listar(somenteAtivos = false): Promise<Pacote[]> {
    const pacotes = (await this.listPacotes(
      somenteAtivos ? { ativo: true } : {},
      { order: { peso_gramas: "ASC" } }
    )) as Pacote[]

    return pacotes.sort((a, b) => Number(b.padrao) - Number(a.padrao))
  }

  async salvar(entrada: Partial<Pacote> & { id?: string }): Promise<Pacote> {
    const problemas = problemasDaCaixa(entrada as any)

    if (problemas.length > 0) {
      throw new Error(problemas.join(" "))
    }

    if (entrada.id) {
      const atual = (await this.listPacotes({ id: entrada.id })) as Pacote[]

      if (atual.length === 0) {
        throw new Error("Pacote não encontrado.")
      }

      if (entrada.padrao) {
        await this.unicaPadrao(entrada.id)
      }

      return (await this.updatePacotes({
        id: entrada.id,
        ...camposDaCaixa(entrada),
      })) as Pacote
    }

    // A primeira é a padrão: sem nenhuma, a cotação não tem o que usar.
    const existentes = await this.listPacotes()
    const padrao = entrada.padrao ?? existentes.length === 0

    if (padrao) {
      await this.unicaPadrao("")
    }

    return (await this.createPacotes({
      ...camposDaCaixa(entrada),
      padrao,
    })) as Pacote
  }

  async restaurarPadroes(): Promise<{ criados: number }> {
    const existentes = (await this.listPacotes()) as Pacote[]
    const nomes = new Set(existentes.map((pacote) => pacote.nome))
    const faltando = PACOTES_PADRAO.filter((pacote) => !nomes.has(pacote.nome))

    // Reconcilia sempre: uma base sem padrão (apagada à mão) ficaria assim.
    const padraoAtual = existentes.find((pacote) => pacote.padrao)
    const marcouAgora = !padraoAtual && Boolean(
      existentes.find(
        (pacote) =>
          pacote.nome === PACOTES_PADRAO.find((p) => p.padrao)?.nome
      )
    )

    if (!padraoAtual) {
      const daLista = PACOTES_PADRAO.find((pacote) => pacote.padrao)
      const existente = existentes.find(
        (pacote) => pacote.nome === daLista?.nome
      )

      if (existente) {
        await this.updatePacotes({ id: existente.id, padrao: true })
      }
    }

    if (faltando.length === 0) {
      return { criados: 0 }
    }

    // O índice único recusaria a segunda: restauração não troca a padrão do lojista.
    const semPadrao = !padraoAtual && !marcouAgora

    await this.createPacotes(
      faltando.map((pacote) => ({
        ...pacote,
        padrao: semPadrao && pacote.padrao,
      }))
    )

    return { criados: faltando.length }
  }


  async volumesDoPedido(itens: ItemDoPedido[]): Promise<CalculoDeVolumes> {
    return calcularVolumes(itens, await this.listar(true))
  }

  private async unicaPadrao(id: string): Promise<void> {
    const pacotes = (await this.listPacotes({ padrao: true })) as Pacote[]
    const outras = pacotes.filter((pacote) => pacote.id !== id)

    if (outras.length === 0) {
      return
    }

    for (const pacote of comPadraoUnico(outras, "")) {
      await this.updatePacotes({ id: pacote.id, padrao: false })
    }
  }
}

/** Só o que o formulário pode mudar. */
function camposDaCaixa(entrada: Partial<Pacote>): Partial<Pacote> {
  return {
    nome: entrada.nome,
    peso_gramas: entrada.peso_gramas,
    altura_cm: entrada.altura_cm,
    largura_cm: entrada.largura_cm,
    comprimento_cm: entrada.comprimento_cm,
    padrao: entrada.padrao,
    ativo: entrada.ativo,
  }
}

export default PacotesModuleService
