import type { Pacote } from "./pacotes"

/** O seed e o "Restaurar padrões" do painel — a mesma lista. */
export const PACOTES_PADRAO: Omit<Pacote, "id">[] = [
  {
    nome: "Envelope",
    peso_gramas: 150,
    altura_cm: 2,
    largura_cm: 20,
    comprimento_cm: 25,
    padrao: false,
    ativo: true,
  },
  {
    nome: "Caixa leve",
    peso_gramas: 250,
    altura_cm: 8,
    largura_cm: 16,
    comprimento_cm: 24,
    padrao: false,
    ativo: true,
  },
  {
    nome: "Caixa padrão",
    peso_gramas: 400,
    altura_cm: 10,
    largura_cm: 20,
    comprimento_cm: 30,
    padrao: true,
    ativo: true,
  },
  {
    nome: "Caixa padrão dupla",
    peso_gramas: 600,
    altura_cm: 15,
    largura_cm: 25,
    comprimento_cm: 35,
    padrao: false,
    ativo: true,
  },
  {
    nome: "Caixa volumosa",
    peso_gramas: 900,
    altura_cm: 20,
    largura_cm: 30,
    comprimento_cm: 40,
    padrao: false,
    ativo: true,
  },
  {
    nome: "Caixa grande",
    peso_gramas: 1400,
    altura_cm: 25,
    largura_cm: 35,
    comprimento_cm: 45,
    padrao: false,
    ativo: true,
  },
]
