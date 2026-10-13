/**
 * A faixa do Instagram: quantas vezes a lista se repete e quão devagar ela anda.
 * -------------------------------------------------------------------------
 * A seção do Instagram deixou de ser uma grade parada de quadros e passou a ser
 * uma **faixa que anda** — as mesmas fotos, na mesma ordem, atravessando a
 * largura em laço. O mecanismo é o do ticker da barra de anúncio
 * (`styles/brand.css`: `.rv-marquee`, `.rv-marquee-track`, `@keyframes
 * rv-marquee`): o trilho carrega a lista duas vezes e anda metade da própria
 * largura, o que fecha o laço sem costura, e **quem move a faixa é o CSS** — não
 * há relógio em JavaScript nenhum.
 *
 * O JavaScript do cliente é um só, e é o **arrasto** (`instagram-grid/strip.tsx`,
 * a faixa que a mão pega): ele não é uma segunda animação, é um *seek* da mesma —
 * o `animation-delay` do trilho, em segundos (a conta de `marqueeSeekOffset`). O
 * que este arquivo decide são as três contas que o CSS **não** pode fazer — e as
 * três têm caso de borda:
 *
 *   1. **Quantas vezes a lista se repete dentro de uma volta**
 *      (`marqueeCopies`). O `translateX(-50%)` do keyframe leva uma volta
 *      inteira pela tela; se a volta for mais estreita que a tela, a faixa entra
 *      em branco pela borda antes de a cópia chegar — um buraco à vista, uma vez
 *      por volta. Repetir a lista até a volta passar da largura é o que fecha
 *      isso, e o número não depende de medir a tela: repete-se até haver
 *      quadros suficientes para o pior caso (ver `MARQUEE_MIN_TILES`).
 *
 *   2. **Quão devagar a faixa anda** (`instagramSecondsPerImage` e
 *      `marqueeSeconds`). O campo `secondsPerImage` tem faixa declarada no
 *      contrato (`SECTION_FIELDS.instagram`, mínimo 3, máximo 12) e a API admin
 *      recusa valor fora dela — o que chega aqui, na prática, já está dentro. A
 *      função resolve o que a validação não cobre: ausente (base gravada antes
 *      de a faixa existir, `data` editado à mão) e lixo (`NaN` de campo vazio).
 *
 *   3. **Quanto do relógio o dedo vale** (`marqueeSeekOffset`). Arrastar a faixa
 *      não é outro movimento: é o mesmo, adiantado ou atrasado à mão. `dx` px de
 *      ponteiro valem `dx` px de trilho — e, como o trilho anda `period` px em
 *      `duration` segundos, os segundos que o arrasto vale são uma regra de três.
 *      É o que faz a foto acompanhar a mão sem atraso e sem adiantamento, e é a
 *      razão de a conta morar aqui, com teste, e não no meio do componente.
 *
 * A unidade do campo é **segundos por imagem**, e a conversão para a duração da
 * volta (segundos × quadros da volta) é a conta de `marqueeSeconds`: quem escolhe
 * o ritmo pensa na foto que atravessa a tela, não no laço que ele não vê.
 *
 * Os três números e a regra das cópias são espelho do contrato mantido à mão de
 * propósito — este é código de **cliente**, e importar `SECTION_FIELDS` aqui
 * levaria o contrato inteiro para o bundle do navegador por causa de três
 * números (o mesmo arranjo de `ticker.ts` e `launches.ts`). Quem confere o
 * espelho é `marquee.spec.ts` (o último `describe`): faixa divergente reprova
 * `make test`.
 */

/** Piso da faixa: abaixo disto a foto cruza rápido demais para ser vista. */
export const INSTAGRAM_SPEED_MIN = 3

/** Teto da faixa: acima disto a faixa parece parada (e parece quebrada). */
export const INSTAGRAM_SPEED_MAX = 12

/** A velocidade quando a seção não diz: a mesma do conteúdo padrão (6s). */
export const INSTAGRAM_SPEED_DEFAULT = 6

/**
 * Quantos quadros uma volta precisa ter, no mínimo, para cobrir a tela.
 *
 * O pior caso medido é o container da loja (`rv-container`, 1440px) com o
 * quadro no tamanho máximo (`clamp(200px, 24vw, 340px)`): 1440 ÷ (340 + 12 de
 * respiro) ≈ 4,1 quadros. Oito é o dobro disso — folga para o monitor largo e
 * para a conta não depender de uma medida de tela que o CSS é quem tem.
 */
