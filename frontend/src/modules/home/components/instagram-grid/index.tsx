import { type InstagramSection } from "@lib/content/home-sections"

import InstagramStrip from "./strip"
import { InstagramTile } from "./tile"

/**
 * Instagram strip — the final call-to-action band: handle, closing
 * statement and a row of square thumbnails.
 *
 * **A faixa anda sozinha, e a mão move.** As fotos atravessam a tela em laço,
 * devagar, e a rolagem para no mouse e no teclado. O movimento é o do ticker da
 * barra de anúncio (`styles/brand.css`: `.rv-marquee`, `.rv-marquee-track`,
 * `@keyframes rv-marquee`): o trilho recebe a lista duas vezes e anda metade da
 * própria largura, o que fecha o laço sem costura. As duas cópias são o mesmo
 * `map` sobre a mesma lista — a segunda sai com `aria-hidden` para o leitor de
 * tela ler as fotos uma vez só.
 *
 * **A faixa sangra; o cabeçalho não.** O título e o `@` ficam no `rv-container`
 * (a largura de leitura da página, com o respiro lateral) e a faixa é **irmã**
 * dele, no desenho abaixo: como a seção é `w-full`, irmã do container é a tela
 * inteira — as fotos atravessam de borda a borda em vez de pararem no respiro de
 * 1440px. A sangria não vira rolagem horizontal da página (o que passa da borda é
 * o trilho, e quem o apara é o `overflow: hidden` do `.rv-marquee`, que já era a
 * viewport do laço), e ela **não** precisa do `100vw` com margem negativa do
 * trilho do carrossel: aquela conta existe porque o trilho sangrado de lá mora
 * dentro do container, e este não mora.
 *
 * **Este arquivo continua sendo de servidor.** O que atravessa a fronteira é só o
 * gesto (`./strip.tsx`, a ilha de cliente): o `src` e o `alt` de cada quadro saem
 * no HTML da primeira pintura, como nas outras seções, e o laço de CSS funciona
 * sem JavaScript nenhum. O quadro é de `./tile.tsx`, e é **o mesmo** nos dois
 * lados — a faixa (cliente) e a grade de uma foto só (aqui, no servidor).
 *
 * O desenho do quadro é da régua (`.rv-insta-*`, `brand.css`), e as contas que o
 * CSS não pode fazer moram em `lib/util/marquee.ts`, com caso de borda (valor
 * ausente, banco antigo, contagem fora do normal) e teste próprio:
 *
 *   - **quantas vezes a lista se repete dentro de uma volta** (`marqueeCopies`).
 *     Sem isso, uma volta de quatro fotos termina antes da borda num monitor
 *     largo e a faixa entra em branco antes de a cópia chegar — um buraco à
 *     vista, uma vez por volta;
 *   - **quão devagar** (`marqueeSeconds`): o campo `secondsPerImage` é
 *     segundos **por imagem**, e o que o CSS anima é a volta inteira;
 *   - **quanto do relógio o dedo vale** (`marqueeSeekOffset`), que é o arrasto:
 *     a ilha de cliente não anima nada — ela adianta ou atrasa o mesmo relógio do
 *     CSS, e o valor em segundos é esta conta.
 *
 * Com **uma imagem só** não há laço, e a seção desenha a grade parada de sempre
 * (a mesma forma que ela tinha com quatro fotos, agora só no caso degenerado):
 * repetir a mesma foto oito vezes para preencher a tela seria uma faixa de
 * cópias, não uma faixa. Essa grade, sim, fica **dentro** do container — uma foto
 * sozinha é leitura, e leitura tem a largura da página.
 */
export default function InstagramGrid({
  section,
}: {
  section: InstagramSection
}) {
  const images = section.images ?? []

  return (
    <section className="rv-section-bg-preto rv-section-text-onmedia rv-section-pad w-full">
      <div className="rv-container">
        <header className="mx-auto max-w-[640px] text-center">
          {section.handle && (
            <p className="rv-eyebrow rv-section-accent-onmedia mb-5">
              {section.handle}
            </p>
          )}
          <h2 className="rv-display rv-section-heading-onmedia text-[28px] leading-tight small:text-[40px]">
            {section.title}
          </h2>
        </header>

        {/* Uma foto só: a grade parada de sempre (não há laço com uma
            imagem) — e ela fica no container, com o respiro da página. Com
            nenhuma, a seção é só o perfil e o título. */}
        {images.length === 1 && (
          <ul className="rv-insta-grid">
            <InstagramTile image={images[0]} />
          </ul>
        )}
      </div>

      {/* A faixa é **irmã do container**: é daqui que ela tira a tela inteira
          (o comentário do `brand.css` diz o mesmo, do lado do desenho). */}
      {images.length > 1 && (
        <InstagramStrip images={images} seconds={section.secondsPerImage} />
      )}
    </section>
  )
}
