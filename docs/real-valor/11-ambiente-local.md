# 11 — Ambiente Local: armadilhas conhecidas

Documento operacional, escrito a partir do que **travou duas rodadas de validação** na
implementação do RV-001. Nenhuma delas é culpa de quem a encontra — as mensagens de erro não
apontam para a causa, e nenhum aviso aparece.

**Este documento é para quem vai rodar o build ou os testes na máquina.**

---

## 11.1 `node_modules` parcial: `yarn install` reporta sucesso e não instala

### O sintoma

```
node_modules/ tem 873 pacotes
react       → presente
typescript  → presente
jest        → presente
next        → AUSENTE
vitest      → AUSENTE
```

E o `yarn install` termina em **1 segundo**, sem erro:

```
➤ YN0000: └ Completed in 1s 171ms
➤ YN0000: · Done with warnings in 1s 171ms
```

### Por que acontece

O `.yarn/install-state.gz` (na raiz, junto do `.yarn/`) marca o install como **feito**. Quando ele
existe e o Yarn acredita nele, o install **confia no arquivo e não religa nada** — mesmo que
`node_modules` esteja incompleto de verdade.

É o mesmo modo de falha que o projeto já combatiu com a "guarda de paridade": um registro em
disco que envelhece sem ninguém perceber. O `install-state.gz` é o caso degenerado disso.

### Como reconhecer

O install que **não fez trabalho** mostra a fase de build vazia. O que **fez trabalho** mostra:

```
➤ YN0007: sharp@npm:0.34.5 must be built because it never has been before
➤ YN0007: esbuild@npm:0.21.5 must be built because it never has been before
➤ YN0007: unrs-resolver@npm:1.12.2 must be built because it never has been before
```

### O conserto

```bash
rm -f .yarn/install-state.gz
corepack yarn install --immutable
```

O `--immutable` é o que a CI usa: falha se o `yarn.lock` precisasse mudar. `corepack` é o caminho
do próprio projeto — a release do Yarn está versionada (`.yarn/releases/yarn-4.12.0.cjs`) e
`packageManager` é `yarn@4.12.0`.

**Não é falta no `yarn.lock`** — o `next` está lá. E **não afeta o Docker**: `docker compose build`
usa `yarn workspaces focus` numa imagem limpa, que nunca teve um `install-state.gz` de uma
instalação pela metade. **O problema é só local.**

---

## 11.2 `NODE_ENV=production` é obrigatório no build

### O sintoma

O build **compila** e quebra depois, na geração de páginas:

```
✓ Compiled successfully in 20.0s
Generating static pages (0/5) ...
Error: <Html> should not be imported outside of pages/_document.
Error occurred prerendering page "/500".
Export encountered an error on /_error: /500, exiting the build.
```

### Por que acontece

Sem `NODE_ENV=production`, o Next roda o build no caminho de **dev**, e a página `/500` é
renderizada pelo runtime de desenvolvimento — que importa `<Html>`, proibido fora de
`pages/_document`. O aviso existe, mas está no topo e é fácil não ver:

```
⚠ You are using a non-standard "NODE_ENV" value in your environment.
```

### O conserto

```bash
NODE_ENV=production NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_test yarn build
```

O Compose já faz isso (`docker-compose.yml`, linhas 135 e 232). Quem roda o build na mão precisa
saber — a mensagem de erro não menciona `NODE_ENV` em lugar nenhum.

### Este sintoma apareceu duas vezes, com causas diferentes

Vale separar as duas porque a segunda **não** era `NODE_ENV` — e a mensagem de erro é a mesma.
**Origem da primeira:** `10-roadmap.md` §10.8 (o doc 10 foi podado em 13/10/2026; a recuperação está
no `README.md` da raiz).

| Quando | Onde quebrou | Causa |
| :--- | :--- | :--- |
| 10/02/2026 | prerender do **404** | o build rodou sem `NODE_ENV=production` — é este item |
| 13/10/2026 (RV-050) | a **compilação** | `next/headers` alcançando o bundle de cliente pelo `lib/config`; a correção foi `"use server"` em `lib/data/tracking.ts` |

