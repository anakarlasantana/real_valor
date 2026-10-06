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

### O roteiro do teste real — **ainda não executado**

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