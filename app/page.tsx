'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { parsePayslipArtGroups } from '@/lib/parsePayslipArtGroups';
import { summarizePayslipArtGroups } from '@/lib/summarizePayslipArtGroups';
import { PayslipArtGroupsPanel } from '@/components/PayslipArtGroupsPanel';
import { useAppContext } from '@/components/AppContext';
import type { PayslipArtGroups } from '@/components/PayslipArtGroupsPanel';

export default function Page() {
  const { savePayslip, listPayslipsForMonth } = useAppContext();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);

  const [error, setError] = React.useState<string | null>(null);

  const [isParsing, setIsParsing] = React.useState(false);
  const [artGroupsData, setArtGroupsData] =
    React.useState<PayslipArtGroups | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saved'>('idle');
  const [confirmOverwrite, setConfirmOverwrite] = React.useState<{
    payslip: Parameters<typeof savePayslip>[0];
    existingName: string;
    month: string;
  } | null>(null);

  function pickFile() {
    setError(null);
    inputRef.current?.click();
  }

  function validateAndSet(next: File | null | undefined) {
    if (!next) return;

    const isPdf =
      next.type === 'application/pdf' ||
      next.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      setFileName(null);
      setFile(null);
      setError('Endast PDF-filer är tillåtna.');
      return;
    }

    setError(null);
    setFileName(next.name);
    setFile(next);
    setArtGroupsData(null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const next = e.dataTransfer.files?.[0];
    validateAndSet(next);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  async function onInterpret() {
    if (!file) {
      setError('Välj en PDF innan du tolkar.');
      return;
    }

    setError(null);
    setIsParsing(true);
    setArtGroupsData(null);

    try {
      const arrayBuffer = await file.arrayBuffer();

      const parsedArt = await parsePayslipArtGroups(arrayBuffer, {
        includePages: true,
      });
      setArtGroupsData({ fileName: file.name, artGroups: parsedArt.artGroups });
      setSaveStatus('idle');

      requestAnimationFrame(() => {
        document
          .getElementById('analysis-section')
          ?.scrollIntoView({ behavior: 'smooth' });
      });
    } catch (e: unknown) {
      console.error(e);
      setError(
        'Kunde inte tolka PDF:en. Om den är scannad (bild) krävs OCR. Kontrollera också att pdf.js worker kan laddas (ingen “fake worker”).',
      );
    } finally {
      setIsParsing(false);
    }
  }

  function handleSavePayslip() {
    if (!artGroupsData) return;
    const overview = summarizePayslipArtGroups(artGroupsData.artGroups);
    const monthISO =
      overview.art315?.monthISO ??
      overview.art301?.monthISO ??
      overview.art311?.monthISO ??
      null;
    if (!monthISO) return;

    const employeeName = artGroupsData.artGroups.find((g) => g.art === '0')?.rows[0] ?? null;
    const payslipToSave = {
      fileName: artGroupsData.fileName ?? 'okänd.pdf',
      monthISO,
      employeeName,
      overview,
      savedAt: new Date().toISOString(),
    };

    // Check for existing payslip with same month + name
    const existing = listPayslipsForMonth(monthISO);
    const duplicate = existing.find((p) => p.employeeName === employeeName);
    if (duplicate) {
      const [y, m] = monthISO.split('-');
      const monthName = new Date(Number(y), Number(m) - 1).toLocaleString('sv-SE', { month: 'long' });
      setConfirmOverwrite({
        payslip: payslipToSave,
        existingName: employeeName ?? 'Okänd',
        month: `${monthName} ${y}`,
      });
      return;
    }

    savePayslip(payslipToSave);
    setSaveStatus('saved');
  }

  function doOverwrite() {
    if (!confirmOverwrite) return;
    savePayslip(confirmOverwrite.payslip);
    setConfirmOverwrite(null);
    setSaveStatus('saved');
  }

  return (
    <div className="min-h-dvh bg-[#0B1B3A] text-[#F5F7FF]">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-[#0B1B3A]/80 backdrop-blur">
        <div className="mx-auto flex h-24 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Image
              src="/ankare.png"
              alt="Ankare"
              width={96}
              height={96}
              priority
            />
          </div>

          <nav aria-label="Primary" className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15"
            >
              Analysera lönespec
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
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-[#F5F7FF]/90 hover:bg-white/10"
            >
              Hjälp
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2 lg:items-center lg:py-20">
        {/* Left: Copy */}
        <section className="space-y-6">
          <h1 className="max-w-xl text-balance text-4xl font-semibold leading-tight tracking-[-0.02em] sm:text-5xl">
            Ladda upp en PDF för snabb tolkning
          </h1>

          <p className="max-w-xl text-pretty text-base leading-relaxed text-[#F5F7FF]/80 sm:text-lg">
            Dra och släpp din lönespecifikation i rutan, eller välj en PDF från
            din dator. Text extraheras lokalt i webbläsaren, och “arter”
            grupperas lokalt via pdf.js.
          </p>

          <div id="info" className="pt-2">
            <p className="text-sm leading-relaxed text-[#F5F7FF]/65">
              Få en sammanfattning av din lön och upptäck eventuella avvikelser
              eller felaktigheter.
            </p>
          </div>

          {/* Hjälpruta */}
          <div className="max-w-xl rounded-2xl border border-sky-400/30 bg-sky-500/10 px-5 py-4">
            <p className="text-sm font-semibold text-sky-300">Behöver du hjälp?</p>
            <p className="mt-1 text-sm leading-relaxed text-[#F5F7FF]/80">
              Ring{' '}
              <a href="tel:0707501272" className="font-semibold text-sky-300 underline underline-offset-2 hover:text-sky-200">
                070-750 12 72
              </a>{' '}
              för guidning om något är oklart.
            </p>
          </div>
        </section>

        {/* Right: Dropzone */}
        <section aria-label="PDF upload" className="lg:justify-self-end">
          <div className="w-full max-w-xl">
            <div
              role="button"
              tabIndex={0}
              onClick={pickFile}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') pickFile();
              }}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              aria-describedby="upload-help upload-status"
              className={[
                'group relative rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8',
                'shadow-[0_10px_30px_rgba(0,0,0,0.25)]',
                'transition-colors',
                isDragOver
                  ? 'border-white/35 bg-white/8'
                  : 'hover:border-white/25',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1B3A]',
              ].join(' ')}
            >
              <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/0 group-hover:border-white/10" />

              <div className="flex items-start justify-between gap-6">
                <div className="space-y-2">
                  <p className="text-sm font-semibold tracking-wide text-[#F5F7FF]">
                    PDF-uppladdning
                  </p>
                  <p id="upload-help" className="text-sm text-[#F5F7FF]/75">
                    Dra &amp; släpp en PDF här, eller klicka för att välja.
                  </p>
                </div>

                <div className="shrink-0">
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-[#F5F7FF]/90">
                    .pdf
                  </span>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-dashed border-white/20 bg-black/10 p-5 sm:p-6">
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-[#F5F7FF]/85">
                    {fileName ? (
                      <>
                        Vald fil:{' '}
                        <span className="font-semibold text-[#F5F7FF]">
                          {fileName}
                        </span>
                      </>
                    ) : (
                      'Ingen fil vald ännu.'
                    )}
                  </p>

                  {error ? (
                    <p className="mt-1 text-sm font-medium text-red-200">
                      {error}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        pickFile();
                      }}
                      className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1B3A]"
                    >
                      Välj PDF
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInterpret();
                      }}
                      disabled={!file || isParsing}
                      className={[
                        'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold',
                        'shadow-[0_10px_20px_rgba(0,0,0,0.25)]',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1B3A]',
                        file && !isParsing
                          ? 'bg-white text-[#0B1B3A] hover:bg-[#F5F7FF]'
                          : 'cursor-not-allowed bg-white/20 text-[#F5F7FF]/60',
                      ].join(' ')}
                      aria-disabled={!file || isParsing}
                      title={
                        !file
                          ? 'Välj en PDF för att fortsätta'
                          : 'Tolka lönespecifikation'
                      }
                    >
                      {isParsing ? 'Tolkar…' : 'Tolka lönespecifikation'}
                    </button>
                  </div>

                  <p className="text-xs text-[#F5F7FF]/60">
                    Tolkningen startar först när du klickar på knappen.
                  </p>
                </div>
              </div>

              {/* Hidden input */}
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => validateAndSet(e.target.files?.[0])}
              />
            </div>
          </div>
        </section>
      </main>

      {/* Analysis section */}
      <section
        id="analysis-section"
        className="mx-auto max-w-6xl px-4 pb-20 sm:px-6"
      >
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="mt-1 text-sm text-[#F5F7FF]/70">
              Resultatet visas här efter att du klickat på Tolka
              lönespecifikation.
            </p>
          </div>

          {artGroupsData ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSavePayslip}
                disabled={saveStatus === 'saved'}
                className={[
                  'rounded-xl border px-3 py-2 text-sm font-medium',
                  saveStatus === 'saved'
                    ? 'border-green-400/30 bg-green-500/10 text-green-300'
                    : 'border-sky-400/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20',
                ].join(' ')}
              >
                {saveStatus === 'saved' ? 'Sparad' : 'Spara till löneberäkning'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setArtGroupsData(null);
                  setSaveStatus('idle');
                }}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-[#F5F7FF]/90 hover:bg-white/10"
              >
                Rensa
              </button>
            </div>
          ) : null}
        </div>

        {!artGroupsData ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-[#F5F7FF]/75">
            Ingen analys ännu. Välj en PDF och klicka på{' '}
            <span className="font-semibold">Tolka</span>.
          </div>
        ) : (
          <div className="rounded-2xl bg-transparent">
            <div className="rounded-2xl bg-white p-2 sm:p-3">
              <PayslipArtGroupsPanel {...artGroupsData} />
            </div>
          </div>
        )}
      </section>

      {/* Confirm overwrite modal */}
      {confirmOverwrite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-white/15 bg-[#0B1B3A] p-6">
            <h2 className="mb-3 text-lg font-semibold">Skriva över lönespec?</h2>
            <p className="mb-6 text-sm text-[#F5F7FF]/70">
              Det finns redan en sparad lönespec för{' '}
              <span className="font-medium text-[#F5F7FF]">{confirmOverwrite.existingName}</span>{' '}
              i{' '}
              <span className="font-medium text-[#F5F7FF]">{confirmOverwrite.month}</span>.
              Vill du skriva över den?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOverwrite(null)}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-[#F5F7FF]/90 hover:bg-white/10"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={doOverwrite}
                className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-300 hover:bg-sky-500/20"
              >
                Skriv över
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}