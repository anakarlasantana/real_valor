# Frete — módulo `tabela`

O primeiro provider de frete que **calcula** preço na Real Valor. Ele existe por dois motivos ao
mesmo tempo:

1. **Entrega frete automático agora.** O `seed.ts` cria PAC e SEDEX com **preço fixo**, que não olha
   o peso da peça nem o destino — duas roupas e um sofá saem pelo mesmo valor. Com este provider, o
   preço acompanha o pedido.
2. **Prova que a arquitetura de plug-in funciona, antes de existir transportadora.** Quando a
   transportadora for escolhida, ela entra como **outro** provider, ao lado deste — e **nenhum
   consumidor muda**: carrinho, checkout, painel de envio e página de rastreio leem
   `StoreCartShippingOption`, que é uniforme por definição.

---

## ⚠️ Os valores desta tabela são FICTÍCIOS

`tabela.ts` tem números de exemplo, escolhidos só para deixar o cálculo verificável de ponta a ponta.
**Não é preço de transportadora nenhuma.** Estão marcados assim no arquivo porque é fácil um número
falso virar verdade depois de três semanas.

Trocar por valores reais é **uma edição em `tabela.ts`** e nada mais — é o único lugar onde a regra
comercial está escrita.

---

## Por que dois arquivos

| Arquivo | O que é | Por que separado |
| :--- | :--- | :--- |
| `tabela.ts` | Funções puras: região, faixa e preço | Testável sem banco, sem Medusa e sem carrinho. É a **regra comercial**, e ela precisa poder ser conferida contra a transportadora real |
| `service.ts` | O `ModuleProvider` que o Medusa chama | Só traduz a entrada do Medusa para a função e a saída de volta |
| `index.ts` | O registro | O ponto único de plug-in |

A separação é o que permite trocar a transportadora depois **sem reescrever a regra** — e o que
permite testar a regra hoje, sem esperar ninguém escolher nada.

---

## Como está ligado

`medusa-config.ts` registra o provider como item da lista `providers` do **módulo FULFILLMENT**:

```ts
{
  resolve: "@medusajs/medusa/fulfillment",
  options: {
    providers: [
      { resolve: "@medusajs/medusa/fulfillment-manual", id: "manual" },
      { resolve: "./src/modules/fulfillment/tabela", id: "tabela" },
    ],
  },
},
```

**A lista precisa ser completa — repare no `manual` estar ali.** O `defineConfig` resolve os módulos
num reduce que termina em `acc[serviceName] = moduleConfig`: o **último** registro do mesmo módulo
vence. Ou seja, declarar `{ resolve: "./src/modules/fulfillment/tabela" }` direto na lista `modules`
não acrescenta um provider — ele **substitui** a configuração padrão do FULFILLMENT e o backend nem
sobe (`defaultExport.service` é `undefined` num `ModuleProvider`, que não é um módulo).

E, ao declarar o módulo, a lista `providers` precisa vir **inteira**: o loader do FULFILLMENT
sincroniza o banco a cada boot, e tudo que está no banco mas **fora** da lista é **desabilitado**
(`providersToDisable` no `@medusajs/fulfillment`). Tirar o `manual` daqui desligaria as PAC/SEDEX do
`seed` — e isso **não dá erro**: a loja simplesmente abre sem nenhuma opção de frete.

**Ele fica inativo até uma shipping option ser criada para ele** no Admin — registrar o provider não
cria opção nenhuma. Isso é deliberado: não queremos valores fictícios aparecendo na loja enquanto não
forem reais. O `seed.ts` continua criando PAC e SEDEX, e as duas coisas convivem: o carrinho mostra
só as opções que existem.

### Para ativar (depois de colocar valores reais)

No Admin do Medusa (**Admin → Configurações → Localizações e Envios → Opções de envio**):

| Campo | Valor |
| :--- | :--- |
| Nome | `Entrega nacional` |
| **Tipo de preço** | **`Calculado`** ← o que faz o Medusa chamar `calculatePrice` |
| Provider | `tabela` |
| Perfis de envio | o perfil de vestuário (criado pelo seed) |

Salvar. A opção passa a aparecer no checkout, e o preço é calculado por CEP e peso.

## A regra, e onde ela vai ser trocada

**Peso × região**, em centavos:

