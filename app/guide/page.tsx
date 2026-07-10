'use client';

import Link from 'next/link';

function Step({
  num,
  title,
  page,
  children,
}: {
  num: string;
  title: string;
  page?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className="relative pl-16">
      {/* Stegnummer */}
      <div className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-400/10 font-mono text-base font-semibold text-cyan-300">
        {num}
      </div>
      <div className="rounded-xl border border-white/[0.1] bg-[#0d1e3a] p-5">
        <div className="mb-2 flex flex-wrap items-baseline gap-3">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-[#e8edf8]">{title}</h2>
          {page && (
            <Link
              href={page.href}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-0.5 font-mono text-xs text-cyan-300 hover:bg-white/10"
            >
              {page.label} →
            </Link>
          )}
        </div>
        <div className="space-y-2 text-[0.9rem] leading-relaxed text-[#e8edf8]/70">
          {children}
        </div>
      </div>
    </section>
  );
}

function Connector() {
  return <div className="ml-[1.35rem] h-6 w-px bg-white/15" />;
}

export default function GuidePage() {
  return (
    <div className="min-h-dvh bg-[#0B1B3A] text-[#e8edf8]">
      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-white/[0.08] bg-[#08132a]/[0.92] px-8 py-5 backdrop-blur-xl">
        <span className="font-mono text-[0.9rem] tracking-wide text-cyan-400">lönetolkaren</span>
        <div className="flex flex-wrap gap-3">
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
            href="/guide"
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15"
          >
            Kom igång
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <div className="mx-auto max-w-[760px] px-8 pb-10 pt-16">
        <div className="mb-4 font-mono text-xs uppercase tracking-[0.12em] text-cyan-400">
          Kom igång — steg för steg
        </div>
        <h1 className="mb-5 text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.15] tracking-[-0.03em]">
          Från lönespec till jämförd lön
        </h1>
        <p className="max-w-[600px] text-[1.05rem] leading-[1.7] text-[#e8edf8]/50">
          Följ stegen i ordning första gången. När allt är på plats behöver du
          bara göra steg 1–3 och 7–8 varje månad — AO:n ligger kvar i webbläsaren.
        </p>
      </div>

      {/* STEG */}
      <main className="mx-auto max-w-[760px] space-y-0 px-8 pb-24">
        <Step num="1" title="Ladda upp din lönespec (PDF)" page={{ label: 'Lönespec', href: '/' }}>
          <p>
            Gå till <strong className="text-[#e8edf8]">Lönespec</strong>-sidan och dra och släpp din
            lönespecifikation i rutan, eller klicka <em>Välj PDF</em>. Filen lämnar aldrig din dator
            — all tolkning sker lokalt i webbläsaren.
          </p>
        </Step>
        <Connector />

        <Step num="2" title="Tolka lönespecifikationen">
          <p>
            Klicka på <strong className="text-[#e8edf8]">Tolka lönespecifikation</strong>. Sidan
            läser ut arbetstid, övertid, OB, maskindagar, semester med mera och visar en
            sammanställning med timmar och pengar.
          </p>
        </Step>
        <Connector />

        <Step num="3" title="Spara till löneberäkning">
          <p>
            Klicka på <strong className="text-[#e8edf8]">Spara till löneberäkning</strong> under
            resultatet. Specen sparas i din webbläsare (per månad och namn) så att kalendern kan
            hämta den senare. Sparade specar ser du under{' '}
            <Link href="/loneberakning/hantera" className="text-cyan-300 underline underline-offset-2">Hantera</Link>.
          </p>
        </Step>
        <Connector />

        <Step num="4" title="Ladda ner aktuell AO" page={{ label: 'Löneberäkning', href: '/loneberakning' }}>
          <p>
            På <strong className="text-[#e8edf8]">Löneberäkning</strong>-sidan finns knappar för att
            ladda ner senaste arbetsordningen (AO) som Excel-fil — välj den som gäller din säsong
            och befattning, t.ex. <em>Sommar 2026 — Däck</em> eller <em>— Café</em>.
          </p>
          <p className="text-[0.85rem] text-[#e8edf8]/50">
            Filen hamnar i din Hämtade filer-mapp. Du behöver bara göra det här när en ny AO-utgåva
            släpps.
          </p>
        </Step>
        <Connector />

        <Step num="5" title="Ladda upp AO:n">
          <p>
            Högst upp på samma sida: klicka{' '}
            <strong className="text-[#e8edf8]">Ladda upp AO (Excel)</strong> och välj filen du just
            laddade ner. Alla båtar i AO:n dyker upp i båtlistan. Du kan ha flera AO-utgåvor
            samtidigt (vinter + vår/höst + sommar) — kalendern väljer automatiskt den som gäller för
            månaden du tittar på.
          </p>
        </Step>
        <Connector />

        <Step num="6" title="Välj båt">
          <p>
            Välj din båt i <strong className="text-[#e8edf8]">Välj båt</strong>-listan ovanför
            kalendern. Dagarna fylls med AO:ns arbetstider (&quot;h avt.&quot;), och raden ovanför
            kalendern visar vilken AO som är aktiv — båt, befattning (Däck/Café) och
            giltighetsperiod.
          </p>
        </Step>
        <Connector />

        <Step num="7" title="Hitta din sparade spec — obs, en månad bakåt!">
          <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-[0.88rem] leading-relaxed text-amber-200">
            <strong>Viktigt:</strong> lönespecen släpar en månad — den visar{' '}
            <strong>förra månadens</strong> arbete. Junispecen innehåller majs arbetstider, majspecen
            aprils, osv. Bläddra därför till <strong>månaden före spec-månaden</strong> i kalendern.
          </div>
          <p>
            Kalendern öppnar alltid på dagens månad. Bläddra till rätt arbetsmånad med{' '}
            <em>Föregående månad</em> och klicka sedan{' '}
            <strong className="text-[#e8edf8]">Ladda lönespec</strong> — din sparade spec för den
            månaden hämtas.
          </p>
        </Step>
        <Connector />

        <Step num="8" title="Importera och jämför">
          <p>
            Klicka <strong className="text-[#e8edf8]">Importera från lönespec</strong>. Specens
            timmar skrivs in i kalendern och jämförs dag för dag mot AO:n:
          </p>
          <ul className="space-y-1.5 pl-1">
            <li className="flex items-start gap-2">
              <span className="mt-[0.3rem] h-2.5 w-2.5 shrink-0 rounded-full bg-green-400" />
              <span><strong className="text-green-300">Grön bock och grön prick</strong> — specen stämmer med AO-schemat.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-[0.3rem] h-2.5 w-2.5 shrink-0 rounded-full bg-red-400" />
              <span><strong className="text-red-300">Röd prick</strong> — avvikelse. Hovra över dagen för att se specens och AO:ns timmar.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-[0.3rem] h-2.5 w-2.5 shrink-0 rounded-full bg-purple-400" />
              <span><strong className="text-purple-300">Lila prick</strong> — pass som inte är markerat som arbetat.</span>
            </li>
          </ul>
          <p>
            Summeringen under kalendern räknar ihop tid, OB, övertid, tillägg och estimerad
            bruttolön. Vid på-/avmönstring med två pass samma dag markeras passet med rätt tid
            automatiskt.
          </p>
        </Step>

        {/* Hjälp */}
        <div className="mt-12 rounded-xl border border-sky-400/30 bg-sky-500/10 px-6 py-5">
          <p className="text-sm font-semibold text-sky-300">Kör du fast?</p>
          <p className="mt-1 text-sm leading-relaxed text-[#e8edf8]/70">
            Ring{' '}
            <a href="tel:0707501272" className="font-semibold text-sky-300 underline underline-offset-2 hover:text-sky-200">
              070-750 12 72
            </a>{' '}
            för guidning om något är oklart.
          </p>
        </div>
      </main>
    </div>
  );
}
