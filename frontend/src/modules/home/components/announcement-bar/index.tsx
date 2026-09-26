import { appearanceVars } from "@lib/content/appearance"
import { type AnnouncementSection } from "@lib/content/home-sections"

/**
 * Announcement bar — the thin strip above the header.
 *
 * It lives in the (main) layout rather than in the page, because it is
 * site chrome (present on every route) instead of home content.
 * `section` comes from the announcement block so the copy stays
 * admin-editable, and it carries the block's appearance with it: the bar
 * paints its own fill (it is not wrapped by the home renderer), so it is
 * the component that turns `appearanceVars` into the `--rv-section-*`
 * variables. The bar is a single eyebrow line, so the colour lands on the
 * `<p>` and the fill on the wrapper.
 */
export default function AnnouncementBar({
  section,
}: {
  section?: AnnouncementSection
}) {
  return (
    <div
      className="rv-section rv-section-bg-preto w-full"
      style={appearanceVars(section ?? {})}
    >
      <div className="rv-container">
        <p className="rv-eyebrow rv-section-text-onmedia flex min-h-[38px] items-center justify-center text-center leading-none">
          {section?.text ?? "Frete seguro para todo o Brasil"}
        </p>
      </div>
    </div>
  )
}
