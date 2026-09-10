'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Sajtens huvudnavigering — en enda källa för alla sidor.
 *
 * Låg tidigare kopierad ordagrant i varje page.tsx, vilket gjorde att varje ny
 * sida eller omdöpt länk krävde samma ändring på sex ställen.
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

const BASE_CLASS =
  'rounded-xl border border-white/15 px-3 py-2 text-sm font-medium';
const ACTIVE_CLASS = 'bg-white/10 text-[#F5F7FF] hover:bg-white/15';
const INACTIVE_CLASS = 'bg-white/5 text-[#F5F7FF]/90 hover:bg-white/10';

export function SiteNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={className ?? 'flex flex-wrap items-center gap-2'}
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
