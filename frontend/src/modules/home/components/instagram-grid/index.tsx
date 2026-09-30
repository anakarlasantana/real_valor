import { type InstagramSection } from "@lib/content/home-sections"
import { resolveMediaUrl } from "@lib/util/media"
import Image from "next/image"

/**
 * Instagram strip — the final call-to-action band: handle, closing
 * statement and a row of square thumbnails.
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

        {images.length > 0 && (
          <ul className="mt-10 grid grid-cols-2 gap-3 small:mt-14 small:grid-cols-4">
            {images.map((image, index) => {
              // Só `imageUrl` cru poderia não virar `src` (ver
              // `lib/util/media.ts`): a célula continua no lugar, com o fundo
              // cacao, para a faixa não desmontar por causa de um item vazio.
              const src = resolveMediaUrl(image.imageUrl)

              return (
                <li
                  key={`${src ?? "sem-imagem"}-${index}`}
                  className="relative aspect-square w-full overflow-hidden bg-rv-cacao"
                >
                  {src && (
                    <Image
                      src={src}
                      alt={image.imageAlt}
                      fill
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      className="object-cover object-center transition-transform duration-500 ease-out hover:scale-[1.04]"
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
