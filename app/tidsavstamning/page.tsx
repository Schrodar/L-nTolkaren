'use client';

import * as React from 'react';

import { AoUpload } from '@/components/AoUpload';
import { WorkCalendar } from '@/components/WorkCalendar';
import { SiteNav } from '@/components/SiteNav';

export default function LoneberakningPage() {
  return <LoneberakningPageInner />;
}

function LoneberakningPageInner() {
  const [uploadKey, setUploadKey] = React.useState(0);

  return (
    <div className="min-h-dvh bg-[#0B1B3A] px-4 py-10 text-[#F5F7FF] sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Tidsavstämning
          </h1>
          <SiteNav />
        </header>

        {/* AppProvider ligger i layout.tsx — en enda instans för hela sajten,
            så att Löneinställningar delas och persisteras konsekvent. */}
        <div className="space-y-6">
            <AoUpload onUploaded={() => setUploadKey((k) => k + 1)} />

            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold">Ladda ner senaste AO-scheman</h2>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/Ao_Vinter_2025-26_Däck_utg260203.xlsx"
                  download
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15 transition-colors"
                >
                  Senaste AO Vinter 2025–26
                </a>
                <a
                  href="/Ao_VårHöst_2026_Däck_260409.xlsx"
                  download
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15 transition-colors"
                >
                  Senaste AO Vår/Höst 2026
                </a>
                <a
                  href="/AO_Sommar_2026_DÄCK_260703.xlsx"
                  download
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15 transition-colors"
                >
                  Senaste AO Sommar 2026 — Däck
                </a>
                <a
                  href="/AO_Sommar_2026_CAFÉ_260706.xlsx"
                  download
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15 transition-colors"
                >
                  Senaste AO Sommar 2026 — Café
                </a>
              </div>
            </section>

            <WorkCalendar refreshKey={uploadKey} />
        </div>
      </div>
    </div>
  );
}
