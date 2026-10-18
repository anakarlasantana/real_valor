# SuperFrete — a cotação e a etiqueta

O provider de frete que fala com a API do SuperFrete e cota **PAC, SEDEX e Mini
Envios**. É ele que responde ao `calculatePrice` do Medusa no checkout.

## Os arquivos

| Arquivo | O que faz |
| :--- | :--- |
| `catalogo.ts` | os 6 códigos da calculadora (1, 2, 17, 3, 33, 31), teto de peso por transportadora, conversão de unidades, leitura da resposta |
| `cliente.ts` | o `fetch` com token, ambiente, `User-Agent` e erro com status |
| `servico.ts` | caixa (do módulo `pacotes`) + API → cotação, com cache de 5 min; `testarCotacao` cota sem cache |
| `servicos.ts` | lê as opções de envio (`data.servico` ou `type.code`) e liga/desliga pela regra `enabled_in_store` |
| `service.ts` | o `AbstractFulfillmentProviderService` (`calculatePrice`) |
| `etiqueta.ts` | `/cart` + `/checkout`, cancelamento, PDF, saldo — com o cliente injetado |
| `pedido.ts` | traduz o pedido do Medusa (endereço, CPF, itens) para a etiqueta |
| `index.ts` | o `ModuleProvider` do fulfillment |

## A etiqueta (F2)

`POST /admin/shipping/:id/etiqueta` cria e **paga** a etiqueta com o saldo da
carteira; `GET .../etiqueta/pdf` devolve o link do PDF e
`POST .../etiqueta/cancelar` estorna para a carteira. `GET /admin/shipping/saldo`
mostra o saldo antes do clique.

Três armadilhas da API (medidas em `superfrete.readme.io`):

1. **São duas chamadas.** `/api/v0/cart` cria a etiqueta `pending`; só
   `/api/v0/checkout` paga e a deixa `released`. Sem a segunda, a etiqueta
   existe e não sai.
2. **Falha no pagamento não é falha na criação.** O erro devolve o `id` para o
   próximo clique pagar aquela etiqueta — recriar cobraria duas.
3. **`/tag/print` devolve link assinado**, não o PDF: quem baixa é o navegador.


## Os serviços (F2b)

`GET /admin/shipping/servicos` lista as opções do provider com o serviço que cada
uma cota; `PUT` liga/desliga (sempre ao menos uma) pela regra `enabled_in_store` —
o Medusa tira a desligada do checkout sem apagar o histórico. `POST
/admin/shipping/testar` cota com a caixa padrão **sem cache e sem gravar nada**;
com `{ "todos": true }` cota também as desligadas, que é como se descobre se a
Jadlog cotaria antes de ligá-la.

A tela é **"Serviços de frete"**, não um catálogo do SuperFrete: a API não tem
rota que liste serviços (só cotação, etiqueta, pacotes, usuário e webhook), então
só aparece ali o que o seed criou. Os 6 existem no `catalogo.ts`; o seed cria os
três Correios ligados e **Jadlog, J&T e Loggi desligados**, porque dependem de
ponto de postagem e de configuração na conta.

O teto de peso **não** é o mesmo para todas: J&T para em 11 kg; as demais, 30 kg.
Criar uma caixa acima de 11 kg faz a J&T sumir do checkout sem erro visível.

Quatro armadilhas:

1. **O serviço mora em dois lugares.** No seed vai em `data.servico`, que é o que
   chega ao `calculatePrice`; sem ele, o `type.code` (`correios_pac`) é o resto.
2. **`rules` é reescrita inteira.** Um `push` na regra deixaria duas
   `enabled_in_store`, e o Medusa não diz qual vale.
3. **Desligar tudo é checkout sem entrega** — a rota responde 422 em vez de salvar.
   A checagem é do **estado final**: a tela manda só o que mudou, então um corpo
   com um `false` não pode ser lido como "desliguem tudo".
4. **A lista do checkout fica em cache por 60 s.** Ligar um serviço não o mostra
   no `/store/shipping-options` na hora; desligar, idem.

## O que ele NÃO tenta fazer

**A cotação não inventa preço.** Sem token, sem CEP de origem, sem caixa válida
ou com resposta vazia, o provider **lança** — o Medusa tira a opção da lista. Um
`0` aqui seria frete grátis em toda falha.

## O caminho do CEP de origem

O endereço do **local de estoque** (Admin → Locations), que o Medusa entrega no
contexto da cotação em `from_location.address.postal_code`. Não há variável de
ambiente para a origem: ela é um dado da loja, e configuração escondida no `.env`
é configuração que ninguém acha quando o frete sai errado.

## Três armadilhas do framework (todas medidas)

1. **O container do provider não conhece os outros módulos.** Ele recebe o
   container *local* do fulfillment (`logger`, `manager`, `eventBus`) — não há
   `sharedContainer` nem `remoteQuery`. Por isso as caixas são lidas **direto do
   banco** por `manager` (`caixas()`), e não resolvendo `pacotes`. Tentar
   `resolve(PACOTES_MODULE)` aqui derruba o boot com `AwilixResolutionError`.
2. **O serviço mora no `data` da shipping option.** O `calculatePrice` recebe
   `optionData`, que é a coluna `data` — o `type` é rótulo de tela e não chega
   lá. Sem `data: { servico: "PAC" }` o provider não sabe o que cotar.
3. **O provider precisa estar no local de estoque** antes de criar a opção
   (`link` local ↔ provider), senão o Medusa recusa com *"Providers (...) are
   not enabled for the service location"*. O seed faz esse vínculo.

## Multi-volume

Cada unidade de cada item é uma caixa (`calcularVolumes`, no módulo `pacotes`), e
a cotação mostra o **total**: o preço de uma caixa × número de caixas. Exibir o
preço de uma só seria cobrar metade do que a etiqueta custa.

## Configuração

Três variáveis, todas no `.env` e no `docker-compose.yml`:
`SUPERFRETE_TOKEN`, `SUPERFRETE_AMBIENTE` (`sandbox` por padrão) e
`SUPERFRETE_WEBHOOK_SECRET`.

O segredo do webhook é o **`secret_token` devolvido ao criar o Webhook App**
(`POST /api/v0/webhook`), não um valor inventado por nós. Enquanto ele estiver
vazio, `POST /webhooks/superfrete` responde **401 a tudo** — sem chave, um HMAC
não é conferência, e a rota seria um POST anônimo escrevendo em pedido de cliente.

Para conferir a integração: **`POST /api/v0/calculator`** com o token do
sandbox. A conta de teste precisa de saldo (o sandbox recarrega por Pix
simulado).