export const MARQUEE_MIN_TILES = 8

/**
 * Quantas vezes a lista de imagens se repete dentro de uma volta da faixa.
 *
 * Sempre **1 ou mais** — a volta nunca é vazia, e a lista vazia não chega aqui
 * (a seção não desenha faixa nenhuma): o que a função garante é que uma volta
 * com duas fotos não fique com dois quadros no meio de uma tela de 1440px.
 *
 * Com uma imagem só devolve 1, e a seção **não** usa o resultado: uma foto
 * repetida oito vezes para preencher a tela é uma faixa de cópias, não uma
 * faixa — com uma imagem a seção desenha a grade parada de sempre.
 */
export function marqueeCopies(images: number): number {
  if (!Number.isFinite(images) || images < 2) {
    return 1
  }

  return Math.max(1, Math.ceil(MARQUEE_MIN_TILES / images))
}

/**
 * Segundos por imagem, dentro da faixa.
 *
 * Aceita número e string numérica (`6` e `"6"` são o mesmo valor — o `data` do
 * bloco é JSON, e o número pode ter virado texto numa edição), e aceita fração
 * (o campo é passo 1, mas a conta não depende disso). Número não finito cai no
 * padrão, e não no teto: um `Infinity` vindo de campo vazio é ausência de
 * informação, não pedido de faixa lenta.
 */
export function instagramSecondsPerImage(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value.trim())
        : Number.NaN

  if (!Number.isFinite(parsed)) {
    return INSTAGRAM_SPEED_DEFAULT
  }

  return Math.min(
    Math.max(parsed, INSTAGRAM_SPEED_MIN),
    INSTAGRAM_SPEED_MAX
  )
}

/**
 * A duração da **volta** da faixa, em segundos — o que o CSS anima.
 *
 * O `translateX(-50%)` do keyframe leva uma volta inteira (lista × cópias)
 * pela tela, então a duração é `segundos por imagem × quadros da volta`. É essa
 * multiplicação que faz o campo ser "por imagem" também na tela: cada quadro
 * leva o tempo escolhido para andar a própria largura, com quatro fotos ou com
 * dezesseis.
 *
 * Com menos de duas imagens a volta é a própria imagem (uma cópia): a seção não
 * chama esta conta nesse caso — ela desenha a grade parada —, e o valor serve
 * só para a função não ter um ramo que ninguém testa.
 */
export function marqueeSeconds(images: number, value: unknown): number {
  return instagramSecondsPerImage(value) * images * marqueeCopies(images)
}

/**
 * Quanto tempo de faixa vale um arrasto de `dx` px — o arrasto é um **seek**.
 *
 * O valor devolvido são **segundos de animação**: ele vai direto no
 * `animation-delay` do trilho (negativo, ver `instagram-grid/strip.tsx`), que é
 * como o ponteiro adianta ou atrasa o relógio que já está andando. A conta é a
 * regra de três do movimento — o trilho anda `period` px em `duration` segundos,
 * então `dx` px valem `(dx / period) × duration` segundos:
 *
 *   - **o sinal é o do gesto.** `dx` positivo é o ponteiro andando para a
 *     esquerda (o conteúdo anda para a esquerda, e a faixa adianta). Quem chama
 *     passa `xInicial - xAtual`, e não o contrário: com o sinal trocado a faixa
 *     anda ao contrário do dedo, e o defeito parece "peso", não erro de conta.
 *   - **o arrasto não é preso à volta.** Arrastar mais de uma volta vale mais de
 *     uma `duration`, e o navegador lê o resto da divisão sozinho: o laço continua
 *     fechado porque o valor é um número, e um `animation-delay` de 2,5 voltas
 *     desenha o mesmo que meio — sem nenhum estado de posição para sincronizar.
 *   - **medida ausente não anda nada.** `period` zero (a faixa medida antes de o
 *     CSS chegar) ou ponteiro sem coordenada dariam `NaN`, e um
 *     `animation-delay: -NaNs` é **ignorado em silêncio** pelo navegador: a faixa
 *     pararia de responder ao arrasto sem erro nenhum no console. Zero é o valor
 *     que mantém o trilho andando pela animação.
 */
export function marqueeSeekOffset(
  dx: number,
  period: number,
  duration: number
): number {
  if (
    !Number.isFinite(dx) ||
    !Number.isFinite(period) ||
    !Number.isFinite(duration) ||
    period <= 0 ||
    duration <= 0
  ) {
    return 0
  }

  return (dx / period) * duration
}
