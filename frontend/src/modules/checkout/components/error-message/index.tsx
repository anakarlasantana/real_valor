/**
 * A mensagem de erro de um passo do checkout.
 *
 * Ela era `text-rose-500` — o vermelho de outra paleta, e uma segunda régua dentro
 * do `brand.css` (classe de utilitário ganha do `brand.css`, que é importado antes
 * dos utilitários). Agora é o `--rv-danger` da casa, o mesmo do CEP inválido na
 * página da peça: erro tem uma cor só, e ela vem do tema.
 *
 * O `role="alert"` é deliberado: esta caixa só existe **depois** do clique que não
 * deu certo, e sem ele quem usa leitor de tela não fica sabendo que a página
 * respondeu — o foco continua parado no botão do passo.
 */
const ErrorMessage = ({
  error,
  "data-testid": dataTestid,
}: {
  error?: string | null
  "data-testid"?: string
}) => {
  if (!error) {
    return null
  }

  return (
    <p className="rv-form-error" data-testid={dataTestid} role="alert">
      <span>{error}</span>
    </p>
  )
}

export default ErrorMessage
