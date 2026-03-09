'use client';

import Link from 'next/link';
import * as React from 'react';

import { AoUpload } from '@/components/AoUpload';
import { LoneberakningProvider } from '@/components/LoneberakningContext';
import { TariffEditor } from '@/components/TariffEditor';
import { WorkCalendar } from '@/components/WorkCalendar';

export default function LoneberakningPage() {
  return <LoneberakningPageInner />;
}

function LoneberakningPageInner() {
  const [uploadKey, setUploadKey] = React.useState(0);

  return (
    <div className="min-h-dvh bg-[#0B1B3A] px-4 py-10 text-[#F5F7FF] sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Löneberäkning
          </h1>
          <nav aria-label="Primary" className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-[#F5F7FF]/90 hover:bg-white/10"
            >
              Lönespec
            </Link>
            <Link
              href="/loneberakning"
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15"
            >
              Löneberäkning
            </Link>
          </nav>
        </header>

        <LoneberakningProvider>
          <div className="space-y-6">
            <AoUpload onUploaded={() => setUploadKey((k) => k + 1)} />
            <TariffEditor />
            <WorkCalendar refreshKey={uploadKey} />
          </div>
        </LoneberakningProvider>
      </div>
    </div>
  );
}
