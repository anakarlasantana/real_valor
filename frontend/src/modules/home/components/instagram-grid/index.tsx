import { type InstagramSection } from "@lib/content/home-sections"
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
    <section className="w-full bg-rv-preto py-16 text-rv-offwhite small:py-24">
      <div className="rv-container">
        <header className="mx-auto max-w-[640px] text-center">
          {section.handle && (
            <p className="rv-eyebrow mb-5 text-rv-dourado">{section.handle}</p>
          )}
          <h2 className="rv-display text-[28px] leading-tight text-rv-offwhite small:text-[40px]">
            {section.title}
          </h2>
        </header>

        {images.length > 0 && (
          <ul className="mt-10 grid grid-cols-2 gap-3 small:mt-14 small:grid-cols-4">
            {images.map((image, index) => (
              <li
                key={`${image.imageUrl}-${index}`}
                className="relative aspect-square w-full overflow-hidden bg-rv-cacao"
              >
                <Image
                  src={image.imageUrl}
                  alt={image.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-cover object-center transition-transform duration-500 ease-out hover:scale-[1.04]"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
