# Pacotes — as caixas de envio

A tabela que diz **de que tamanho e peso é cada volume** que sai da loja. É a
entrada da cotação do checkout e da etiqueta do SuperFrete.

## O problema que ele resolve

Nenhum produto do catálogo tem `weight` cadastrado. Sem peso, nenhuma
transportadora cota — e inventar um peso por peça seria mentira que vira prejuízo
na primeira devolução. A loja trabalha com **caixas**: uma camiseta vai no
envelope, um vestido na caixa padrão. O peso e as medidas vêm da embalagem, e é
isso que a transportadora cobra.

## A regra (função pura)

| Arquivo | O que decide |
| :--- | :--- |
| `pacotes.ts` | cubagem (volume ÷ 6000), peso taxável, limites dos Correios |
| `volumes.ts` | cada item ocupa a menor caixa que cabe nele |
| `defaults.ts` | as seis caixas de fábrica (seed e "Restaurar padrões") |
| `service.ts` | as regras de banco: padrão única, restauração idempotente |

**O peso cobrado é o maior entre o real e o cúbico.** 20×30×10 cm dão exatamente
1 kg cúbico; a caixa padrão de 400 g é cotada como 1 kg. Isso é o que a
transportadora faz, e subcobrar é o erro caro.

**Cada unidade de cada item vira um volume.** Somar tudo numa caixa só estouraria
os limites dos Correios num pedido de tamanco; embalar item por item nunca
subestima. Item com `peso_gramas` na variante escolhe a caixa pelo peso; hoje
todo o catálogo usa a caixa padrão.

## A caixa padrão

Uma só, garantida por **índice único parcial** no banco (`padrao = true`) — não
por convenção de código. Duas padrões dariam um preço que alterna entre
consultas, sem ninguém ter mexido em nada. Por isso:

- promover uma nova desmarca a anterior (`service.salvar`);
- a padrão não pode ser desativada (409 na API, botão desligado no painel);
- "Restaurar padrões" **nunca** troca a padrão escolhida pelo lojista.

## Onde se mexe

- **Painel:** Frete → Pacotes (`/frete/pacotes`).
- **API:** `GET`/`POST /admin/pacotes`, `PUT`/`DELETE /admin/pacotes/:id`,
  `POST /admin/pacotes/restaurar`.
- **DELETE desativa, não apaga:** a etiqueta de um pedido já enviado guarda o
  nome da caixa que ele usou.

## Instalação

```bash
make migrate   # cria a tabela `pacote`
make seed      # grava as seis caixas de fábrica
```

A migration é escrita à mão (`migrations/Migration20261018120000.ts`), como as
do módulo de conteúdo. O `make check-schema` confere o modelo contra o banco.
