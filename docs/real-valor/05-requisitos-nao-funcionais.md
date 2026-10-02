# 05 — Requisitos Não Funcionais

SEO, acessibilidade, performance, segurança e prontidão para produção. Cada item traz **situação
verificada**, **meta** e **critério de aceite**.

---

## 5.1 Acessibilidade

**Objetivo:** WCAG 2.1 nível AA.

### 5.1.1 Contraste

**Verificado:** o `brand.css` (cabeçalho, linhas 33–36) documenta que `rv-rose` (`#B97872`) sobre
`rv-offwhite` (`#F7F1E8`) fica em **~3,4:1** — abaixo de AA para texto normal. A regra já está
definida: rosa é usado **só em preenchimentos, bordas, ícones e texto ≥ 24px**; corpo de texto usa
`rv-grafite` (~11:1).

**Status:** conforme por decisão documentada. **Requisito:** manter.

| Uso | Cor | Razão | Status |
| :--- | :--- | :--- | :--- |
| Corpo de texto | `--rv-fg` (Grafite `#303033`) | ~11:1 | ✅ |
| Título | `--rv-fg-strong` (Preto `#171717`) | ~16:1 | ✅ |
| Texto de apoio | `--rv-muted` (`#6f6a66`) | ~4,6:1 | ✅ |
| Botão primário | branco sobre `--rv-primary` | ~3,4:1 — **só passa em texto ≥ 18,66px bold ou 24px** | ⚠️ |

> **Risco registrado:** o botão primário (branco sobre rosa) fica em ~3,4:1. É aceitável para texto
> grande, mas **não** para texto pequeno. Verificar o tamanho real da fonte do botão — se for menor
> que 18,66px, é preciso escurecer o rosa de fundo ou aumentar o peso/tamanho.

**Critério de aceite:**
1. Nenhum texto normal abaixo de 4,5:1.
2. Texto grande (≥24px, ou ≥18,66px bold) nunca abaixo de 3:1.
3. O botão primário passa no teste de contraste com o tamanho real da fonte.

### 5.1.2 Foco de teclado

**Verificado:** existe `--rv-focus-ring` (rosa forte `#9e5f58`) e um anel em `:focus-visible`
documentado no fim do `brand.css`.

**Falta:** auditoria de quais controles têm foco visível. Filtros, drawer de filtros, busca e modal
Pix serão novos (RV-004, RV-005, RV-002) — precisam seguir o anel existente, sem inventar um segundo
estilo.

**Critério de aceite:**
1. Todo elemento interativo é alcançável por `Tab`.
2. O foco é sempre visível, sem `outline: none`.
3. Drawers e modais **prendem o foco** enquanto abertos e o devolvem ao fechar.
4. `Esc` fecha drawer e modal.

### 5.1.3 Semântica e leitores de tela

**Verificado:** estruturação de headings presente; `alt` existe em 6 imagens.

**Falta:** auditar `alt` em todas as imagens de produto; `aria-label` nos botões só com ícone;
`aria-live` na atualização do carrinho e no status do Pix; `aria-expanded` nos accordions de filtro.

**Critério de aceite:**
1. Toda imagem tem `alt` (ou `alt=""` se decorativa).
2. Todo botão só com ícone tem `aria-label` em pt-BR.
3. Atualização do carrinho é anunciada por leitor de tela.
4. Um teste com axe-core não acusa violações críticas.

### 5.1.4 Áreas de toque

**Requisito:** alvo mínimo **44×44px** no mobile (WCAG 2.5.5), aplicado especialmente a: botão
"Comprar" (`mobile-actions`), chips de filtro, seletor de tamanho, fechar de drawer/modal.

**Critério de aceite:** nenhum controle com menos de 44px de área clicável no mobile.

---

## 5.2 SEO técnico

Detalhado em RV-007. Situação verificada:

| Item | Verificação | Status |
| :--- | :--- | :--- |
| Título e descrição por página | 3 rotas vazam "Medusa Store" | ❌ |
| `noindex` em checkout/carrinho/conta | Nenhum `robots` encontrado | ❌ |
| Sitemap | Não existe | ❌ |
| `robots.txt` | Não existe | ❌ |
| Dados estruturados | Nenhum `schema.org` | ❌ |
| URL de produto | Amigável (`/products/[handle]`) | ✅ |
| URL de categoria | Amigável (`/categories/[...category]`) | ✅ |
| `lang="pt-BR"` no `<html>` | Presente | ✅ (único idioma) |
| `canonical` em filtro | Ausente | ❌ |
| `metadataBase` + Open Graph | Configurados em `app/layout.tsx:44-66` | ✅ |

**Meta:** indexação limpa em 30 dias após o lançamento, sem "Medusa" em nenhum título.

---

## 5.3 Performance

### 5.3.1 Métricas alvo

| Métrica | Meta | Onde |
| :--- | :--- | :--- |
| LCP | < 2,5 s (móvel) | Home e PDP |
| INP | < 200 ms | Interação nos filtros e na PDP |
| CLS | < 0,1 | Layout estável ao carregar produtos |
| JS inicial | < 200 kB (gz) | Rota de home |

### 5.3.2 Verificado

**Positivo:**
- Fontes self-hosted via `next/font/local` — sem requisição externa, sem CLS de fonte.
- ISR com `revalidate = 60` (home) e `3600` (catálogo) — páginas servidas do cache.
- `next build` sem dependência do backend — build offline.
- `Suspense` + skeletons em catálogo, PDP e carrinho.
- `product-carousel` é uma **ilha** — reduz JS inicial.

**A atenção — imagens:**
- Imagens servidas do **backend local**, sem CDN nem otimização de tamanho.
- `@medusajs/file-local` grava o arquivo original enviado.
- Não há garantia de dimensionamento: o `next/image` depende de o `thumbnail` vir com dimensões
  adequadas.