- **Peso:** `context.items[].variant.weight`, em gramas, somado por item (`weight × quantity`).
  Peso zerado ou ausente cai na faixa mais barata — um produto sem peso não pode custar mais que um leve.
- **Região:** pelo **primeiro dígito do CEP** (`context.shipping_address.postal_code`):

| Dígito | Região | Estados |
| :--- | :--- | :--- |
| 0-2 | `sudeste` | SP, RJ, ES, MG |
| 3-4 | `sul` | PR, SC, RS, e parte de MG pela regra do dígito |
| 5-6 | `nordeste` | PE, AL, PB, RN, CE, PI, SE, MA |
| 7 | `nordeste` | BA **e** GO/MT/MS/DF — ver a limitação |
| 8-9 | `norte` | AM, PA, RR, AP, RO, AC |

> **Limitação declarada, não esquecimento.** O dígito **7** cobre Nordeste *e* Centro-Oeste — nenhum
> outro dígito separa os dois. A função escolhe Nordeste, e há teste fixando essa escolha para que
> ninguém descubra depois. A regra de duas casas (que é o que a transportadora real vai fornecer)
> resolve isso; para valores fictícios, o dígito basta.

**Falha, não 0.** CEP inválido ou peso acima de 20kg **lança erro** em vez de devolver 0 — porque 0 na
tela é um frete grátis que a loja paga. A opção sai da lista, que é o comportamento honesto para um
destino que não atendemos.

---

## O que NÃO está aqui, de propósito

**Etiqueta de rastreio.** `createFulfillment` devolve `{ data: {}, labels: [] }` — sem PDF. Uma etiqueta
viria em formato de uma transportadora que a loja ainda não tem. O código de rastreio entra pelo
**painel de envio** (`/painel` → **Envios**), que é genérico e não depende de transportadora.

**Atualização de preço depois do checkout.** O Medusa resolve preço, mas **não existe webhook de
frete**: se a transportadora mudar o preço depois da cliente pagar, a loja **não descobre**. Com a
tabela isso não acontece (a regra é nossa e não muda); com API de transportadora, passa a ser um
processo de conciliação manual. **É uma decisão consciente, e vale revisar quando houver transportadora.**

---

## Como plugar uma transportadora de verdade

Três métodos, e um registro. O resto do sistema não muda.

```
backend/src/modules/fulfillment/<transportadora>/
  service.ts     <- a implementação
  index.ts       <- ModuleProvider(Modules.FULFILLMENT, { services: [...] })
```

Os métodos que o Medusa chama:

| Método | Devolve | Quando |
| :--- | :--- | :--- |
| `getFulfillmentOptions()` | `[{ id, name, is_return? }]` | Admin, ao criar a opção |
| `canCalculate(data)` | `boolean` | Se o preço é calculado |
| `calculatePrice(optionData, data, context)` | `{ calculated_amount, is_calculated_price_tax_inclusive }` | No checkout, a cada cálculo |

**O que entra em `context`** (verificado em `@medusajs/types`, `fulfillment/common/cart.d.ts`):

```ts
{
  shipping_address: { postal_code, city, province, country_code },
  items: [{ quantity, variant: { weight, length, height, width } }]
}
```

**Em centavos.** `calculated_amount` é em centavos. Um erro de unidade aqui é um frete 100× errado, e é
a classe de erro mais difícil de enxergar numa tela.

Depois: **somar** a transportadora à lista `providers` do item FULFILLMENT em `medusa-config.ts`
(sem mexer no `manual`, e sem tirar a tabela se as duas convivem), criar a shipping option no Admin
com `price_type: "calculated"`, e **desligar** a tabela no Admin se ela não for mais usada. O painel de envio e a página
`/rastreio` não mudam — `carrier` lá é texto livre, de propósito.

---

## Testes

`__tests__/tabela.unit.spec.ts` — 17 testes sobre a regra. Fixam o que é fácil quebrar em silêncio:

- **a unidade é centavo** (um `16,90` no lugar de `1690` passa despercebido numa tela);
- **não há buraco na tabela** (um `undefined` vira `NaN` no checkout, que não dá erro, não quebra o
  build e só some);
- **preço cresce com o peso, em toda região**;
- **peso ausente não vira preço alto**;
- **a escolha do dígito 7 fica registrada**;
- **CEP e peso inválidos falham em vez de devolver 0**.
