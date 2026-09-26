"use client"

import { Popover, PopoverPanel, Transition } from "@headlessui/react"
import { ArrowRightMini, XMark } from "@medusajs/icons"
import { Text, clx, useToggleState } from "@medusajs/ui"
import { Fragment } from "react"

import { type NavSection } from "@lib/content/home-sections"
import NavLink from "../nav-link"
import CountrySelect from "../country-select"
import LanguageSelect from "../language-select"
import { HttpTypes } from "@medusajs/types"
import { Locale } from "@lib/data/locales"

/**
 * Mobile drawer.
 *
 * Rewritten from the Medusa starter's dark full-height panel into a
 * light surface that matches the prototype (and the rest of the brand):
 * off-white panel, cacao type, rose hover.
 *
 * It still uses the Headless UI `Popover`, so focus trapping, escape
 * handling and `aria-*` wiring keep working. The prototype's approach —
 * building the panel from an `innerHTML` string — was deliberately NOT
 * ported: it bypasses React, breaks focus management and is an
 * injection vector once the menu becomes admin-editable.
 *
 * The menu itself comes from the header block (`NavSection`): the same
 * `links` as the desktop bar, plus the action icons as a labelled row —
 * on a touch screen there is no tooltip, so the drawer shows the text.
 */
type SideMenuProps = {
  regions: HttpTypes.StoreRegion[] | null
  locales: Locale[] | null
  currentLocale: string | null
  header: NavSection
}

const SideMenu = ({
  regions,
  locales,
  currentLocale,
  header,
}: SideMenuProps) => {
  const countryToggleState = useToggleState()
  const languageToggleState = useToggleState()

  return (
    <div className="h-full">
      <div className="flex items-center h-full">
        <Popover className="h-full flex">
          {({ open, close }) => (
            <>
              <div className="relative flex h-full">
                <Popover.Button
                  data-testid="nav-menu-button"
                  aria-label="Abrir menu"
                  className="rv-eyebrow relative flex h-full items-center gap-2 text-rv-grafite transition-colors duration-200 ease-out hover:text-rv-rose focus:outline-none"
                >
                  {/* Hamburger — no icon dependency needed for two rules. */}
                  <span aria-hidden="true" className="flex flex-col gap-1">
                    <span className="block h-px w-5 bg-current" />
                    <span className="block h-px w-5 bg-current" />
                  </span>
                  Menu
                </Popover.Button>
              </div>

              {open && (
                <div
                  className="pointer-events-auto fixed inset-0 z-[50] bg-rv-preto/30"
                  onClick={close}
                  data-testid="side-menu-backdrop"
                />
              )}

              <Transition
                show={open}
                as={Fragment}
                enter="transition ease-out duration-150"
                enterFrom="opacity-0 -translate-y-2"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 -translate-y-2"
              >
                <PopoverPanel className="absolute inset-x-0 top-full z-[51] border-b border-rv-border bg-rv-offwhite shadow-[var(--rv-shadow-card-hover)]">
                  <div
                    data-testid="nav-menu-popup"
                    className="flex flex-col gap-8 p-6"
                  >
                    <div className="flex justify-end">
                      <button
                        data-testid="close-menu-button"
                        onClick={close}
                        aria-label="Fechar menu"
                        className="text-rv-grafite transition-colors duration-200 hover:text-rv-rose"
                      >
                        <XMark />
                      </button>
                    </div>

                    <ul className="flex flex-col items-start gap-5">
                      {header.links.map((link) => (
                        <li key={`${link.label}-${link.href}`}>
                          <NavLink
                            href={link.href}
                            label={link.label}
                            onClick={close}
                            className="rv-display text-2xl leading-none text-rv-grafite"
                            data-testid={`${link.label.toLowerCase()}-link`}
                          />
                        </li>
                      ))}
                    </ul>

                    <div className="flex flex-col gap-y-5 border-t border-rv-border pt-5">
                      {header.actions.length > 0 && (
                        <ul className="flex flex-col items-start gap-4">
                          {header.actions.map((action) => (
                            <li key={`${action.label}-${action.href}`}>
                              <NavLink
                                href={action.href}
                                label={action.label}
                                icon={action.icon}
                                variant="row"
                                onClick={close}
                                data-testid={`${action.label.toLowerCase()}-link`}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                      {!!locales?.length && (
                        <div
                          className="flex justify-between"
                          onMouseEnter={languageToggleState.open}
                          onMouseLeave={languageToggleState.close}
                        >
                          <LanguageSelect
                            toggleState={languageToggleState}
                            locales={locales}
                            currentLocale={currentLocale}
                          />
                          <ArrowRightMini
                            className={clx(
                              "transition-transform duration-150",
                              languageToggleState.state ? "-rotate-90" : ""
                            )}
                          />
                        </div>
                      )}
                      <div
                        className="flex justify-between"
                        onMouseEnter={countryToggleState.open}
                        onMouseLeave={countryToggleState.close}
                      >
                        {regions && (
                          <CountrySelect
                            toggleState={countryToggleState}
                            regions={regions}
                          />
                        )}
                        <ArrowRightMini
                          className={clx(
                            "transition-transform duration-150",
                            countryToggleState.state ? "-rotate-90" : ""
                          )}
                        />
                      </div>
                      <Text className="flex justify-between text-small-regular text-rv-muted">
                        © {new Date().getFullYear()} Real Valor. Todos os
                        direitos reservados.
                      </Text>
                    </div>
                  </div>
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    </div>
  )
}

export default SideMenu
