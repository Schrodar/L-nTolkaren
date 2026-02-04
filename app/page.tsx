'use client';

import * as React from 'react';

import { parsePayslipArtGroups } from '@/lib/parsePayslipArtGroups';
import { PayslipArtGroupsPanel } from '@/components/PayslipArtGroupsPanel';
import type { PayslipArtGroups } from '@/components/PayslipArtGroupsPanel';

export default function Page() {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);

  const [error, setError] = React.useState<string | null>(null);

  const [isParsing, setIsParsing] = React.useState(false);
  const [artGroupsData, setArtGroupsData] = React.useState<PayslipArtGroups | null>(null);

  function pickFile() {
    setError(null);
    inputRef.current?.click();
  }

  function validateAndSet(next: File | null | undefined) {
    if (!next) return;

    const isPdf =
      next.type === 'application/pdf' || next.name.toLowerCase().endsWith('.pdf');

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

      const parsedArt = await parsePayslipArtGroups(arrayBuffer, { includePages: false });
      setArtGroupsData({ fileName: file.name, artGroups: parsedArt.artGroups });

      requestAnimationFrame(() => {
        document.getElementById('analysis-section')?.scrollIntoView({ behavior: 'smooth' });
      });
    } catch (e: unknown) {
      console.error(e);
      setError(
        'Kunde inte tolka PDF:en. Om den är scannad (bild) krävs OCR. Kontrollera också att pdf.js worker kan laddas (ingen “fake worker”).'
      );
    } finally {
      setIsParsing(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#0B1B3A] text-[#F5F7FF]">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0B1B3A]/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="h-8 w-24 rounded-full border border-white/15 bg-white/5"
              title="Logo placeholder"
            />
          </div>

          <nav aria-label="Primary" className="flex items-center gap-2">
            <a
              href="#info"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-[#F5F7FF]/90 hover:text-[#F5F7FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1B3A]"
            >
              Info
            </a>
            <a
              href="#analysis-section"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-[#F5F7FF]/90 hover:text-[#F5F7FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1B3A]"
            >
              Analys
            </a>
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
            Dra och släpp din lönespecifikation i rutan, eller välj en PDF från din dator. Text
            extraheras lokalt i webbläsaren, och “arter” grupperas lokalt via pdf.js.
          </p>

          <div id="info" className="pt-2">
            <p className="text-sm leading-relaxed text-[#F5F7FF]/65">
              Få en sammanfattning av din lön och upptäck eventuella avvikelser eller felaktigheter.
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
                isDragOver ? 'border-white/35 bg-white/8' : 'hover:border-white/25',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1B3A]',
              ].join(' ')}
            >
              <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/0 group-hover:border-white/10" />

              <div className="flex items-start justify-between gap-6">
                <div className="space-y-2">
                  <p className="text-sm font-semibold tracking-wide text-[#F5F7FF]">PDF-uppladdning</p>
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
                        Vald fil: <span className="font-semibold text-[#F5F7FF]">{fileName}</span>
                      </>
                    ) : (
                      'Ingen fil vald ännu.'
                    )}
                  </p>

                  {error ? <p className="mt-1 text-sm font-medium text-red-200">{error}</p> : null}

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
                      title={!file ? 'Välj en PDF för att fortsätta' : 'Tolka lönespecifikation'}
                    >
                      {isParsing ? 'Tolkar…' : 'Tolka lönespecifikation'}
                    </button>
                  </div>

                  <p className="text-xs text-[#F5F7FF]/60">Tolkningen startar först när du klickar på knappen.</p>
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
      <section id="analysis-section" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#F5F7FF]">ART-grupper</h2>
            <p className="mt-1 text-sm text-[#F5F7FF]/70">Resultatet visas här efter att du tolkat en PDF.</p>
          </div>

          {artGroupsData ? (
            <button
              type="button"
              onClick={() => {
                setArtGroupsData(null);
              }}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-[#F5F7FF]/90 hover:bg-white/10"
            >
              Rensa
            </button>
          ) : null}
        </div>

        {!artGroupsData ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-[#F5F7FF]/75">
            Ingen analys ännu. Välj en PDF och klicka på <span className="font-semibold">Tolka</span>.
          </div>
        ) : (
          <div className="rounded-2xl bg-transparent">
            <div className="rounded-2xl bg-white p-2 sm:p-3">
              <PayslipArtGroupsPanel {...artGroupsData} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
