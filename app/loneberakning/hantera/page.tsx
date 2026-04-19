'use client';

import Link from 'next/link';
import * as React from 'react';

import { AoUpload } from '@/components/AoUpload';
import { useAppContext } from '@/components/AppContext';
import type { SavedPayslip } from '@/components/AppContext';

type AoSheetMeta = {
  slug: string;
  sheetName: string;
  vesselName: string | null;
  validFrom?: string;
  validTo?: string;
};

export default function HanteraPage() {
  return (
    <div className="min-h-dvh bg-[#0B1B3A] px-4 py-10 text-[#F5F7FF] sm:px-6 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Hantera data
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
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-[#F5F7FF]/90 hover:bg-white/10"
            >
              Löneberäkning
            </Link>
          </nav>
        </header>

        <div className="space-y-8">
          <PayslipSection />
          <AoSection />
        </div>
      </div>
    </div>
  );
}

// ── Sektion 1: Lönespecar ─────────────────────────────────────────────────────

function PayslipSection() {
  const { listPayslips, deletePayslip } = useAppContext();
  const [payslips, setPayslips] = React.useState<SavedPayslip[]>([]);

  React.useEffect(() => {
    setPayslips(listPayslips());
  }, [listPayslips]);

  function handleDelete(monthISO: string | null, employeeName?: string | null) {
    if (!monthISO) return;
    deletePayslip(monthISO, employeeName);
    setPayslips(listPayslips());
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
      <h2 className="mb-4 text-xl font-semibold tracking-[-0.02em]">Sparade lönespecar</h2>

      {payslips.length === 0 ? (
        <p className="text-sm text-[#F5F7FF]/50">Inga sparade lönespecar.</p>
      ) : (
        <div className="divide-y divide-white/8 overflow-hidden rounded-xl border border-white/10">
          {payslips.map((p) => (
            <div key={`${p.monthISO ?? ''}:${p.employeeName ?? p.fileName}`} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {p.monthISO ?? 'Okänd månad'}
                  {p.employeeName ? ` — ${p.employeeName}` : ''}
                </div>
                <div className="truncate text-xs text-[#F5F7FF]/50">{p.fileName}</div>
                <div className="text-[10px] text-[#F5F7FF]/30">
                  Sparad: {new Date(p.savedAt).toLocaleString('sv-SE')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(p.monthISO, p.employeeName)}
                className="shrink-0 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20"
              >
                Ta bort
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Sektion 2: AO-scheman ─────────────────────────────────────────────────────

function AoSection() {
  const [sheets, setSheets] = React.useState<AoSheetMeta[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showUpload, setShowUpload] = React.useState(false);

  const fetchSheets = React.useCallback(() => {
    setLoading(true);
    fetch('/api/ao/sheets')
      .then((r) => r.json())
      .then((data: { success: boolean; sheets?: AoSheetMeta[] }) => {
        setSheets(data.success ? (data.sheets ?? []) : []);
      })
      .catch(() => setSheets([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  async function handleDelete(slug: string) {
    const res = await fetch(`/api/ao/sheets/${encodeURIComponent(slug)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      setSheets((prev) => prev.filter((s) => s.slug !== slug));
    }
  }

  function formatBoatLabel(s: AoSheetMeta) {
    const raw = s.vesselName ?? s.sheetName;
    return raw.replace(/\s+Reg\..*$/i, '').trim() || raw;
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-[-0.02em]">AO-scheman</h2>
        <button
          type="button"
          onClick={() => setShowUpload((v) => !v)}
          className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15"
        >
          {showUpload ? 'Stäng' : 'Ladda upp nytt AO'}
        </button>
      </div>

      {showUpload && (
        <div className="mb-4">
          <AoUpload onUploaded={() => { setShowUpload(false); fetchSheets(); }} />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#F5F7FF]/50">Laddar…</p>
      ) : sheets.length === 0 ? (
        <p className="text-sm text-[#F5F7FF]/50">Inga AO-scheman importerade.</p>
      ) : (
        <div className="divide-y divide-white/8 overflow-hidden rounded-xl border border-white/10">
          {sheets.map((s) => (
            <div key={s.slug} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{formatBoatLabel(s)}</div>
                {s.validFrom && s.validTo && (
                  <div className="text-xs text-[#F5F7FF]/50">
                    {s.validFrom} – {s.validTo}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(s.slug)}
                className="shrink-0 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20"
              >
                Ta bort
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
