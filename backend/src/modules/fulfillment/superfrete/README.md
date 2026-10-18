# SuperFrete — a cotação

O provider de frete que fala com a API do SuperFrete e cota **PAC, SEDEX e Mini
Envios**. É ele que responde ao `calculatePrice` do Medusa no checkout.

## Os arquivos

| Arquivo | O que faz |
| :--- | :--- |
| `catalogo.ts` | códigos dos Correios (1, 2, 17), conversão de unidades, leitura da resposta |
| `cliente.ts` | o `fetch` com token, ambiente, `User-Agent` e erro com status |
| `servico.ts` | caixa (do módulo `pacotes`) + API → cotação, com cache de 5 min |
| `service.ts` | o `AbstractFulfillmentProviderService` (`calculatePrice`) |
| `index.ts` | o `ModuleProvider` do fulfillment |

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

Para conferir a integração: **`POST /api/v0/calculator`** com o token do
sandbox. A conta de teste precisa de saldo (o sandbox recarrega por Pix
simulado).
