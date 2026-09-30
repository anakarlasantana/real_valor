<!--
  Parte 3 do registro de débito técnico (itens 3.x, 4.x e 5).
  Entrada, legenda de severidade e mapa dos assuntos: `docs/DEBITO-TECNICO.md`.
-->

# 3. 🟡 Médio

> Este arquivo cobre os itens 3.x, 4.x e o 5 (o que já está coberto). Mapa dos assuntos e
> legenda de severidade em [`DEBITO-TECNICO.md`](DEBITO-TECNICO.md).

### 3.1 CMS sem invalidação imediata de cache

**Evidência:** `frontend/src/lib/data/content.ts` consome `GET /store/content` com a tag global
`content` e `next: { revalidate: 60 }`. A janela passou a ser **explícita no fetch** em
2026-09-26: com `cache: "force-cache"` e apenas a tag, o conteúdo ficava preso indefinidamente
nas rotas que renderizam a cada request (`/cart`, `/account`, `/search`) — o que passou a incluir
o cabeçalho, que agora vem do CMS e aparece em todas as rotas. Nas rotas pré-renderizadas a
defasagem continua sendo a janela do segmento (`revalidate = 3600` em produto/coleção).

**Impacto:** o lojista edita no admin e **espera até 60 segundos** para ver a mudança na
vitrine — sensação de "não salvou" e risco de edição duplicada.

**Ação necessária:** endpoint `POST /api/revalidate` no frontend protegido por *shared secret*,
chamado pelo backend após `POST/PATCH/DELETE /admin/content`. O endpoint **já existe**
(`frontend/src/app/api/revalidate/route.ts`), mas nenhum código o chama — a invalidação hoje é
manual (`curl` documentado no próprio arquivo) e o caminho normal é esperar a janela.

> **Nota de implementação:** a tag **precisa** ser global (`content`). `getCacheOptions`
> prefixa a tag por visitante, o que impede o revalidate de atingir todos os usuários — isso
> foi exatamente um bug corrigido nesta fase. Não regredir.

---

### 3.2 Zero testes automatizados e zero CI

**Evidência:** não há suíte de testes automatizados nem CI. A rede de segurança atual são duas
guardas de script, rodadas pelo hook versionado (`.githooks/pre-commit`, ativado uma vez por
clone com `git config core.hooksPath .githooks`) e pelo alvo `make check`:

| Guarda | O que cobre |
|---|---|
| `scripts/gen-content.mjs --check` | o artefato do contrato do storefront está em dia com o backend |
| `scripts/check-contract-parity.mjs` | coerência do contrato (tipos ⇔ campos, defaults ⇔ seed, o que a loja lê) e os espelhos mantidos à mão no admin (chaves de ícone, editores de lista, paleta de prévia) |

**Impacto:** refatorações e novos módulos não têm verificação automática de tipos nem de build;
uma divergência que escape às guardas só é descoberta em runtime.

**Ação necessária:**

1. Adicionar CI (GitHub Actions / Azure Pipelines) rodando `make check`, `make types` e o build do
   frontend. O `tsc` dos dois pacotes já está em **zero erros** (2026-09-27) e ganhou alvo próprio
   (`make types`) — o que faltava era a guarda, não o conserto.
2. Cobrir com testes: `service.ts` do módulo `content`, rotas `GET /store/content` e
   `GET/POST/PATCH/DELETE /admin/content` (incluindo os 400 de validação) e o fluxo de checkout.

---

### 3.3 CMS cobre apenas a superfície `home`

**Status: rodapé resolvido em 2026-09-26; resta a superfície institucional.**

**Evidência:** o módulo `content` está populado apenas com `surface: "home"` (9 blocos: as 7
seções do protótipo + o `nav` do cabeçalho + o `footer` do rodapé). Cabeçalho e rodapé viajam
nessa mesma superfície, mas **não** são seções da home: quem os renderiza é o layout
(`(main)/layout.tsx` → `headerSections()`/`footerSections()`), em todas as rotas, e o render da
home ignora os dois tipos (`case "nav"`/`case "footer": return null`). O tema da loja é
*file-based* (`themes/*/theme.json`), fora do CMS.

**Impacto:** textos institucionais (Sobre, Contato, trocas) continuam exigindo deploy para
alterar. O rodapé já não: as colunas (de catálogo — categorias ou coleções — ou com links
digitados) e as redes sociais são campos do bloco `footer` em **Conteúdo da vitrine**, sem
coluna padrão no código, com paridade travada pelo script contra o fallback do storefront.

**Ação necessária:** estender `surface` para `institutional` (a modelagem já suporta; é trabalho
de conteúdo + render), sem migrar o tema para o CMS nesta rodada.

---

### 3.4 `README.md` desatualizado

**Status: resolvido em 2026-09-24, reescrito em 2026-09-26.** O `README.md` documenta o fluxo real
de execução (seções *Como a Aplicação Roda Localmente*, *Admin do Medusa em Desenvolvimento*,
*Banco de dados e dados iniciais* e *Troubleshooting*), as portas efetivas (8000/9000/5439/6382) e
o arquivo de ambiente único (`.env`, a partir de `.env.example`).

