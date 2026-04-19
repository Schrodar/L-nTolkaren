'use client';

import Link from 'next/link';

const DOT = {
  blue: 'bg-blue-500',
  green: 'bg-green-400',
  red: 'bg-red-400',
  amber: 'bg-amber-400',
  violet: 'bg-violet-400',
  teal: 'bg-teal-400',
  cyan: 'bg-cyan-400',
} as const;

function Dot({ color }: { color: keyof typeof DOT }) {
  return <span className={`mt-[0.35rem] h-2.5 w-2.5 shrink-0 rounded-full ${DOT[color]}`} />;
}

function Item({
  color,
  label,
  desc,
}: {
  color: keyof typeof DOT;
  label: string;
  desc: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 rounded-[10px] border border-white/[0.08] bg-[#0d1e3a] p-4 transition-colors hover:border-white/[0.14]">
      <div className="row-span-2 flex items-start pt-[0.15rem]">
        <Dot color={color} />
      </div>
      <div className="text-[0.9rem] font-medium text-[#e8edf8]">{label}</div>
      <div className="text-[0.85rem] leading-relaxed text-[#e8edf8]/50">{desc}</div>
    </div>
  );
}

function SectionHeader({
  num,
  title,
  url,
}: {
  num: string;
  title: string;
  url?: string;
}) {
  return (
    <div className="mb-6 flex items-center gap-4 border-b border-white/[0.08] pb-4">
      <span className="rounded-md border border-blue-500/25 bg-blue-500/10 px-2.5 py-0.5 font-mono text-[0.7rem] tracking-wide text-blue-500">
        {num}
      </span>
      <h2 className="text-[1.3rem] font-semibold tracking-[-0.02em] text-[#e8edf8]">{title}</h2>
      {url && (
        <span className="ml-auto font-mono text-xs text-[#e8edf8]/50">{url}</span>
      )}
    </div>
  );
}

function Screenshot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-white/[0.14] bg-[#0d1e3a]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="block w-full" />
      <div className="border-t border-white/[0.08] px-4 py-3 font-mono text-[0.78rem] text-[#e8edf8]/50">
        {caption}
      </div>
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="min-h-dvh bg-[#0B1B3A] text-[#e8edf8]">
      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-white/[0.08] bg-[#08132a]/[0.92] px-8 py-5 backdrop-blur-xl">
        <span className="font-mono text-[0.9rem] tracking-wide text-cyan-400">lönetolkaren</span>
        <div className="flex gap-3">
          <Link
            href="/"
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-[#F5F7FF]/90 hover:bg-white/10"
          >
            Lönespec
          </Link>
          <Link
            href="/loneberakning"
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-[#F5F7FF]/90 hover:bg-white/10"
          >
            Löneberäkning
          </Link>
          <Link
            href="/loneberakning/hantera"
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-[#F5F7FF]/90 hover:bg-white/10"
          >
            Hantera
          </Link>
          <Link
            href="/faq"
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15"
          >
            Hjälp
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <div className="mx-auto max-w-[860px] px-8 pb-12 pt-20">
        <div className="mb-4 font-mono text-xs uppercase tracking-[0.12em] text-cyan-400">
          Hjälp &amp; dokumentation
        </div>
        <h1 className="mb-5 text-[clamp(2rem,5vw,3.2rem)] font-semibold leading-[1.15] tracking-[-0.03em]">
          Så använder du Lönetolkaren
        </h1>
        <p className="max-w-[600px] text-[1.05rem] leading-[1.7] text-[#e8edf8]/50">
          En guide till alla funktioner — från att ladda upp en lönespec till att jämföra timmar mot
          AO-schema och räkna ut estimerad bruttolön.
        </p>
      </div>

      {/* TOC */}
      <div className="mx-auto mb-12 flex max-w-[860px] flex-wrap gap-2.5 px-8">
        <a href="#lonespec" className="rounded-full border border-white/[0.14] px-4 py-1.5 font-mono text-[0.8rem] text-[#e8edf8]/50 transition-colors hover:border-blue-500 hover:bg-blue-500/[0.08] hover:text-[#e8edf8]">01 · Lönespec</a>
        <a href="#loneberakning" className="rounded-full border border-white/[0.14] px-4 py-1.5 font-mono text-[0.8rem] text-[#e8edf8]/50 transition-colors hover:border-blue-500 hover:bg-blue-500/[0.08] hover:text-[#e8edf8]">02 · Löneberäkning</a>
        <a href="#kalender" className="rounded-full border border-white/[0.14] px-4 py-1.5 font-mono text-[0.8rem] text-[#e8edf8]/50 transition-colors hover:border-blue-500 hover:bg-blue-500/[0.08] hover:text-[#e8edf8]">03 · Kalender &amp; import</a>
        <a href="#hantera" className="rounded-full border border-white/[0.14] px-4 py-1.5 font-mono text-[0.8rem] text-[#e8edf8]/50 transition-colors hover:border-blue-500 hover:bg-blue-500/[0.08] hover:text-[#e8edf8]">04 · Hantera data</a>
        <a href="#fargkoder" className="rounded-full border border-white/[0.14] px-4 py-1.5 font-mono text-[0.8rem] text-[#e8edf8]/50 transition-colors hover:border-blue-500 hover:bg-blue-500/[0.08] hover:text-[#e8edf8]">05 · Färgkoder</a>
      </div>

      {/* MAIN */}
      <main className="mx-auto max-w-[860px] px-8 pb-24">
        {/* SECTION 1 — Lönespec */}
        <section className="mb-16" id="lonespec">
          <SectionHeader num="01" title="Lönespec-sidan" url="/" />

          <Screenshot src="/1.png" alt="PDF-uppladdning" caption="fig. 1 — PDF-uppladdning" />

          <div className="flex flex-col gap-3">
            <Item color="blue" label="Välj PDF" desc='Klicka på "Välj PDF" eller dra och släpp din lönespecifikation direkt i rutan. Filen lämnar aldrig datorn — all text extraheras lokalt i webbläsaren.' />
            <Item color="cyan" label="Tolka lönespecifikation" desc="Klicka på knappen efter att en fil valts. Parsern identifierar automatiskt art-koder, timmar, datum och belopp från PDF:en." />
          </div>

          <div className="h-6" />

          <Screenshot src="/2.png" alt="Spara till löneberäkning" caption="fig. 2 — Spara till löneberäkning" />

          <div className="flex flex-col gap-3">
            <Item color="green" label="Spara till löneberäkning" desc="Visas efter att tolkningen är klar. Sparar lönespecen per månad och person i webbläsarens lokala lagring. Den kan sedan importeras direkt i löneberäkningsmallen för att jämföra mot AO-schemat." />
            <Item color="amber" label="Rensa" desc="Rensar det visade resultatet från skärmen. Den sparade lönespecen i lagringen påverkas inte — den finns kvar under Hantera data." />
          </div>
        </section>

        <hr className="my-12 border-t border-white/[0.08]" />

        {/* SECTION 2 — Löneberäkning */}
        <section className="mb-16" id="loneberakning">
          <SectionHeader num="02" title="Löneberäkning — inställningar" url="/loneberakning" />

          <Screenshot src="/4.png" alt="Ladda upp AO" caption="fig. 4 — Ladda upp AO-schema" />

          <div className="flex flex-col gap-3">
            <Item color="blue" label="Ladda upp AO (Excel)" desc="Ladda upp arbetsordningen som Excel-fil (.xlsx). AO-schemat används för att visa arbetstider per dag i kalendern. Flera scheman kan laddas upp för olika perioder — de sparas på servern och finns kvar tills du tar bort dem under Hantera data." />
            <Item color="violet" label="Anställningstyp och nivå" desc="Välj månadslön, timlön säsong eller timlön korttid, samt anciennitetsnivå (Beg, 1 år, 2 år etc.). Tariffen väljs automatiskt baserat på kalenderåret — 2025 eller 2026." />
            <Item color="teal" label="Tillägg" desc="Aktivera maskinskötstillägg, rederitillägg och däckmanstillägg om de ingår i din anställning. Beloppen räknas automatiskt in i summerings-panelen." />
          </div>
        </section>

        <hr className="my-12 border-t border-white/[0.08]" />

        {/* SECTION 3 — Kalender */}
        <section className="mb-16" id="kalender">
          <SectionHeader num="03" title="Kalender & lönespec-import" url="/loneberakning" />

          <Screenshot src="/5.png" alt="Kalender med lönespec-import" caption="fig. 5 — Kalender med AO-schema och lönespec-import" />


          <div className="flex flex-col gap-3">
            <Item color="blue" label="Välj båt och månad" desc="Välj fartyg i dropdown-menyn. Kalender visar schemat från det uppladdade AO:t. Navigera mellan månader med knapparna eller byt år i menyn till höger." />
            <Item color="violet" label="Markera pass" desc="Klicka på punkten uppe till höger i en dag för att markera ett arbetat pass. Punkten blir grön. Vid flera crews visas en punkt per crew — klicka bara din egen. Klicka på veckonumret till vänster för att markera alla pass den veckan på en gång." />
            <Item color="cyan" label="Ladda lönespec" desc="Hämtar sparad lönespec för aktuell månad. Om flera lönespecar finns (olika personer) visas en lista att välja från. Om inget AO-schema är laddat för perioden visas en varning." />
            <Item color="green" label="Importera från lönespec" desc="Skriver in ordinarie tid, övertid, maskindagar och sjukdagar från lönespecen i kalendern. Timmarna jämförs mot AO-schemat per dag — om skillnaden är mer än 0,1 timme markeras dagen med en röd punkt." />
            <Item color="amber" label="Manuell inmatning" desc="Klicka på en dag för att öppna dagmodalen. Fyll i ordinarie tid manuellt om du jobbat utan AO, eller lägg till övertid för dagen. Beräkningen uppdateras direkt i summerings-panelen." />
          </div>
        </section>

        <hr className="my-12 border-t border-white/[0.08]" />

        {/* SECTION 4 — Hantera data */}
        <section className="mb-16" id="hantera">
          <SectionHeader num="04" title="Hantera data" url="/loneberakning/hantera" />

          <Screenshot src="/3.png" alt="Hantera data" caption="fig. 3 — Hantera sparade lönespecar och AO-scheman" />

          <div className="flex flex-col gap-3">
            <Item color="blue" label="Sparade lönespecar" desc='Visar alla inlästa lönespecar med månad, namn och filnamn. Varje lönespec sparas per månad och person — samma månad kan ha flera lönespecar för olika anställda. Klicka "Ta bort" för att radera en specifik lönespec.' />
            <Item color="violet" label="AO-scheman" desc='Visar alla uppladdade AO-scheman med fartygsnamn och giltighetsperiod. Klicka "Ladda upp nytt AO" för att lägga till ett schema. Flera scheman kan finnas samtidigt om perioderna inte överlappar.' />
          </div>
        </section>

        <hr className="my-12 border-t border-white/[0.08]" />

        {/* SECTION 5 — Färgkoder */}
        <section className="mb-16" id="fargkoder">
          <SectionHeader num="05" title="Färgkoder i kalendern" />

          <div className="flex flex-col gap-3">
            <Item color="violet" label="Lila punkt" desc="Passet är ej markerat. AO-schemat visar att det finns arbetstid denna dag." />
            <Item color="green" label="Grön punkt" desc="Passet är markerat som arbetat. Timmarna stämmer mot lönespecen (om lönespec är importerad) — differens inom 0,1 timme." />
            <Item color="red" label="Röd punkt" desc="Avvikelse — lönespecens timmar och AO-schemats timmar skiljer sig mer än 0,1 timme. Hovra över cellen för att se exakta värden." />
          </div>

          <div className="h-5" />

          <div className="mb-4 flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 rounded-md border border-red-400/30 bg-red-400/[0.12] px-3 py-1 text-xs font-medium text-red-400">
              OB = Storhelg — påsk, pingst, midsommar, jul, nyår. OB hela dygnet. Övertid ÷72.
            </span>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 rounded-md border border-violet-400/30 bg-violet-400/[0.15] px-3 py-1 text-xs font-medium text-violet-400">
              sh = Småhelg — trettondagen, 1 maj, Kristi himmelsfärd, 6 juni, Alla helgons dag. OB hela dygnet. Övertid ÷72.
            </span>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 rounded-md border border-violet-400/30 bg-violet-400/[0.15] px-3 py-1 text-xs font-medium text-violet-400">
              OB (violett) = Fredag eller dag före storhelg. OB hela dygnet. Övertid ÷104 (vardag).
            </span>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 rounded-md border border-violet-400/30 bg-violet-400/[0.15] px-3 py-1 text-xs font-medium text-violet-400">
              Avv = Avvikande schema denna dag enligt AO-schemat.
            </span>
          </div>
        </section>

        {/* DEV NOTICE */}
        <div className="flex gap-5 rounded-xl border border-amber-400/25 bg-amber-400/5 p-6">
          <div className="shrink-0 text-2xl">⚠️</div>
          <div>
            <div className="mb-1.5 text-[0.95rem] font-semibold text-amber-400">
              Appen är under aktiv utveckling
            </div>
            <div className="text-[0.85rem] leading-relaxed text-[#e8edf8]/50">
              Funktioner kan förändras och nya tillkommer löpande. Hittar du ett fel, något som inte
              stämmer med avtalet, eller har förslag på förbättringar — skicka gärna ett mail till{' '}
              <a href="mailto:schrodar@gmail.com" className="text-cyan-400 hover:underline">
                schrodar@gmail.com
              </a>
              .
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
