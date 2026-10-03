# 02 — Análise do Site de Referência

**Referência:** https://layzaguiar.com.br/ (Shopify) · **Data:** 10/02/2026
**Finalidade:** extrair padrões de **estrutura, UX e interação**. Nenhum texto, imagem, logotipo ou
identidade visual foi copiado.

---

## 2.1 Método e limites desta análise

A home do site excede 5 MB e não pôde ser capturada diretamente. A análise foi feita por três rotas
secundárias, que juntos dão a mesma informação estrutural:

| Rota | O que extraímos |
| :--- | :--- |
| `/quem-somos/` | conteúdo de marca, rodapé, navegação completa, cartões do carrinho |
| `/collections/vestidos` | catálogo, filtros, ordenação, anatomia do card |
| `/products/vestido-ariel-azul` | PDP completa, variante, frete, pagamento, relacionados |

**Limitação registrada:** analisamos **estrutura e rótulos**, não pixels. Cores exatas, pesos
tipográficos e espaçamentos em px **não foram medidos** — e não foram inferidos. Onde este
documento sugere medida visual, isso está marcado como *a definir*, não como fato.

---

## 2.2 Arquitetura de informação da referência

### Navegação (extraída da página institucional)

```
OS MAIS DESEJADOS      ← item com destaque visualmente distinto (estrela)
LINHA - BASIC
NOT BASIC
OUTLET ATÉ 80%OFF
── divider ──
VESTIDOS · BLUSAS · SHORTS · CALÇAS · CONJUNTOS · CAMISAS · MACACÃO
TOP E CROPPEDS · COLETES · BODYS · SAIAS · BLAZERS
SEGUNDA PELE
── divider ──
COLEÇÃO SOLAR · COLEÇÃO LAISE
```

**Contagem:** 20+ itens de navegação para uma marca com um punhado de categorias.

**Leitura UX:** o menu é organizado por **atitude de compra** (`Mais desejados`, `Outlet`,
`Novidades`) misturado com **tipo de peça** (`Vestidos`, `Blusas`). São dois eixos diferentes na
mesma lista — o que obriga a cliente a percorrer tudo para achar "calças".

### Rodapé

- Newsletter ("Assine nossa newsletter") com campo único
- Coluna **Produtos** (links de política e navegação)
- Coluna **Opções** (Personal Shopper, rastreio)
- **Contato** com telefone, e-mail e endereço físico completo
- Rodapé legal com CNPJ e copyright

---

## 2.3 Padrões identificados e como aplicar na Real Valor

Formato da seção 3 do briefing:
**Referência → Como aplicar na Real Valor → Motivo → Impacto esperado**

### NAVEGAÇÃO

#### N-01 · Menu com eixo único por seção
**Referência:** mistura "atitude" (Outlet, Mais desejados) e "tipo de peça" (Vestidos, Blusas) no
mesmo dropdown.

**Como aplicar:** a Real Valor já tem menu **editável pelo CMS** (`nav.links` no bloco `nav`).
Manter **uma coluna só** no menu desktop, com itens em ordem deliberada — e usar o `launches-rail`
e o `featured` da home para dar o eixo "atitude" sem inflar o menu.

**Motivo:** o menu da Real Valor é conteúdo, não código (`layout/templates/nav` recebe `header` do
CMS). A decisão é de configuração, não de implementação — o CMS já permite isso.

**Impacto esperado:** menu cabe em uma linha no desktop, sem truncar; hierarquia visual mais forte;
a curadoria fica a cargo do lojista, sem deploy.

#### N-02 · Menu mobile em drawer, agrupado
**Referência:** mantém a taxonomia completa no drawer.

**Como aplicar:** **já implementado** — `modules/layout/components/side-menu`. Reaproveitar, com um
ajuste: no drawer, agrupar em accordions (por linha de produto / por ocasião), porque 20 itens em
lista única num celular exigem scroll longo.

**Motivo:** o drawer existe; só a organização interna dos grupos precisa de decisão.

**Impacto esperado:** navegação mobile mais curta; hierarquia de 2 níveis cabe na tela.

### CATÁLOGO

#### C-01 · Filtros por cor, tamanho e faixa de preço com contagem
**Referência:** facetas com **contagem de produtos** — "Preto (4)", "Vermelho (2)", "Creme (1)";
tamanho "P (48) M (48) G (48)"; preço "De / Até". Cada faceta com "Ver todos / Ver menos".

