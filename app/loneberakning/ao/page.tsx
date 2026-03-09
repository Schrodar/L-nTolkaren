'use client';

import * as React from 'react';
import Link from 'next/link';

import type { AoBlock, ParsedAoSheet, StoredAoSheetMeta } from '@/lib/ao/types';

// ── Typer ──────────────────────────────────────────────────────────────────

interface UploadResult {
  success: boolean;
  fileName?: string;
  sheets?: SavedSheetSummary[];
  parsedSheets?: ParsedAoSheet[];
  saveErrors?: string[];
  error?: string;
}

interface SavedSheetSummary {
  slug: string;
  sheetName: string;
  vesselName: string | null;
  blockCount: number;
  modeCount: { is: number; isfri: number };
  exceptionCount: number;
  parseErrors: string[];
}

// ── Hjälpkomponenter ────────────────────────────────────────────────────────

function Badge({ children, variant = 'default' }: {
  children: React.ReactNode;
  variant?: 'default' | 'isfri' | 'is' | 'error';
}) {
  const styles = {
    default: 'bg-white/10 text-white/80',
    isfri: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
    is: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    error: 'bg-red-500/20 text-red-300 border border-red-500/30',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  if (mode === 'isfri') return <Badge variant="isfri">Isfri</Badge>;
  if (mode === 'is') return <Badge variant="is">Is</Badge>;
  return <Badge>{mode}</Badge>;
}

// ── Tidsberäkning ────────────────────────────────────────────────────────────────
function hhmmToMin(t: string | null): number | null {
  if (!t) return null;
  const m = t.match(/^(\d+):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

/** Beräknar AO-netto (lila): bruttotid − AO-rast(B) only. */
function calcNettoH(
  aoBruttotid: string | null,
  aoRastStart: string | null,
  aoRastEnd: string | null
): number | null {
  const brutto = hhmmToMin(aoBruttotid);
  if (brutto === null) return null;
  const rastB =
    aoRastStart && aoRastEnd
      ? (hhmmToMin(aoRastEnd) ?? 0) - (hhmmToMin(aoRastStart) ?? 0)
      : 0;
  return Math.max(0, brutto - rastB) / 60;
}

/** Beräknar Tid enl. koll.avt. (blå): bruttotid − ALLA raster. */
function calcTidEnlH(
  aoBruttotid: string | null,
  aoRastStart: string | null,
  aoRastEnd: string | null,
  annanRast1Start: string | null,
  annanRast1End: string | null,
  annanRast2Start: string | null,
  annanRast2End: string | null,
  annanRastMatStart: string | null,
  annanRastMatEnd: string | null
): number | null {
  const brutto = hhmmToMin(aoBruttotid);
  if (brutto === null) return null;
  const dur = (s: string | null, e: string | null) =>
    s && e ? Math.max(0, (hhmmToMin(e) ?? 0) - (hhmmToMin(s) ?? 0)) : 0;
  const allBreaks =
    dur(aoRastStart, aoRastEnd) +
    dur(annanRast1Start, annanRast1End) +
    dur(annanRast2Start, annanRast2End) +
    dur(annanRastMatStart, annanRastMatEnd);
  return Math.max(0, brutto - allBreaks) / 60;
}

function formatNetto(h: number | null): string {
  if (h === null) return '–';
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return `${hh}:${String(mm).padStart(2, '0')}`;
}

/** Formaterar decimaltimmar, t.ex. 8.1666 → "8,2" */
function formatDecimal(h: number | null): string {
  if (h === null) return '–';
  return h.toFixed(1).replace('.', ',');
}

function formatDate(iso: string | null): string {
  if (!iso) return '–';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// ── Block-preview ───────────────────────────────────────────────────────────

function BlockPreview({ block }: { block: AoBlock }) {
  const [expanded, setExpanded] = React.useState(false);

  const modes = Array.from(new Set(block.mode ? [block.mode] : []));

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-white/90">
          {formatDate(block.periodStart)} – {formatDate(block.periodEnd)}
        </span>
        {modes.map((m) => (
          <ModeBadge key={m} mode={m} />
        ))}
        <span className="ml-auto text-white/50 text-xs">
          {block.weeklySchedule.length} veckodagar · {block.exceptions.length} undantag
        </span>
      </div>

      {block.heading && (
        <p className="mt-1 text-xs text-white/40 line-clamp-1" title={block.heading}>
          {block.heading}
        </p>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-xs text-sky-400 hover:text-sky-300 underline underline-offset-2"
      >
        {expanded ? 'Dölj detaljer' : 'Visa detaljer'}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {block.weeklySchedule.length > 0 && (
            <div>
              <p className="text-xs font-medium text-white/60 mb-1">Ordinarie veckoschema</p>
              {/* Kolumnrubriker */}
              <div className="flex gap-2 text-xs text-white/30 mb-1 font-medium">
                <span className="w-10 shrink-0">Dag</span>
                <span className="w-28 shrink-0">Klockslag</span>
                <span className="w-14 shrink-0 text-right">Brutto</span>
                <span className="w-14 shrink-0 text-right">Netto</span>
                <span className="w-12 shrink-0 text-right">Tid enl.</span>
                <span className="shrink-0">Raster</span>
              </div>
              <div className="space-y-0.5">
                {block.weeklySchedule.map((row, i) => {
                  const tidEnl = calcTidEnlH(
                    row.aoBruttotid,
                    row.aoRastStart, row.aoRastEnd,
                    row.annanRast1Start, row.annanRast1End,
                    row.annanRast2Start, row.annanRast2End,
                    row.annanRastMatStart, row.annanRastMatEnd
                  );
                  const breaks = [
                    row.aoRastStart && row.aoRastEnd ? `B ${row.aoRastStart}–${row.aoRastEnd}` : null,
                    row.annanRast1Start && row.annanRast1End ? `R1 ${row.annanRast1Start}–${row.annanRast1End}` : null,
                    row.annanRast2Start && row.annanRast2End ? `R2 ${row.annanRast2Start}–${row.annanRast2End}` : null,
                    row.annanRastMatStart && row.annanRastMatEnd ? `Mat ${row.annanRastMatStart}–${row.annanRastMatEnd}` : null,
                  ].filter(Boolean);
                  return (
                    <div key={i} className="flex gap-2 text-xs text-white/70 font-mono">
                      <span className="w-10 shrink-0 text-white/50 font-sans">{row.dayLabel}</span>
                      <span className="w-28 shrink-0">{row.workStart ?? '–'}–{row.workEnd ?? '–'}</span>
                      <span className="w-14 shrink-0 text-right text-green-400">{row.aoBruttotid ?? '–'}</span>
                      <span className="w-14 shrink-0 text-right text-violet-400">{formatNetto(tidEnl)}</span>
                      <span className="w-12 shrink-0 text-right text-sky-400">{formatDecimal(tidEnl)}</span>
                      <span className="text-white/30 text-xs">{breaks.join(' · ')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {block.exceptions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-white/60 mb-1">
                Undantag ({block.exceptions.length} st)
              </p>
              <div className="space-y-1">
                {/* Kolumnrubriker undantag */}
                <div className="flex gap-2 text-xs text-white/30 mb-1 font-medium">
                  <span className="w-24 shrink-0">Datum</span>
                  <span className="w-28 shrink-0">Klockslag</span>
                  <span className="w-14 shrink-0 text-right">Brutto</span>
                  <span className="w-14 shrink-0 text-right">Netto</span>
                  <span className="w-12 shrink-0 text-right">Tid enl.</span>
                </div>
                {block.exceptions.map((ex, i) => {
                  const tidEnl = calcTidEnlH(
                    ex.aoBruttotid,
                    ex.aoRastStart, ex.aoRastEnd,
                    ex.annanRast1Start, ex.annanRast1End,
                    ex.annanRast2Start, ex.annanRast2End,
                    ex.annanRastMatStart, ex.annanRastMatEnd
                  );
                  return (
                    <div key={i} className="flex gap-2 text-xs text-white/70 font-mono">
                      <span className="w-24 shrink-0 text-white/50 font-sans">
                        {ex.resolvedDate ? formatDate(ex.resolvedDate) : ex.label}
                      </span>
                      <span className="w-28 shrink-0">
                        {ex.workStart ?? '–'}–{ex.workEnd ?? '–'}
                      </span>
                      <span className="w-14 shrink-0 text-right text-green-400">{ex.aoBruttotid ?? '–'}</span>
                      <span className="w-14 shrink-0 text-right text-violet-400">{formatNetto(tidEnl)}</span>
                      <span className="w-12 shrink-0 text-right text-sky-400">{formatDecimal(tidEnl)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sheet-preview ───────────────────────────────────────────────────────────

function SheetPreview({ sheet }: { sheet: ParsedAoSheet }) {
  const isCount = sheet.blocks.filter((b) => b.mode === 'is').length;
  const isfriCount = sheet.blocks.filter((b) => b.mode === 'isfri').length;
  const totalExceptions = sheet.blocks.reduce((s, b) => s + b.exceptions.length, 0);

  return (
    <div className="rounded-xl border border-white/15 bg-white/5 p-5">
      {/* Rubrik */}
      <div className="flex flex-wrap items-start gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {sheet.vesselPrefix && (
              <span className="text-white/50 font-normal mr-1">{sheet.vesselPrefix}</span>
            )}
            {sheet.vesselName ?? sheet.sheetName}
          </h3>
          <p className="text-sm text-white/50 mt-0.5">
            Blad: {sheet.sheetName}
            {sheet.registration && ` · ${sheet.registration}`}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap gap-1.5">
          {isCount > 0 && <ModeBadge mode="is" />}
          {isfriCount > 0 && <ModeBadge mode="isfri" />}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg bg-white/5 p-3">
          <p className="text-xs text-white/40 mb-0.5">Giltigt</p>
          <p className="text-sm text-white/90 font-medium">
            {formatDate(sheet.validFrom)} – {formatDate(sheet.validTo)}
          </p>
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <p className="text-xs text-white/40 mb-0.5">AO-block</p>
          <p className="text-sm text-white/90 font-medium">{sheet.blocks.length} st</p>
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <p className="text-xs text-white/40 mb-0.5">Undantag</p>
          <p className="text-sm text-white/90 font-medium">{totalExceptions} rader</p>
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <p className="text-xs text-white/40 mb-0.5">Islägen</p>
          <p className="text-sm text-white/90 font-medium">
            {[isfriCount > 0 && 'Isfri', isCount > 0 && 'Is']
              .filter(Boolean)
              .join(' + ') || '–'}
          </p>
        </div>
      </div>

      {sheet.roles && (
        <p className="text-xs text-white/40 mb-4">Befattning: {sheet.roles}</p>
      )}

      {/* Blocks */}
      {sheet.blocks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-white/60 uppercase tracking-wide">
            Perioder
          </p>
          {sheet.blocks.map((block, i) => (
            <BlockPreview key={i} block={block} />
          ))}
        </div>
      )}

      {/* Parserfel */}
      {sheet.parseErrors.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs font-medium text-amber-400 mb-1">Tolkningsvarningar</p>
          {sheet.parseErrors.map((e, i) => (
            <p key={i} className="text-xs text-amber-300/80">{e}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sparad sheet-rad ─────────────────────────────────────────────────────────

function StoredSheetRow({
  sheet,
  onDelete,
}: {
  sheet: StoredAoSheetMeta;
  onDelete: (slug: string) => void;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/ao/sheets/${sheet.slug}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onDelete(sheet.slug);
      }
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-white truncate">
          {sheet.vesselName ?? sheet.sheetName}
        </p>
        <p className="text-xs text-white/40 mt-0.5">
          {sheet.sheetName} ·{' '}
          {formatDate(sheet.validFrom)} – {formatDate(sheet.validTo)} ·{' '}
          {sheet.blockCount} block · {sheet.exceptionCount} undantag
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 shrink-0">
        {sheet.modes.map((m) => (
          <ModeBadge key={m} mode={m} />
        ))}
      </div>

      <div className="shrink-0">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs text-white/30 hover:text-red-400 transition-colors"
          >
            Ta bort
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            <span className="text-xs text-white/60">Bekräfta?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-medium text-red-400 hover:text-red-300"
            >
              {deleting ? 'Tar bort…' : 'Ja'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs text-white/40 hover:text-white/70"
            >
              Avbryt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Uppladdningszon ──────────────────────────────────────────────────────────

function UploadZone({
  file,
  isDragOver,
  onFileChange,
  onDrop,
  onDragOver,
  onDragLeave,
  onClick,
  inputRef,
}: {
  file: File | null;
  isDragOver: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onClick: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`w-full rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer
        ${isDragOver
          ? 'border-sky-400 bg-sky-400/10'
          : file
          ? 'border-emerald-500/50 bg-emerald-500/5'
          : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
        }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={onFileChange}
      />

      {file ? (
        <div className="space-y-1">
          <p className="text-2xl">📄</p>
          <p className="text-sm font-medium text-emerald-400">{file.name}</p>
          <p className="text-xs text-white/40">
            {(file.size / 1024).toFixed(0)} KB · Klicka för att byta fil
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-3xl">📂</p>
          <p className="text-sm font-medium text-white/80">
            Dra hit eller klicka för att välja fil
          </p>
          <p className="text-xs text-white/40">.xlsx eller .xls</p>
        </div>
      )}
    </button>
  );
}

// ── Huvudsida ────────────────────────────────────────────────────────────────

export default function AoImportPage() {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const [isDragOver, setIsDragOver] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [result, setResult] = React.useState<UploadResult | null>(null);

  const [storedSheets, setStoredSheets] = React.useState<StoredAoSheetMeta[]>([]);
  const [loadingStored, setLoadingStored] = React.useState(true);

  // Ladda sparade scheman vid mount
  React.useEffect(() => {
    fetch('/api/ao/sheets')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setStoredSheets(data.sheets ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingStored(false));
  }, []);

  function validateAndSet(f: File | null | undefined) {
    if (!f) return;
    const name = f.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      setError('Endast Excel-filer (.xlsx eller .xls) är tillåtna.');
      return;
    }
    if (f.size === 0) {
      setError('Filen är tom.');
      return;
    }
    setError(null);
    setFile(f);
    setResult(null);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    validateAndSet(e.target.files?.[0]);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    validateAndSet(e.dataTransfer.files?.[0]);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  async function handleUpload() {
    if (!file) {
      setError('Välj en AO-fil innan du importerar.');
      return;
    }

    setError(null);
    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/ao/upload', {
        method: 'POST',
        body: formData,
      });

      const data = (await response.json()) as UploadResult;
      setResult(data);

      if (data.success) {
        // Uppdatera listan med sparade scheman
        const sheetsRes = await fetch('/api/ao/sheets');
        const sheetsData = await sheetsRes.json();
        if (sheetsData.success) setStoredSheets(sheetsData.sheets ?? []);
      } else {
        setError(data.error ?? 'Något gick fel vid importen.');
      }
    } catch {
      setError('Nätverksfel: kunde inte nå servern. Kontrollera att appen körs.');
    } finally {
      setIsUploading(false);
    }
  }

  function handleDeleteStored(slug: string) {
    setStoredSheets((prev) => prev.filter((s) => s.slug !== slug));
  }

  return (
    <div className="min-h-dvh bg-[#0B1B3A] px-4 py-10 text-[#F5F7FF] sm:px-6 sm:py-14">
      <div className="mx-auto max-w-4xl">

        {/* Navigation */}
        <header className="mb-10 flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Importera AO-schema
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
            <Link
              href="/loneberakning/ao"
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15"
            >
              AO-import
            </Link>
          </nav>
        </header>

        {/* Introduktion */}
        <section className="mb-8 rounded-xl border border-white/10 bg-white/5 p-6">
          <p className="text-base text-white/80 leading-relaxed">
            Ladda upp din AO-fil i Excel-format. Systemet läser ut fartyg, perioder,
            isläge (is/isfri), ordinarie AO-tabell och datumsspecifika undantag,
            och sparar allt som strukturerad JSON-data för vidare användning i Lönetolkaren.
          </p>
          <p className="mt-3 text-sm text-white/50">
            Filen sparas lokalt på servern – ingen data skickas utanför systemet.
            Du kan sedan välja båt, isläge och datum för att hämta exakt AO för en specifik dag.
          </p>
        </section>

        {/* Uppladning */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">Ladda upp ny AO-fil</h2>

          <div className="space-y-4">
            <UploadZone
              file={file}
              isDragOver={isDragOver}
              onFileChange={onFileChange}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => inputRef.current?.click()}
              inputRef={inputRef}
            />

            {/* Felmeddelande */}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                <span className="font-medium">Fel:</span> {error}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className={`w-full rounded-xl px-6 py-3 text-base font-medium transition-all
                ${!file || isUploading
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'bg-sky-500 hover:bg-sky-400 text-white cursor-pointer shadow-lg shadow-sky-500/20'
                }`}
            >
              {isUploading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                  </svg>
                  Tolkar AO-filen…
                </span>
              ) : (
                'Importera AO-schema'
              )}
            </button>
          </div>
        </section>

        {/* Resultat / Preview */}
        {result && result.success && (
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
                <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-emerald-400">
                Import lyckades – {result.sheets?.length ?? 0} blad tolkades
              </h2>
            </div>

            <p className="mb-4 text-sm text-white/50">
              Datan är nu sparad och kan användas i Lönetolkaren för att slå upp AO per
              båt, isläge och datum.
            </p>

            {result.saveErrors && result.saveErrors.length > 0 && (
              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm font-medium text-amber-400 mb-1">Lagringsvarningar</p>
                {result.saveErrors.map((e, i) => (
                  <p key={i} className="text-sm text-amber-300/80">{e}</p>
                ))}
              </div>
            )}

            <div className="space-y-4">
              {(result.parsedSheets ?? []).map((sheet, i) => (
                <SheetPreview key={i} sheet={sheet} />
              ))}
            </div>
          </section>
        )}

        {/* Sparade scheman */}
        <section>
          <h2 className="text-lg font-semibold mb-4">
            Sparade AO-scheman
            {storedSheets.length > 0 && (
              <span className="ml-2 text-sm font-normal text-white/40">
                ({storedSheets.length} st)
              </span>
            )}
          </h2>

          {loadingStored ? (
            <p className="text-sm text-white/40">Laddar…</p>
          ) : storedSheets.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-8 text-center">
              <p className="text-sm text-white/40">
                Inga AO-scheman är sparade än. Ladda upp en AO-fil ovan för att komma igång.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {storedSheets.map((sheet) => (
                <StoredSheetRow
                  key={sheet.slug}
                  sheet={sheet}
                  onDelete={handleDeleteStored}
                />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