**Se a falha persistir com `NODE_ENV=production`**, o candidato seguinte é a versão do
`@medusajs/ui`: ele está declarado como `"latest"` no `frontend/package.json` (o preset também), e sem
`package-lock.json` no workspace um `npm install` em outra máquina resolve uma versão diferente da que
o build verde usou (a 4.2.6). **Fechar a versão é o conserto mais barato — e segue aberto.**

---

## 11.3 O `vitest` precisa de configuração para componentes

O `vitest.config.ts` precisou de **quatro** ajustes, todos porque o `registry.spec.ts` foi o
primeiro teste que importa um **componente** (`.tsx`). Os testes anteriores eram todos função pura
em `.ts`, e por isso nada disso tinha aparecido.

### 1. A ordem dos alias importa

O Vite resolve alias por **PREFIXO**. Com o alias genérico antes do específico:

```ts
"@rv/contrato": "…/src/index.ts",
"@rv/contrato/payment": "…/src/payment.ts",   // nunca chega aqui
```

o import do subpath vira `…/src/index.ts/payment`, e o teste morre com:

```
Error: ENOTDIR: not a directory
```

**O mais específico vem primeiro.**

### 2. `oxc.jsx`, e não `esbuild`

O `tsconfig.json` usa `"jsx": "preserve"` — o padrão do Next, que deixa o SWC tratar. O vite 8
transforma com **oxc**, e **ignora** a opção `esbuild` (ele avisa na saída: *"Both esbuild and oxc
options were set… esbuild options will be ignored"*). Sem isto, um `.tsx` chega como JSX cru:

```
Error: Failed to parse source for import analysis because the content contains invalid JS syntax.
```

A opção é `oxc: { jsx: { runtime: "automatic" } }`.

### 3. O alias `@modules`

Falta no `vitest.config.ts` e só aparece quando um componente o importa:
`Cannot find package '@modules/skeletons/…'`.

### 4. `server-only` lança de propósito

O pacote `server-only` lança por desenho quando importado de um módulo **client** — é assim que o
Next impede que Server Component vaze para o navegador. No teste unitário não existe essa
separação: o registry é cliente e importa o adapter, que chama `placeOrder` (que usa `server-only`).

```
Error: This module cannot be imported from a Client Component module.
```

O conserto é um stub (`vitest.server-only-stub.ts`), apontado no alias.

---

## 11.4 O build não valida tipos — o `tsc` é obrigatório

`next.config.js` tem:

```js
typescript: { ignoreBuildErrors: true },
eslint: { ignoreDuringBuilds: true },
```

O build só confirma que o código **transpila**. Um erro de tipo passa. Por isso o `tsc` roda
sempre que o build roda:

```bash
cd frontend && ../node_modules/.bin/tsc --noEmit -p tsconfig.json
```

---

## 11.5 Checklist antes de dizer "está pronto"

```bash
cd frontend
../node_modules/.bin/tsc --noEmit -p tsconfig.json     # tipos (o build NÃO vê)
NODE_ENV=production node_modules/.bin/next build       # build real
node_modules/.bin/vitest run                           # testes
cd .. && node scripts/check-boundaries.mjs             # fronteiras
```

Estado medido depois do RV-001 (10/02/2026):

| Verificação | Resultado |
| :--- | :--- |
| `tsc --noEmit` | ✅ exit 0 |
| `next build` (NODE_ENV=production) | ✅ 17 rotas, `.next/standalone` gerado |
| `vitest run` | ✅ **142 testes / 10 arquivos** |
| `check-boundaries.mjs` | ✅ 2 verificações |

Estado medido depois do RV-002 (10/02/2026):

| Verificação | Resultado |
| :--- | :--- |
| `tsc --noEmit` (storefront) | ✅ exit 0 |
| `tsc --noEmit` (backend) | ✅ exit 0 |
| `vitest run` (storefront) | ✅ **173 testes** — eram 142 no RV-001 |
| `jest` (backend, unit) | ✅ **368 testes / 21 suítes** |
| `check-boundaries.mjs` | ✅ "Fronteira em dia." (2 verificações) |

> O `next build` **não** foi repetido nesta rodada: o que mudou no storefront foram dois adapters e um
> botão, cobertos pelo `tsc` e pelo `vitest`. Refaça-o antes de publicar.

---

## 11.6 O webhook do Mercado Pago não chega sem um túnel

**O sintoma.** Você grava `MP_NOTIFICATION_URL=https://localhost:9000/webhooks/mercadopago` e nada
chega: nenhum log de rota, nenhum erro. Não há o que depurar do nosso lado — o Mercado Pago recusa a
URL, porque ela não é alcançável da internet e não tem TLS válido. A notificação **nunca sai de lá**.

**Por que o Compose não resolve.** Ele publica portas no **host**, não na internet, e não termina
TLS. Um `curl` de dentro da rede funciona; o Mercado Pago não é de dentro da rede.

**O que resolve:** dois túneis com HTTPS, porque há **dois** destinos distintos — e trocá-los é o
erro fácil:

| Túnel | Serve | Aponta para |
| :--- | :--- | :--- |
| 1 — backend | `MP_NOTIFICATION_URL` (`/webhooks/mercadopago`) | `http://localhost:9000` |
| 2 — storefront | `MP_BACK_URL` (`/br/pedido/confirmacao`) | `http://localhost:8000` |

> ⚠️ **Um é URL de servidor, o outro é URL de navegador.** Apontar os dois para o túnel do backend
> parece natural e quebra o retorno: a cliente voltaria para a API, e não para a página de
> confirmação.

**A ordem importa.** O túnel precisa estar no ar **antes** de gravar a URL da notificação: o painel
valida a URL ao salvá-la, e uma URL morta é recusada — ou, pior, aceita e depois silenciosa.

### O roteiro do teste real — **passos 1 a 3 executados; 4 a 7 dependem do cartão de teste**

Cada passo prova uma coisa, e o primeiro é o mais barato:

1. `curl -X POST https://<túnel-backend>/webhooks/mercadopago` **sem** o header `x-signature` →
   **401**. Se der **200**, a assinatura não está sendo conferida — pare aqui. Se der **404**, o
   túnel está apontando para o serviço errado.
2. Gravar `MP_NOTIFICATION_URL` e `MP_BACK_URL` com as duas URLs do túnel.
3. `curl -X POST https://<túnel-backend>/webhooks/mercadopago/<algo-desconhecido>` → **404**. O
   sufixo de meio é validado **antes** da assinatura, e existe justamente para uma URL digitada
   errada aparecer no painel de webhooks — em vez de virar uma venda que não aparece.
4. Compra com **cartão de teste** → aprovar.
5. O webhook chegando com **200** no log do backend — e o log diz qual das *cinco checagens* passou.
6. O pedido existindo, com `external_reference` apontando para a sessão.
7. Repetir a **mesma** notificação → **200** e **nenhum** pedido novo. É a prova de que o reenvio é
   absorvido pelas guardas do framework (ver `04-requisitos-funcionais.md`), e não por uma marca
   nossa.

> **Estado.** Os passos **1, 2 e 3** foram executados no caminho de **um** endereço (§11.6.1) e deram o
> esperado: `401` `{"recebido":false,"erro":"assinatura inválida"}` sem assinatura e `404`
> `{"message":"Not Found"}` no sufixo de meio. Nesse caminho as duas URLs do passo 2 são a **mesma** —
> `https://<endereço>/webhooks/mercadopago` e `https://<endereço>/br/pedido/confirmacao` —, e o
> `make tunnel` as grava sozinho. Os passos **4 a 7** continuam pendentes: dependem de um pagamento de
> teste aprovado no provedor. A conferência do pedido (passo 6) é no painel — local
> (`http://localhost:9000/painel`) ou no publicado (`https://<endereço>/painel`) —; ver §11.6.2.

---

## 11.6.1 Um endereço só: o storefront publica o webhook

> Esta seção é o caminho de **um** endereço. A §11.6 descreve o caminho de dois túneis e continua
> válido — como referência do que cada URL significa e do roteiro de teste real. Aqui só muda **por
> onde** o webhook entra.

**Por que não dá para manter os dois túneis.** No plano gratuito do ngrok existe **um** domínio
reservado por conta. Dois agentes no mesmo domínio não coexistem: o segundo não sobe, ou sobe e o
tráfego passa a cair no serviço errado — o `MP_NOTIFICATION_URL` continua com a URL combinada, o POST
vai para o **storefront**, que não tem rota nenhuma em `/webhooks/...`, e o pedido não nasce. E esta
falha não grita: é um **404** num serviço que você nem estava olhando.

**O desenho.** Um único agente, apontado para o storefront (`:8000`), e o storefront publica o
caminho do webhook via *rewrite* em `frontend/next.config.js` (`afterFiles`):

```js
{ source: "/webhooks/:path*", destination: `${MEDUSA_BACKEND_URL}/webhooks/:path*` }
```

O que isso preserva: o backend **não** fica exposto, o CORS não é ampliado (os campos
`STORE_CORS`/`ADMIN_CORS`/`AUTH_CORS` ganham o endereço público, mas nada além do que já tinham), e os
headers e o corpo do POST passam intactos — inclusive o `x-signature`, que é calculado sobre o **corpo
cru**. O navegador só conversa com o Next; o acesso a dados continua sendo *server action* sobre
`http://backend:9000`.

| Chave | Valor no modo de um endereço |
| :--- | :--- |
| `NEXT_PUBLIC_BASE_URL` | `https://<endereço>` — para montar imagens e links absolutos |
| `MP_NOTIFICATION_URL` | `https://<endereço>/webhooks/mercadopago` |
| `MP_BACK_URL` | `https://<endereço>/br/pedido/confirmacao` |

### As duas armadilhas que fazem isso falhar em silêncio

**1. O middleware do storefront responde antes do rewrite.** `/webhooks/mercadopago` é uma rota **sem
país**, e o middleware trata tudo que não tem prefixo de locale como página de vitrine: sem a exclusão
ele devolve **307** para `/br/webhooks/mercadopago`. O Mercado Pago não segue esse redirecionamento —
e se seguisse, o caminho já não casaria com o rewrite. Resultado: **404**, pagamento aprovado, pedido
inexistente, zero erro no log. Por isso `webhooks` está na lista de exceções do `matcher` em
`frontend/src/middleware.ts`, ao lado de `uploads` e `static` — mesmo motivo, consequência pior.

**2. O rewrite é lido na subida do container.** Depois de mexer no `next.config.js`, **recrie o
storefront** (`make recreate SERVICE=frontend`) ou suba de novo pelo script. Um servidor já no ar
continua com a configuração antiga: o caminho simplesmente não existe e você recebe 404 como se a rota
do backend não existisse — foi exatamente o sintoma visto ao validar esta seção.

### Como verificar (é o que `make tunnel` já faz por você)

| Teste | Esperado | O que significa quando não bate |
| :--- | :--- | :--- |
| `GET $url/br` | **200** | o agente não está apontando para o storefront, ou a loja ainda está subindo |
| `POST $url/webhooks/mercadopago` sem `x-signature` | **401** `{"recebido":false,"erro":"assinatura inválida"}` | **404** = middleware ou rewrite fora de vigor; **500** = backend ainda subindo (`ECONNREFUSED ...:9000` no log do storefront) |
| `GET $url/uploads/<chave>` | **200** `image/*` | a vitrine até abre, mas as fotos não — o mesmo rewrite que serve o webhook serve as imagens |
| `POST $url/webhooks/mercadopago/<algo>` | **404** `{"message":"Not Found"}` | o JSON é do **backend**: provou que a reescrita chegou lá. Um **404 em HTML** = quem respondeu foi o storefront |

O corpo do 404 diz quem respondeu: `{"message":"Not Found"}` é o Medusa (o sufixo de meio é conferido
antes da assinatura), `text/html` é o Next — e aí a reescrita não está valendo.

O **401** é o sucesso: prova que o caminho chega na rota do backend e que a assinatura está sendo
conferida. Um **200** aqui seria o problema — significaria que a assinatura não é validada e qualquer
um poderia criar pedidos.

> Ao testar com `curl`, mande `-H 'ngrok-skip-browser-warning: 1'`. Sem esse header o plano gratuito
> devolve a página **"Visit Site"** com status **200** e o teste passa por engano, sem nunca ter
> tocado a loja. O envio do provedor é um cliente HTTP simples e não passa por essa página.

### O comando e o que ele mexe

```bash
make tunnel          # sobe o agente, reescreve o .env, recria os serviços e verifica
make tunnel-status   # estado do agente + os oito valores que ele controla
make tunnel-stop     # derruba o agente e devolve o .env original
```

O `.env` original é copiado para `.run/tunnel.env.bak` antes de qualquer escrita e devolvido no
`tunnel-stop`. A ordem dentro do `start` é deliberada: o `.env` é gravado **antes** de recriar os
serviços, porque um `MP_NOTIFICATION_URL` velho faz o boot avisar sobre `webhook.site` e a venda se
perde calada.

> ⚠️ `NEXT_PUBLIC_BASE_URL` é **inlinado no build** em produção. Em produção, o valor do `.env` não
> vale para o que já foi compilado: refaça o build com a URL pública, ou publique com um endereço fixo.
> No `dev` o valor é lido em tempo de execução, então o `make tunnel` funciona sem recompilar.

---

## 11.6.2 O painel do admin sai pelo mesmo endereço

A §11.6.1 deixou o painel fora do endereço público, e o resultado era o esperado: `/painel` é rota sem
país, o middleware a desviava para `/br/painel` (**307**) e a cliente recebia **404**. Isso mudou —
publicar o painel é a segunda metade do mesmo problema ("um endereço só"), porque quem testa a loja de
fora também precisa entrar nele. O painel entra por **caminho**, no endereço do túnel:

| Caminho público | Quem responde | Como |
| :--- | :--- | :--- |
| `https://<endereço>/painel` | o backend | reescritas `/painel` e `/painel/:path*` (`frontend/next.config.js`) |
| `https://<endereço>/painel-api/<caminho>` | o backend | reescrita `/painel-api/:path*` → `/:path*` — o prefixo só existe do lado de fora |

### Por que **duas** reescritas, e não uma

A página sozinha não faz o painel funcionar. O bundle do painel chama a API por um endereço
**absoluto**, gravado no backend em tempo de execução (`MEDUSA_BACKEND_URL` → `__BACKEND_URL__`,
`backend/medusa-config.ts`). Com o valor local (`http://localhost:9000`), o navegador de quem está
**fora** posta o login em `localhost:9000` — o `localhost` **da máquina dele**, onde nada responde. O
sintoma é cruel: `ERR_FAILED` silencioso, sem mensagem no painel, **com a credencial certa**. Trocar a
senha não muda nada aqui: o defeito é de rota.

Por isso o `make tunnel` grava `MEDUSA_BACKEND_URL=https://<endereço>/painel-api` e **recria o
backend**, que é quem lê o valor. As chamadas do painel passam a sair na **mesma origem** da página
(sem CORS, sem preflight) e a reescrita tira o prefixo antes de entregar ao Medusa.

### As três armadilhas que fazem isso falhar em silêncio

1. **O caminho tem de ser o mesmo dos dois lados.** `admin.path` é o `base` do Vite do painel
   (`getViteConfig`, `@medusajs/admin-bundler`). A reescrita troca **só o hospedeiro**, de propósito:
   mexer no caminho faz o `stripBase` do painel errar o alvo e o bundle não carrega — o mesmo defeito
   descrito no README, seção "Painel admin em `/painel`". Por isso `MEDUSA_ADMIN_PATH` continua
   `/painel` (`docker-compose.yml`) e o `make tunnel` assume esse valor.
2. **O Vite recusa `Host` que não seja IPv4/localhost — e quem chega não é o navegador.** A reescrita
   do Next fala com o backend como um cliente HTTP, então a requisição chega ao Vite com
   `Host: backend:9000` — o host **interno** do Compose, sempre o mesmo, em local e no túnel. Medido:
   `GET http://localhost:8000/painel` (com as reescritas valendo e a chave vazia) responde
   **403 `Blocked request. This host ("backend") is not allowed.`** — a armadilha aparece **até
   localmente**, e não só de fora. Quem libera é `__MEDUSA_ADMIN_ADDITIONAL_ALLOWED_HOSTS` (lista por
   vírgula, **sem esquema**; ver `getAllowedHosts` em `@medusajs/admin-bundler`), cujo default no
   `docker-compose.yml` é `backend`; o `make tunnel` acrescenta o host do ngrok (útil no caminho de
   dois túneis da §11.6, em que o agente aponta para `:9000`). Do outro lado, `localhost`, `127.0.0.1`
   e `::1` continuam valendo **antes** de a lista ser consultada (medido em `isHostAllowedWithoutCache`,
   `vite/dist/node`): é por isso que `:9000/painel` responde **200** sem configuração nenhuma.
3. **As telas custom do CRM chamavam a API por caminho relativo à raiz.** Um `fetch` com o caminho
   `"/admin/content"` é resolvido contra o endereço que **serve a página**, e isso só vale enquanto é o
   backend que a serve. Publicado pelo storefront, a chamada cai na armadilha 1 antes de chegar ao
   Medusa: o middleware prefixa o país (**307** para `/br/admin/content`) e o destino responde **404**
   com `Content-Type: text/html` — o `res.json()` da tela estoura um `SyntaxError` **antes** de o
   `res.ok` ser lido, então a tela diz "Não foi possível carregar o schema." e o status, que é a pista
   de verdade, morre dentro do erro de parse. Medido com o painel publicado:
   `GET :8000/admin/content?surface=home` → **307** → `/br/admin/content?surface=home` → **404** (HTML da
   vitrine), enquanto `GET :8000/painel-api/admin/content?surface=home` → **401 JSON** e
   `GET :9000/admin/content?surface=home` → **401 JSON** (o local nunca quebrou). O conserto é o
   endereço que o dashboard instalado sempre usou: as **15** chamadas do CRM passam a sair por `apiUrl`
   (`admin/src/admin/lib/api-url.ts`), montado sobre o `__BACKEND_URL__` do bundle — o mesmo valor desta
   variável. As guardas rodam no runner do CRM: `admin/src/admin/lib/__tests__/api-url.unit.spec.ts`
   prende a montagem da base (com e sem barra no fim, `/painel-api`, base vazia) e
   `panel-wiring.unit.spec.ts` passou a reprovar `fetch` com caminho relativo à raiz em todo o
   `admin/src`. No mesmo módulo, o `readJson` impede que um corpo que não é JSON seja lido como falha de
   rede. A base chega por dois caminhos, e os dois foram medidos: no **build**, o Vite troca a constante
   por um literal; no **dev server** — que é o painel que o túnel publica —, o `env.mjs` do próprio Vite
   materializa o `define` no objeto global (`window.__BACKEND_URL__` no navegador = o valor do `.env`).

### Medido

| Teste | Resultado |
| :--- | :--- |
| `GET https://<endereço>/painel` **antes** das reescritas | **307** `location: /br/painel` → **404** (HTML da vitrine) |
| `GET https://<endereço>/painel/` (barra no fim) | **308** → `/painel` (o Next normaliza, e a cliente não perde o caminho) |
| `GET https://<endereço>/painel-api/admin/users/me` **antes** | **307** `location: /br/painel-api/...` |
| `GET http://localhost:8000/painel` (reescrita valendo, chave vazia) | **403** `Blocked request. This host ("backend") is not allowed.` — o Next chega ao Vite pelo host interno |
| `GET http://localhost:8000/painel-api/admin/users/me` | **401** `{"type":"unauthorized"}` — a API do painel chegou ao Medusa pelo storefront local |
| `GET http://localhost:9000/painel` | **200** — o painel local nunca foi afetado
| `POST /auth/user/emailpass/update` sem token | **401** — a rota existe e exige sessão (é ela que troca a senha) |
| `POST http://localhost:9000/auth/user/emailpass` com a senha do `.env` | **200** + `token` |
| `POST https://<endereço>/painel-api/auth/user/emailpass` com a senha do `.env` | **200** + `token` — o login funciona **de fora** |
| `GET https://<endereço>/painel-api/admin/users/me` com esse token | **200** + o JSON do usuário |
| `GET https://<endereço>/painel-api/static/<chave>` e `GET https://<endereço>/uploads/<chave>` | **200** `image/png` nos dois — o mesmo arquivo pelos dois caminhos |
| **Navegador de verdade** (Chrome headless + CDP) abrindo `https://<endereço>/painel/login` | a página monta; `__BACKEND_URL__` resolvido no browser = `https://<endereço>/painel-api`; **165 requisições, todas no host público, zero `localhost:9000`**; nenhuma exceção, nenhum erro de console, nenhum módulo 404 |
| O mesmo navegador, preenchendo e-mail e senha | `POST …/painel-api/auth/user/emailpass` → **401** (senha vazia) e **200** → termina em `https://<endereço>/painel/orders` ("Orders - Medusa"): **a cliente entra no painel** |
| Carga autenticada (`/painel/orders`, Vite quente) | **207 requisições** (33 para a API), zero `localhost:9000`, zero falhas |
| `GET https://<endereço>/admin/content?surface=home` (**antes** do `apiUrl`) | **307** `location: /br/admin/content?surface=home` — a rota sem país que o middleware desvia |
| `GET https://<endereço>/br/admin/content?surface=home` | **404** `Content-Type: text/html` (a vitrine) — é este corpo que estourava o `res.json()` da tela de conteúdo |
| `GET https://<endereço>/painel-api/admin/content?surface=home` (sem cookie) | **401** `{"message":"Unauthorized"}` — o caminho que a tela passa a chamar; o 401 é a resposta da **rota**, e não a de outro endereço |
| `GET http://localhost:9000/admin/content?surface=home` (sem cookie) | **401** JSON — o painel local nunca quebrou |
| console do navegador em `/painel/content` (**antes**) | `SyntaxError: Unexpected token '<'` no `res.json()` + `404 /br/admin/content?surface=home` — os **dois últimos** dos seis recados da lista |
| **Navegador de verdade** (Chrome headless + CDP): login no painel publicado e `/painel/content` | a tela carrega os blocos (`Seções de Conteúdo da vitrine`, `Nova seção`, `Restaurar padrão`) e a aba "Páginas" responde `Sobre · Publicada · /sobre · 1 bloco · 1 publicado`; **4** `GET /painel-api/admin/content?surface=home` → **200 JSON** (o schema e as três superfícies); **191** requisições, **zero** em `/br/`, **zero** exceção, **zero** falha — e `__BACKEND_URL__` no browser = `https://<endereço>/painel-api` |

> **O que aquela medição de navegador não cobria — e o que a armadilha 3 custou.** As duas cargas acima
> abriram `/painel/login` e `/painel/orders`: telas do **dashboard**, que já chamam a API pelo
> `__BACKEND_URL__` do bundle. Nenhuma tela **custom** do CRM foi aberta, e eram elas que chamavam a API
> por caminho relativo à raiz — então 165 requisições verdes, todas no host público, não disseram nada
> sobre `/painel/content`. Fechar o ciclo é abrir a tela: `http://localhost:9000/painel/content` (local)
> e `https://<endereço>/painel/content` (publicado) têm de mostrar os blocos, e não "Não foi possível
> carregar o schema." Na lista de seis recados do console, só os dois últimos eram deste defeito: os
> outros quatro são ruído de terceiros — um aviso do React Router e o pedido da fonte Roboto Mono, os
> dois do dashboard instalado — e o HMR, que não passa no túnel e já está declarado nos *Limites*
> abaixo.

Depois de publicar, o próprio `make tunnel` fecha a conta: `GET /painel` (espera **200**; **403**
significa a armadilha 2, **307** significa que `painel` não está na exclusão do `matcher`),
`GET /painel-api/admin/users/me` (espera **401**; **404** significa reescrita faltando) e o valor de
`MEDUSA_BACKEND_URL`. Os dois de sempre continuam valendo:

```bash
make health        # backend + loja + painel
make logs-admin    # o veredito do grafo de módulos do Vite
```

### A senha — o passo que não pode ficar para depois

Publicar o painel é publicar **acesso administrativo**: quem tiver o endereço alcança a tela de login,
e a senha é a única porta. E aqui existe uma armadilha específica: `ADMIN_PASSWORD` no `.env` **não é a
senha do painel** — é o valor com que `backend/docker-entrypoint.sh` **cria** o primeiro usuário, e ele
trata "usuário já existe" como sucesso. Depois disso, editar o `.env` e recriar o backend não troca
senha nenhuma: o `.env` mostra uma senha nova e o painel continua aceitando a antiga. Quem troca é o
Medusa:

```bash
make admin-password                       # sorteia uma senha forte e a imprime
make admin-password NOVA='a senha nova'
```

`scripts/senha-admin.sh` percorre o caminho inteiro: login com a senha atual
(`POST /auth/user/emailpass`), troca (`POST /auth/user/emailpass/update`, com o token no cabeçalho) e a
prova — login com a **nova aceito** e com a **antiga recusado** —, e só então grava `ADMIN_PASSWORD` no
`.env`. Se qualquer passo falhar, o `.env` fica como estava. O `make tunnel` **recusa publicar**
enquanto a senha for a de exemplo (`admin123456`, a do `.env.example`); para um ambiente descartável,
`make tunnel ACEITAR_SENHA_EXEMPLO=1`.

### Onde a venda aparece

A compra pode ser feita pelo endereço público (celular, outra máquina) e o pedido se confere no painel
— local **ou** publicado, os dois valem: mudar *por onde* o webhook entra não muda *onde* o pedido
nasce (passo 5–6 do roteiro da §11.6).

### Limites honestos deste caminho

| Limite | Consequência |
| :--- | :--- |
| Plano gratuito do ngrok: um domínio e uma cota mensal de requisições — **medido**: 165 requisições na página de login e 207 numa carga autenticada do painel (Vite quente; a primeira carga é maior, porque o Vite compila e serve os módulos sob demanda) | o painel publicado serve para **conferir**, não para trabalhar o dia inteiro: cada carga consome ~200 da cota, então a conta fecha em poucas dezenas de cargas por mês |
| O HMR do Vite (`:9001`) não passa no túnel | o painel publicado não recarrega sozinho ao salvar um arquivo; o local continua com HMR |
| Interstitial do plano gratuito ("Visit Site") | quem abre a URL no navegador vê a página de aviso uma vez; um cliente HTTP (o provedor de pagamento) não passa por ela |
| `http://localhost:8000/painel` (painel pelo storefront local) | a página chega, mas o bundle chama a API em `localhost:9000` (o valor do `.env`) — e agora **todas** as telas saem por lá, as custom do CRM inclusive (era o defeito da armadilha 3): outra origem, e o login passa a depender de `ADMIN_CORS`. Em local use `:9000/painel`; de fora, o endereço do túnel |
| `make down` / `make tunnel-stop` | o painel publicado deixa de existir junto com o endereço — é o mesmo endereço |
| PROD (`make up PROD=1`) | fora do escopo deste caminho: o `.env` do túnel vale para o runtime, mas `NEXT_PUBLIC_*` é inlinado no build (ver a nota da §11.6.1) |

### Se você **não** quiser o painel publicado

Ele vai junto de propósito — é o mesmo problema, no mesmo endereço. Para voltar ao caminho da
§11.6.1 (loja e webhook públicos, painel só local), tire as três reescritas de `frontend/next.config.js`
(`/painel`, `/painel/:path*`, `/painel-api/:path*`), o `painel` da exclusão do `matcher`
(`frontend/src/middleware.ts`) e as duas gravações do `scripts/tunnel.sh`
(`MEDUSA_BACKEND_URL` e `__MEDUSA_ADMIN_ADDITIONAL_ALLOWED_HOSTS`). O `MEDUSA_ADMIN_PATH` continua
`/painel` — ele é o caminho local do painel e não depende do túnel.

| Alternativa | O que custa |
| :--- | :--- |
| Segundo endereço (plano pago, ou um agente avulso sem `--domain`, que sorteia outro subdomínio) | o painel ganha endereço próprio e some a promessa de "um endereço só" — no plano gratuito, dois agentes no mesmo domínio não coexistem |
| Túnel SSH ou VPN até a máquina | o painel continua local; o operador entra pela rede privada, e nada é publicado para a cliente |
