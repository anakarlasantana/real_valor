/**
 * O aviso do meio de pagamento de teste — o `pp_system_default`, que cria pedido
 * sem cobrar nada e só aparece em desenvolvimento.
 *
 * Ele era um `Badge` laranja do design system com o texto em inglês, em duas
 * versões (uma para o desktop, uma para o celular). As duas versões saíram: o aviso
 * vive dentro da linha da opção, que já é responsiva, e um aviso de
 * desenvolvimento não precisa de dois desenhos. O laranja também saiu — na loja,
 * laranja não é uma cor, e o `--rv-danger` diz "cuidado" com a cor que a casa tem
 * para isso.
 *
 * Este componente **não vai para produção**: o `payment-container` só o monta
 * quando `NODE_ENV === "development"` e o meio é o manual. O item 1 do "Antes de ir
 * para produção" (README do backend) é remover o meio manual; este arquivo sai com
 * ele.
 */
const PaymentTest = ({ className }: { className?: string }) => {
  return (
    <span className={className ? `rv-dev-note ${className}` : "rv-dev-note"}>
      Atenção: apenas para testes.
    </span>
  )
}

export default PaymentTest