**Pendência residual resolvida em 2026-09-24 (containerização).** O fluxo foi unificado em
Docker, eliminando a divergência entre `Makefile` e scripts:

- Deixaram de existir `start.sh`/`stop.sh` iniciando processos no host (`nohup`, PIDs em `/tmp`,
  `corepack`). Toda a stack — incluindo o storefront, que ganhou `Dockerfile` e serviço próprios —
  subiu para o Compose.
- O `Makefile` passou a ser a única interface: alvos finos sobre `docker compose`, com o modo
  escolhido pela presença do `-f` (ver abaixo). Foram adicionados `make ps`, `make logs-all`,
  `make shell-backend`, `make shell-frontend` e `make health`.
- A montagem `./backend/src:/app/src` saiu da base e foi para o overlay de desenvolvimento.

**Estrutura final do Compose (2026-09-26 — modelo único):** `docker-compose.yml` (base única, com
os 4 serviços, estágio `target: runner`, `NODE_ENV=production`, limites de memória e rotação de
log) + `docker-compose.override.yml` (conveniência de desenvolvimento: estágio `target: dev`, bind
mounts, volume anônimo de `node_modules`, `RUN_MIGRATIONS=0`). **O modo é a presença do `-f`**, que
o Compose já usa para decidir se lê o override automaticamente:

```bash
docker compose up -d                         # DEV  (base + override)
docker compose -f docker-compose.yml up -d   # PROD (só a base)
```

Os overlays `docker-compose.dev.yml`/`docker-compose.prod.yml`, o `--env-file .env.docker` e o
script `scripts/build-frontend.sh` foram **removidos** — eram três mecanismos para expressar a
mesma distinção e a origem da maior parte das divergências documentadas neste arquivo. O arquivo
de ambiente é o **`.env` da raiz** (modelo versionado: `.env.example`).

---

### 3.5 Admin não é servido em modo dev

**Evidência:** o modo de servir o admin é decidido por `NODE_ENV` no loader
`@medusajs/medusa/dist/loaders/admin.js`: em `development` compila a fonte do CRM
(`admin/src/admin/**` desde a R7) ao vivo; caso
contrário serve `.medusa/server/public/admin` — diretório que **não existe** neste repositório
(nunca foi executado `yarn build` no host). O artefato gerado `backend/.medusa/client/entry.jsx`
comprova o efeito: lista apenas o plugin npm (`plugin0 = @medusajs/draft-order/admin`) e
**omite o plugin local do CRM**, de modo que a rota `content` nunca é
compilada.

**Impacto:** a tela **Conteúdo da vitrine** não aparece no menu do Admin, embora o módulo
`content`, o endpoint `GET /store/content` e o arquivo
`admin/src/admin/routes/content/page.tsx` estejam corretos. Foi isso que originou a
percepção de "elo incompleto" na seção 2.5.

**Status: resolvido em 2026-09-24 (containerização).** Cada ambiente passou a ter um `NODE_ENV`
correto e explícito, controlado pelo overlay do compose:

| Ambiente | Comando | `NODE_ENV` | Como o admin é servido |
|---|---|---|---|
| DEV (`docker-compose.yml` + `docker-compose.override.yml`) | `yarn dev` (`medusa develop`) | `development` | compilado ao vivo da fonte do CRM (`./admin` montado em `/app/admin`) — o plugin local aparece |
| PROD (`docker compose -f docker-compose.yml`) | `yarn start` (`medusa start`) | `production` | `.medusa/server/public/admin`, gerado no **build da imagem** |

O ponto crítico anterior era justamente rodar `yarn start` sem nunca ter executado
`yarn build`. Na imagem Docker a etapa `builder` do `backend/Dockerfile` executa
`yarn build`, de modo que o artefato `.medusa/server/public/admin` **existe na imagem** e é
servido em produção. Assim, o admin funciona nos dois modos, sem depender de build manual no
host.

Critério de aceite: item "Conteúdo da vitrine" visível na **sidebar principal** (modo dev),
listado em `GET /admin/layouts/main-sidebar/configuration`, e `entry.jsx` listando o plugin
local.

> **Nota (2026-09-26):** a rota passou de `settings/content` para `content`. Com o path antigo
> o item nunca ia para o menu principal: o dashboard o classificava como extensão da sidebar
> de Configurações (`DashboardApp.populateMenus` → `path.startsWith("/settings")`). O débito
> acima (artefato ausente) já estava resolvido — o que restava do sintoma "não aparece no
> menu" era apenas o **local** do item na navegação.

---

## 4. 🔵 Baixo

### 4.1 Sem `sitemap.ts` / `robots.ts`

**Verificado:** não existem `frontend/src/app/sitemap.ts` nem `frontend/src/app/robots.ts`.

**Impacto:** indexação incompleta pelos buscadores e ausência de controle sobre o rastreamento.