**Como aplicar:** implementar em `refinement-list/index.tsx` (hoje com 41 linhas, só ordenação),
usando `option_value` do Medusa como fonte das facetas. A contagem vem de `GET /store/products`
com os mesmos filtros aplicados.

**Motivo:** é a lacuna mais concreta do catálogo (auditoria P5) e é o padrão mais forte da referência.

**Impacto esperado:** a cliente encontra "vestido preto P" sem navegar por três níveis; cada link de
faceta vira uma URL indexável — ganho duplo em conversão e em SEO de cauda longa.

#### C-02 · Filtros no mobile como botão que abre drawer
**Referência:** botão "Filtrar" que abre painel sobreposto; os chips de filtro ativos ficam visíveis.

**Como aplicar:** no mobile, a coluna de filtros vai para um drawer; cada filtro aplicado vira um
**chip removível** acima da grade.

**Motivo:** a coluna de filtros de desktop (largura mínima `250px`) não cabe em 375px.

**Impacto esperado:** nenhum scroll horizontal; o estado do filtro fica sempre visível e reversível
com um toque.

#### C-03 · "Mostrar mais produtos" em vez de paginação numérica
**Referência:** a listagem carrega mais itens sob demanda.

**Como aplicar:** o projeto **já tem paginação** (`modules/store/components/pagination`), e ela é
melhor para SEO (URLs distintas por página). **Manter a paginação** e não adotar este ponto.

**Motivo:** em catálogo médio, paginação numérica gera mais páginas indexáveis.

**Impacto esperado:** SEO preservado; navegação previsível.

#### C-04 · Chips de tamanho no card do produto
**Referência:** cada card mostra "Tamanho P M G" abaixo do preço.

**Como aplicar:** exibir no card apenas **se o produto tiver mais de uma variante de tamanho**, e
apenas como informação visual (sem clique), para não prometer uma ação que o card não executa.

**Motivo:** o card atual (`product-preview`) é um link único para a PDP; adicionar seleção de tamanho
no card exigiria mudar a navegação para que o tamanho escolhido vá para a PDP.

**Impacto esperado:** a cliente filtra visualmente no catálogo e chega à PDP já sabendo o que procura.

#### C-05 · Preço Pix destacado + parcelamento no card
**Referência:** "R$189,91 com Pix" e "5x de R$39,98 sem juros" logo abaixo do preço à vista.

**Como aplicar:** mostrar no card o preço Pix quando houver desconto ativo, e o parcelamento no
cálculo de `CheckoutSummary`. Ambos vêm do provedor de pagamento — a informação vem da camada de
pagamento (Fase 0), não de hardcode.

**Motivo:** Pix e parcelamento são a razão de escolher o Mercado Pago; o card precisa refletir isso.

**Impacto esperado:** o benefício aparece antes da PDP, exatamente onde a decisão de preço acontece.

### PÁGINA DE PRODUTO

#### P-01 · Guia de medidas linkado ao seletor de tamanho
**Referência:** "Guia de medidas" aparece **duas vezes**, ao lado do seletor de tamanho.

**Como aplicar:** link para uma página de guia de medidas por produto, alcançável a partir do
seletor de tamanho na PDP.

**Motivo:** a maior causa de devolução em moda é tamanho. A referência reconhece isso colocando o
link no ponto de maior dor.

**Impacto esperado:** redução de devolução e de troca — em e-commerce de moda, isso é perda direta.

> **Dependência de modelagem:** a tabela de medidas é **dado por produto**. Hoje não existe estrutura
> para isso. É decisão de modelagem (metadata ou módulo), não só de UI. Registrado como incerteza
> em `01-auditoria-projeto.md`, item 6.

#### P-02 · Mensagem de urgência quando estoque é baixo
**Referência:** "Atenção, última peça!" exibida quando o estoque é crítico.

**Como aplicar:** **reutilizar o que já existe.** `lib/util/product-availability.ts` já define o
limiar de "últimas unidades" e o `ProductStatusChip` já o exibe — e a mesma função decide o botão de
compra. Falta apenas garantir que o texto apareça **também junto ao seletor de tamanho**, não só no card.

**Motivo:** a regra já existe e é unificada de propósito (ver comentário nas linhas 97–102 de
`product-actions`). Reusar é obrigatório, senão o card volta a prometer o que o botão recusa.

**Impacto esperado:** consistência entre card e PDP, sem duplicar regra.

#### P-03 · Calculadora de frete na PDP
**Referência:** campo de CEP com "Alterar CEP" / "Não sei meu CEP", dentro da PDP.

