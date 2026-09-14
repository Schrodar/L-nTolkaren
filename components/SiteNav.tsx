'use client';

import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { createPortal } from 'react-dom';

/**
 * Sajtens huvudnavigering — en enda källa för alla sidor.
 *
 * Låg tidigare kopierad ordagrant i varje page.tsx, vilket gjorde att varje ny
 * sida eller omdöpt länk krävde samma ändring på sex ställen.
 *
 * Under lg (1024 px) ryms inte de sex länkarna bredvid sidrubriken — raden
 * spillde ut utanför skärmen på mobil. Där tar en hamburgerknapp över och
 * länkarna ligger i en panel som fjädrar in från höger.
 *
 * Aktiv länk avgörs av exakt matchning mot sökvägen. Undersidor utan egen
 * länk (t.ex. /tidsavstamning/ao) markerar därför ingen länk alls — samma
 * beteende som de hårdkodade navigeringarna hade.
 */
const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Lönespec' },
  { href: '/tidsavstamning', label: 'Tidsavstämning' },
  { href: '/loneberakning', label: 'Löneberäkning' },
  { href: '/summering', label: 'Summering' },
  { href: '/tidsavstamning/hantera', label: 'Hantera' },
  { href: '/guide', label: 'Kom igång' },
];

const PANEL_ID = 'mobil-meny';

export function SiteNav() {
  return (
    <>
      <DesktopNav />
      <MobileNav />
    </>
  );
}

// ── Desktop: länkarna på rad ────────────────────────────────────────────────

const BASE_CLASS =
  'rounded-xl border border-white/15 px-3 py-2 text-sm font-medium';
const ACTIVE_CLASS = 'bg-white/10 text-[#F5F7FF] hover:bg-white/15';
const INACTIVE_CLASS = 'bg-white/5 text-[#F5F7FF]/90 hover:bg-white/10';

function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="hidden flex-wrap items-center gap-2 lg:flex"
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`${BASE_CLASS} ${active ? ACTIVE_CLASS : INACTIVE_CLASS}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ── Mobil: hamburgare + panel ───────────────────────────────────────────────

function MobileNav() {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = React.useState(false);

  // Knappen och panelen renderas i en portal direkt under <body>. Annars
  // fångas de av närmaste förälder med transform, filter eller backdrop-filter
  // — position:fixed utgår då från den föräldern i stället för från fönstret.
  // Startsidans sidhuvud har backdrop-blur, vilket klämde in hela menyn i en
  // 96 px hög remsa högst upp.
  const [monterad, setMonterad] = React.useState(false);
  React.useEffect(() => {
    setMonterad(true);
  }, []);

  // Panelen ska inte ligga kvar öppen ovanpå den sida man precis gick till.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);

    // Lås sidans scroll medan panelen ligger över den.
    const tidigareOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = tidigareOverflow;
    };
  }, [open]);

  // Med reducerad rörelse tonar panelen in i stället för att fjädra.
  const ladaVariants: Variants = reducedMotion
    ? {
        stangd: { opacity: 0, x: 0 },
        oppen: { opacity: 1, x: 0, transition: { duration: 0.15 } },
      }
    : {
        stangd: {
          x: '100%',
          transition: { type: 'spring', stiffness: 420, damping: 38 },
        },
        oppen: {
          x: 0,
          transition: {
            type: 'spring',
            stiffness: 380,
            damping: 32,
            staggerChildren: 0.04,
            delayChildren: 0.06,
          },
        },
      };

  const radVariants: Variants = reducedMotion
    ? { stangd: { opacity: 1 }, oppen: { opacity: 1 } }
    : {
        stangd: { opacity: 0, x: 24 },
        oppen: { opacity: 1, x: 0 },
      };

  const strecktransition = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 500, damping: 30 };

  if (!monterad) return null;

  return createPortal(
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={open ? 'Stäng meny' : 'Öppna meny'}
        className="fixed right-4 top-4 z-[60] flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-[#F5F7FF] backdrop-blur transition-colors hover:bg-white/15 sm:right-6 sm:top-6"
      >
        {/* Tre streck som viks ihop till ett kryss. Strecken centreras med
            negativ marginal i stället för translate — framer-motion äger
            transform-egenskapen och skulle annars skriva över den. */}
        <span aria-hidden="true" className="relative block h-4 w-6">
          <motion.span
            className="absolute left-0 top-1/2 -mt-px block h-[2px] w-6 rounded-full bg-current"
            animate={{ y: open ? 0 : -6, rotate: open ? 45 : 0 }}
            transition={strecktransition}
          />
          <motion.span
            className="absolute left-0 top-1/2 -mt-px block h-[2px] w-6 rounded-full bg-current"
            animate={{ opacity: open ? 0 : 1, scaleX: open ? 0.4 : 1 }}
            transition={strecktransition}
          />
          <motion.span
            className="absolute left-0 top-1/2 -mt-px block h-[2px] w-6 rounded-full bg-current"
            animate={{ y: open ? 0 : 6, rotate: open ? -45 : 0 }}
            transition={strecktransition}
          />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="bakgrund"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-[#050D1F]/70 backdrop-blur-sm"
            />

            <motion.div
              key="lada"
              id={PANEL_ID}
              variants={ladaVariants}
              initial="stangd"
              animate="oppen"
              exit="stangd"
              className="fixed inset-y-0 right-0 z-50 w-[min(80vw,320px)] overflow-y-auto border-l border-white/10 bg-[#0B1B3A] pb-8 pt-20 shadow-[-20px_0_40px_rgba(0,0,0,0.35)]"
            >
              <nav aria-label="Primary">
                {NAV_ITEMS.map((item, i) => {
                  const active = pathname === item.href;
                  return (
                    <React.Fragment key={item.href}>
                      {i > 0 && (
                        <div
                          aria-hidden="true"
                          className="mx-5 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
                        />
                      )}
                      <motion.div variants={radVariants}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          onClick={() => setOpen(false)}
                          className={`relative block px-5 py-4 text-base transition-colors ${
                            active
                              ? 'bg-white/10 font-semibold text-[#F5F7FF]'
                              : 'text-[#F5F7FF]/80 hover:bg-white/5'
                          }`}
                        >
                          {active && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-cyan-400"
                            />
                          )}
                          {item.label}
                        </Link>
                      </motion.div>
                    </React.Fragment>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