> **Este é o maior risco de performance da inauguração.** Um catálogo real com fotos grandes servidas
> do backend sem CDN é o caminho mais curto para LCP ruim e banda consumida. **Decisão:** manter local
> até a inauguração (aceitável com catálogo pequeno), mas **exigir** que o time envie imagens já
> redimensionadas e usar `sizes` correto no `next/image`.

### 5.3.3 Cache

| Recurso | Estratégia | Tag |
| :--- | :--- | :--- |
| Conteúdo do CMS | ISR 60s | `content` |
| Catálogo | ISR 1h | `products`, `categories` |
| Carrinho | Sem cache (por cookie) | — |
| `POST /api/revalidate` | Purge autenticado | — |

**Verificado:** `REVALIDATE_SECRET` é obrigatório e o Compose **não** fornece default (fail-closed,
correto). Em produção, definir com `openssl rand -hex 32`.

**Riscos operacionais:**
1. As `NEXT_PUBLIC_*` são **inlinadas no bundle** em PROD. Alterar exige `make build && make restart`
   — documentado no README, mas é armadilha conhecida.
2. Sem `REVALIDATE_SECRET`, alterações de catálogo só aparecem após a janela de ISR.

**Critério de aceite:**
1. LCP < 2,5s no 4G simulado, home e PDP.
2. Imagens com `sizes` correto, sem layout shift.
3. `POST /api/revalidate?tag=products` purga em < 2s.
4. Nenhuma requisição a domínio externo no carregamento inicial.

---

## 5.4 Segurança

| Item | Verificado | Status |
| :--- | :--- | :--- |
| Segredos fora do git | `.gitignore` presente; `.env.example` versionado | ✅ |
| `REVALIDATE_SECRET` com fail-closed | Sem default no Compose | ✅ |
| JWT e cookie secrets | `JWT_SECRET` e `COOKIE_SECRET` no modelo | ✅ (a definir em prod) |
| CORS | `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS` no modelo | ✅ (a definir em prod) |
| Autorização de `/painel` | `check-boundaries.mjs` cobre só imports | ⚠️ a verificar |
| Sanitização do conteúdo do CMS | `backend/…/validation.ts` existe | ⚠️ a verificar cobertura |
| Webhook do pagamento | **a implementar** — assinatura verificada (RV-002, regra 5) | ❌ |
| Rate limiting | **não verificado** | ❌ |
| Validação de upload | Tipo e tamanho **não verificados** | ❌ |

**Riscos a sinalizar:**
1. **Webhook sem verificação de assinatura** permitiria forjar pagamento confirmado. É o item de
   segurança mais crítico — está como regra 5 do RV-002.
2. **Upload sem validação de tipo/tamanho** pode encher o volume Docker `real_valor_uploads`.
3. **CORS em produção** precisa ser restrito ao domínio real — o modelo permite configuração aberta.

**Critério de aceite:**
1. Webhook rejeitado com assinatura inválida, com teste.
2. Upload rejeita arquivo acima do limite e tipo não permitido.
3. CORS de produção restrito ao domínio.
4. Nenhum segredo no repositório.

---

## 5.5 Prontidão para produção

### 5.5.1 Ambiente

| Verificado | Status |
| :--- | :--- |
| Compose único, sem ordem obrigatória de subida | ✅ |
| Build do storefront sem backend no ar | ✅ |
| Dockerfile multi-stage (`deps`→`builder`→`runner` \| `deps`→`dev`) | ✅ |
| `output: standalone` no Next | ✅ |
| Volumes nomeados para Postgres, Redis e uploads | ✅ |
| Rotação de log e limite de memória no override de PROD | ✅ |
| `.dockerignore` na raiz (contexto compartilhado) | ✅ |

**A definir para produção:** domínio real, `NEXT_PUBLIC_BASE_URL`, `STORE_CORS` restrito,
`JWT_SECRET` e `COOKIE_SECRET` gerados, `REVALIDATE_SECRET` gerado, e **HTTPS** — o Compose não
expõe proxy TLS; a referência a `traefik_network` no README é de **outros** projetos, então a Real
Valor precisa do seu.

### 5.5.2 Operação

- `make health` monitora os serviços; `scripts/doctor.sh` diagnostica sem alterar.
- Seed idempotente — pode rodar de novo sem duplicar.
- **Backup do Postgres não foi auditado** — verificar antes da inauguração.

### 5.5.3 Critérios de aceite de produção

1. `docker compose -f docker-compose.yml up -d` sobe do zero, sem erro.
2. Compra completa em modo pagamento real, do clique à confirmação.
3. Nenhum segredo exposto no cliente (`NEXT_PUBLIC_*` só com valores públicos).
4. HTTPS válido em todas as rotas.
5. Backup do Postgres configurado e **testado** com restauração.
6. `make test` e `make check` verdes em CI na branch de release.
7. Logs do backend sem erro em uma navegação completa.

---

## 5.6 Compatibilidade de navegador

**Verificado:** não há `browserslist` nem polyfill explícito em `frontend/package.json`.

**Requisito (público brasileiro observado):**
- **Mobile: Chrome e Safari (iOS)** — prioritário, é a maior parte do tráfego.
- Desktop: Chrome, Edge, Firefox, Safari.
- Dependências: `dvh`, `IntersectionObserver` (`use-in-view`), `AbortController`, `:has()` e
  `:focus-visible` (via Headless UI e `@medusajs/ui`).

Safari 15.4+ e Chrome 105+ suportam essas APIs. Navegadores antigos degradam — aceitável, mas
**registrado**.

**Critério de aceite:** compra completa testada em iOS Safari, que é o caminho mais comum em moda.