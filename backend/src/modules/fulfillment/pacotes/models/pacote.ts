import { model } from "@medusajs/framework/utils"

/** A caixa de envio. O peso é o da embalagem **vazia**; o taxável é conta, não coluna. */
const Pacote = model.define("pacote", {
  id: model.id().primaryKey(),

  nome: model.text(),


  peso_gramas: model.number(),

  altura_cm: model.number(),
  largura_cm: model.number(),
  comprimento_cm: model.number(),

  /** Uma só, por índice único parcial. */
  padrao: model.boolean().default(false),


  ativo: model.boolean().default(true),
})

export default Pacote