**Como aplicar:** campo de CEP na PDP que consulta a opção de envio e atualiza custo e prazo.
**É também o consumidor da camada de frete** (o provider de fulfillment do Medusa, RV-006).

**Motivo:** reduz abandono pós-adição — a dúvida de frete aparece antes do carrinho.

**Impacto esperado:** menos abandono entre PDP e carrinho.

#### P-04 · Métodos de pagamento visíveis na PDP
**Referência:** bloco "Meios de pagamento" com as modalidades e o desconto aplicável.

**Como aplicar:** bloco na PDP listando os meios ativos (Pix com desconto, cartão parcelado),
alimentado pelo **registry de pagamento** — sem hardcode.

**Motivo:** com a camada de abstração, a lista vem do backend; a PDP não conhece Mercado Pago.

**Impacto esperado:** confiança antes do checkout; e a PDP muda sozinha quando o provedor muda.

#### P-05 · Bloco de descrição com medidas da modelo e cuidados
**Referência:** "Altura da modelo: 1,69m. Peso da Modelo: 55 kg" e link para cuidados de lavagem.

**Como aplicar:** campos de modelo em `metadata` do produto (exibidos só se preenchidos) e página
institucional de cuidados.

**Motivo:** dado simples em `metadata`; não exige módulo novo.

**Impacto esperado:** menos devolução por expectativa de caimento.

#### P-06 · Relacionados com padrão de complementaridade
**Referência:** relacionados que misturam a mesma categoria com itens de corpo parecido.

**Como aplicar:** o componente `related-products` **já existe**. Avaliar se a ordenação usa a mesma
categoria e, se não usa, complementa com a mesma — usando os links já existentes
(`links/content-section-product.ts` dá o padrão).

**Motivo:** reaproveitar; a melhoria é de ordenação, não de componente.

**Impacto esperado:** maior ticket médio por sessão.

### IDENTIDADE VISUAL (medidas *a definir* — não extraídas)

| Atributo | Referência | Real Valor (atual) |
| :--- | :--- | :--- |
| Tipografia | *a definir* | Playfair Display (títulos), Montserrat (interface), Allura (assinaturas) — **definido** |
| Paleta | *a definir* | Rosa Queimado `#B97872`, Off White `#F7F1E8`, Cacau `#4A3531`, Grafite `#303033`, Preto `#171717`, Dourado Rosé `#D4B19A` — **definido** |
| Espaçamento | *a definir* | escala via `--rv-section-space` — **definido** |
| Radius | *a definir* | `--rv-radius-sm: 2px` a `--rv-radius-xl: 16px` — **definido** |
| Movimento | *a definir* | `--rv-duration: 200ms`, `--rv-motion-slow: 640ms` — **definido** |

**A Real Valor já tem identidade visual completa e independente.** A referência não traz nada a
copiar nessa dimensão — e o briefing é explícito sobre isso. Este documento **não** sugere alterar
paleta, tipografia ou movimento.

---

## 2.4 O que NÃO copiar da referência

Registrado porque a referência **tem defeitos reais**, observados no HTML capturado:

| Defeito | Evidência | Por que não replicar |
| :--- | :--- | :--- |
| Contador de desconto quebrado | "0 % OFF" em todos os cards, mesmo com preço promocional | Bug de template; a Real Valor calcula com `get-percentage-diff` |
| Preço zerado no HTML | "R$0,00" repetido em vários blocos do carrinho | Artefato de hidratação do tema |
| Navegação sobrecarregada | 20+ itens no menu | Ruído visual; a Real Valor resolve com trilhos na home |
| Urgência repetitiva | "Última peça!" como regra padrão | Perde credibilidade quando usada sempre |
| Menu de inertial scroll | 4 listas quase duplicadas no DOM | Peso de HTML desnecessário |

**Nenhum destes vai para a Real Valor.** O que se aproveita é a **estrutura** (facetas com contagem,
guia de medidas, frete na PDP), não a execução.

---

## 2.5 Síntese

A referência é um Shopify de moda com **fortes práticas de descoberta de produto** (facetas com
contagem, guia de medidas, frete na PDP) e **fraca disciplina editorial** (menu inflado, urgência
repetitiva, bugs de preço).

**A Real Valor deve tomar o primeiro grupo e recusar o segundo.** Em ambos os casos, a boa notícia é
que quase todo o primeiro grupo pode ser construído **sobre componentes que já existem** no projeto:
`refinement-list`, `product-actions`, `related-products`, `product-availability` e o carrinho com
frete.

Ver `03-gap-analysis.md` para a priorização.