**Ação necessária:** gerar `sitemap.ts` dinâmico (produtos + coleções + institucionais) e
`robots.ts` liberando o público e bloqueando `/account`, `/checkout` e `/admin`.

---

### 4.2 Rota `/search` inexistente

**Impacto:** o usuário não tem forma de buscar produto quando a navegação por coleção falha
(agravado pelo item 2.1).

**Ação necessária:** rota de busca reaproveitando o endpoint de produtos do Medusa.

---

### 4.3 Imagens hero em baixa resolução

**Evidência:** `frontend/public/brand/hero.jpg` é placeholder — e é a imagem do hero no
conteúdo padrão da vitrine. As `campaign-*.jpg` saíram em 2026-09-27: nenhuma referência no
código, e nenhuma seção do contrato as usaria (não existe tipo `campaign`).

**Impacto:** primeira impressão da marca comprometida em telas grandes.

**Ação necessária:** substituir pelo material final do cliente e validar peso / LCP.

---

## 5. Itens verificados e já cobertos

Registrado para evitar retrabalho — foram levantados como suspeita e **não** são débito:

| Item | Verificação | Situação |
|---|---|---|
| `backend/Dockerfile` ausente | `ls -la backend/Dockerfile` | ✅ Existe (671 bytes) |
| Opções de frete inexistentes | `seed.ts:235-300` | ✅ PAC e SEDEX existem (porém flat — ver 1.1) |
| Perfil/armazém de envio ausente | `seed.ts:190-233` | ✅ Shipping profile, fulfillment set e service zone criados |
| Provider de fulfillment | `seed.ts:184` | ✅ `manual_manual` configurado |
| `.env` versionado com segredo real | `git ls-files` + `.gitignore` | ✅ **Não** está versionado — só `.env.example` e `frontend/.env.template`. Débito real é o fallback do compose (ver 1.3) |
| CPF no backend | `order-customer-indexer.ts`, `orders/track/route.ts` | ✅ Backend já suporta (falta só o front — ver 2.4) |
| CORS divergente | `.env.example:88-90` + `docker-compose.yml:138-140` | ✅ **Corrigido** — todas as origens em `:8000`/`:9000`; `3000`/`5173` removidos (ver 1.2) |
| Build do storefront dependia de rede | `next build` com `HTTPS_PROXY` apontando para proxy morto | ✅ **Corrigido** — build 100% offline: `generateStaticParams()` removido + fontes self-hosted (ver 6.3 e 6.7) |
| `next/font/google` no `layout.tsx` | `grep -rl gstatic frontend/.next/static/css/` | ✅ **Corrigido** — `next/font/local` com 3 `.woff2` versionados; nenhuma referência a `gstatic` no CSS gerado (ver 6.7) |
| BuildKit / `build.network` / builder legacy | `docker compose build` com BuildKit ativo | ✅ **Irrelevante agora** — sem rede no build não há rede a anexar (ver 6.5) |
| `medusa build` falhava com TS2339 | `src/subscribers/order-customer-indexer.ts:53` | ✅ **Corrigido** — `let targetCustomer = null` deixava o TS inferir o tipo `null`, rejeitando as atribuições de `CustomerDTO`. 9 erros `tsc` que quebravam `yarn build` e o build da imagem de produção |
| Postgres exige TLS | `docker-compose.yml` (DATABASE_URL) | ✅ **Corrigido** — o Medusa forçava `ssl: { rejectUnauthorized: false }` por heurística de URL. `?sslmode=disable` resolve (ver nota abaixo) |
| Cabeçalho fixo no código (`NAV_LINKS`, `SideMenuItems`, ícones estáticos) | `grep -rn 'NAV_LINKS\|SideMenuItems' frontend/src` + `curl localhost:8000/br` | ✅ **Resolvido em 2026-09-26** — zero ocorrências; o menu vem do bloco `nav` do CMS (ver 2.2) e o HTML traz `data-testid="início-link"` etc. |
| Faixa de benefícios com colunas fixas (`grid-cols-4`) | Contagem real do CMS (1, 2, 3, 4, 5 e 8 itens) medida no Chrome headless via CDP, em 375–1920px | ✅ **Corrigido em 2026-09-26** — a faixa é agnóstica ao nº de itens: 1 item = linha inteira, 5 = 5 em linha no desktop, no celular quebra de 2 em 2. Zero rolagem horizontal e nenhuma linha com sobra de fundo |
| Âncoras do menu sem alvo no DOM | `curl localhost:8000/br` (procurando os `id`) + clique real no Chrome headless via CDP | ✅ **Corrigido em 2026-09-26** — `/#hero`, `/#collections` e `/#editorial` eram documentados, mas nenhum elemento tinha esses `id`: o `nav-link` fazia `preventDefault()` e rolava zero. Agora o registro de seções embrulha cada seção em `div[id={section.id}]` e `.rv-anchor` (`brand.css`) compensa o cabeçalho fixo — "Sobre" (bloco `editorial`) rola até a seção com o topo 80px abaixo do header |

---

