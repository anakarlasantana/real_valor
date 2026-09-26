import { type AnnouncementSection } from "@lib/content/home-sections"

/**
 * Announcement bar — the thin strip above the header.
 *
 * It lives in the (main) layout rather than in the page, because it is
 * site chrome (present on every route) instead of home content.
 * `text` comes from the announcement section so the copy stays
 * admin-editable later.
 */
export default function AnnouncementBar({
  text,
}: {
  text: AnnouncementSection["text"]
}) {
  return (
    <div className="w-full bg-rv-preto text-rv-offwhite">
      <div className="rv-container">
        <p className="rv-eyebrow flex min-h-[38px] items-center justify-center text-center leading-none">
          {text}
        </p>
      </div>
    </div>
  )
}
