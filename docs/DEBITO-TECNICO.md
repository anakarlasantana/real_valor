# Débito Técnico — Real Valor

Registro dos débitos técnicos conhecidos, priorizados por severidade. Cada item traz
**evidência** (arquivo/linha ou comando de verificação) e **impacto**, para que possa ser
atacado sem redescobrir o contexto.

> Última atualização: 2026-09-26
> Escopo auditado: fase CMS (Etapas 2+3+4) concluída e validada, mais a varredura de 2026-09-26
> (**build hermético do storefront** — fonts self-hosted — **consolidação do Compose em um único
> modelo** e a **migração do rodapé para o CMS**, bloco `footer` com colunas e redes sociais). Os
> itens abaixo são o que **fica pendente** para uso em produção.

**Legenda de severidade**

| Nível | Significado |
|---|---|
| 🔴 **Bloqueador** | Impede vender / derruba ambiente. Corrigir antes de qualquer go-live. |
| 🟠 **Alto** | Quebra jornada visível do usuário ou expõe falha de segurança. |
| 🟡 **Médio** | Funciona, mas com atrito operacional ou risco de regressão silenciosa. |
| 🔵 **Baixo** | Polimento, SEO, qualidade de código. |

---

## Índice

O registro está em quatro assuntos, na ordem em que devem ser atacados. Os **números dos
itens são os mesmos de sempre** (`1.3` continua sendo `1.3`) — só mudaram de arquivo:

| Assunto | Arquivo | Itens |
|---|---|---|
| 🔴 Bloqueadores de produção | [`debito-01-bloqueadores.md`](debito-01-bloqueadores.md) | 1.1 – 1.3 |
| 🟠 Alto | [`debito-02-alto.md`](debito-02-alto.md) | 2.1 – 2.6 |
| 🟡 Médio, 🔵 Baixo e o que já está coberto | [`debito-03-medio-baixo.md`](debito-03-medio-baixo.md) | 3.1 – 3.5, 4.1 – 4.3, 5 |
| ⚠️ Ambiente Docker e ordem de ataque | [`debito-04-ambiente.md`](debito-04-ambiente.md) | 6.1 – 6.7, Ordem sugerida |

Cada item leva a evidência (arquivo/linha ou comando de verificação) junto, como antes.

### Citações por número, fora daqui

Há referências a itens espalhadas pelo repositório — `docker-compose.yml`, `.env.example` e
`frontend/src/styles/brand.css` citam `1.3` e outros por número. O mapa acima é o que liga o
número ao arquivo.
