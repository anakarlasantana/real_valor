/**
 * A queda percentual entre o preço cheio e o preço de agora — "38", para "-38%".
 *
 * `toFixed()` sem argumento devolve **inteiro**, e é isso que o rótulo quer:
 * "-38%" e não "-38,4%". (Se um dia a casa decimal entrar, ela tem de ser
 * separada por vírgula — a loja é pt-BR e o `toFixed` separa por ponto.)
 *
 * A guarda de `original` existe para o dia em que a variante não tiver
 * `original_amount`: sem ela, a conta daria `NaN` e o card mostraria "-NaN%". O
 * desconto de quem não tinha preço cheio é **nenhum**, e é isso que ele devolve.
 */
export const getPercentageDiff = (original: number, calculated: number) => {
  if (!original || original <= 0) {
    return "0"
  }

  const diff = original - calculated
  const decrease = (diff / original) * 100

  return decrease.toFixed()
}
