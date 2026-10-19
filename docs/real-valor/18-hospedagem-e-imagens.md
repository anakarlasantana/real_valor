# 18 — Hospedagem e imagens (custo zero vs. custo real)

> Nota de decisão. Registra **por que** as imagens ficam onde ficam hoje e o que
> muda se a loja for para um PaaS gratuito. Sem isso, a próxima pessoa tenta
> "subir tudo no Vercel grátis" e descobre o problema em produção.

## 1. O sistema não é um site: é um stack com estado

O que roda no `docker-compose.yml`:

| Peça | Porta | É stateless? |
|---|---|---|
| `frontend` (Next 15 + React 19) | 8000 | Sim |
| `backend` (Medusa 2.18: API + Admin) | 9000 | **Não** — processo Node longo, com worker |
| `postgres` | 5432 | **Não** — banco |
| `redis` | 6379 | **Não** — eventos/filas |
| volume `real_valor_uploads` | — | **Não** — fotos enviadas pelo CRM |

Um PaaS serverless (Vercel) só hospeda a linha 1. As demais precisam de um
servidor que não durma e de um disco que não seja apagado a cada deploy.

Três detalhes concretos do repositório que confirmam:

- **Uploads no disco.** `@medusajs/file-local` grava em `/app/uploads`, montado no
  volume `real_valor_uploads`. Em qualquer PaaS sem volume, **cada deploy apaga
  todas as fotos de produto enviadas pelo CRM**.
- **`/uploads` é um rewrite interno.** `frontend/next.config.js` manda
  `/uploads/:path*` para `http://backend:9000/static/:path*` — nome de serviço da
  rede do Compose. Fora dela essa URL não resolve.
- **Webhooks.** Mercado Pago e Resend chamam o backend. Backend hibernando =
  pagamento aprovado sem pedido marcado e e-mail não enviado.

## 2. As três classes de imagem

| Classe | Onde está | Vai no build? | Custo de hospedagem |
|---|---|---|---|
| **Marca** — `hero.jpg`, `collection-1..3.jpg`, `story-1..2.jpg`, `logo.png` | `frontend/public/brand/` (versionado) | Sim, vira arquivo estático | **R$ 0** |
| **CRM** — imagens de produto e de seção enviadas pelo Admin | volume `real_valor_uploads` | Não | R$ 0 no disco do servidor |
| **E-mail** — a logo dentro dos templates | precisa de URL **absoluta pública** | — | **R$ 0** apontando para a da marca |

`resolveMediaUrl` (`frontend/src/lib/ui/media.ts`) devolve `/brand/...` intacto:
é o caso "imagem que vem no repositório". O banco guarda `/brand/hero.jpg`, não
uma URL absoluta — trocar de hospedagem **não reescreve nenhum registro**.

### A logo do e-mail

`frontend/public/brand/logo.png` — monograma RV, 420×420, fundo `#FFFCF7` (o
mesmo `.container` dos templates), ~48 KB, PNG sem canal alfa (nada de fundo
transparente virando cinza no Outlook).

```dotenv
EMAIL_LOGO_URL=https://realvalor.com.br/brand/logo.png
```

Use o **domínio próprio**, nunca a URL de preview do PaaS (`*-git-main.vercel.app`):
preview muda de endereço e o Gmail passa a mostrar ícone quebrado nos e-mails já
enviados.

O wordmark "REAL VALOR" não está na imagem porque o próprio template já o escreve
no rodapé, e "Alfaiataria feminina" logo abaixo do `<img>` — repetir no PNG
deixaria o cabeçalho redundante e mais pesado.

### Se um dia os uploads do CRM saírem do disco

O caminho é trocar o provider em `backend/medusa-config.ts` (bloco `file`,
linha ~228) para `@medusajs/medusa-file-s3` / R2. O banco guarda a **chave** do arquivo,
então a troca não mexe em conteúdo — mas exige migrar os arquivos já gravados no
volume. Só vale a pena no dia em que houver mais de um servidor.

Candidatos gratuitos:

| Serviço | Grátis | Observação |
|---|---|---|
| Cloudflare R2 | 10 GB + **egress ilimitado** | Cartão exigido; melhor opção para uploads |
| Supabase Storage | 1 GB | Projeto free **pausa** por inatividade |
| Vercel (estático) | Ilimitado p/ assets do build | Só para asset imutável — não é storage de upload |
| jsDelivr / GitHub raw | Grátis | Para biblioteca, não para imagem de loja; sem SLA |

## 3. Veredito sobre "tudo grátis"

| Peça | Onde cabe grátis | O que quebra |
|---|---|---|
| Frontend | Vercel Hobby / Cloudflare Pages | Vercel Hobby é **só uso não comercial** — loja viola os termos |
| Backend + Admin | Railway / Render free | Hibernam por inatividade → webhook de pagamento perdido |
| Postgres | Neon / Supabase free | Supabase free pausa o projeto → loja fora do ar |
| Uploads | volume do PaaS (1 GB) | Fora do plano pago, o volume some no redeploy |

**A conta honesta:** a combinação gratuita e estável é **frontend estático
(Cloudflare Pages, uso comercial permitido) + backend, Postgres e Redis num VPS
pequeno (~R$ 25–40/mês)**, com os uploads no disco do VPS. Um PaaS free que
hiberna custa mais caro em pedido perdido do que o VPS custa em dinheiro.

## 4. Ordem das coisas

1. ~~Logo em `frontend/public/brand/logo.png`~~ — feito.
2. Domínio apontado para onde o frontend estiver.
3. `STOREFRONT_URL` e `EMAIL_LOGO_URL` com o domínio final no `.env`.
4. `make recreate SERVICE=backend` (o Compose só lê `.env` no start).
5. Templates do Resend: `src="{{{LOGO_URL}}}"` (chaves triplas) e **publicar**.
6. Só então decidir a hospedagem do backend — os passos 1–5 não dependem dela.
