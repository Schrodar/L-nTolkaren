'use client';

import * as React from 'react';

type Status = { type: 'idle' } | { type: 'loading' } | { type: 'success'; names: string[] } | { type: 'error'; message: string };

export function AoUpload({ onUploaded }: { onUploaded: () => void }) {
  const [status, setStatus] = React.useState<Status>({ type: 'idle' });
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setStatus({ type: 'loading' });

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch('/api/ao/upload', { method: 'POST', body: form });
      const data = await res.json();

      if (!data.success) {
        setStatus({ type: 'error', message: data.error ?? 'Uppladdning misslyckades.' });
        return;
      }

      const names: string[] = (data.sheets ?? []).map(
        (s: { vesselName?: string; sheetName?: string }) =>
          (s.vesselName ?? s.sheetName ?? '').replace(/\s+Reg\..*$/i, '').trim(),
      );
      setStatus({ type: 'success', names });
      onUploaded();
    } catch {
      setStatus({ type: 'error', message: 'Nätverksfel vid uppladdning.' });
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="mb-4 flex items-center gap-3 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-3"
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status.type === 'loading'}
        className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-[#F5F7FF] hover:bg-white/15 disabled:opacity-50"
      >
        {status.type === 'loading' ? 'Laddar upp…' : 'Ladda upp AO (Excel)'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleChange}
        className="hidden"
      />
      {status.type === 'success' && (
        <span className="text-sm text-green-400">
          ✓ {status.names.join(', ')} sparad
        </span>
      )}
      {status.type === 'error' && (
        <span className="text-sm text-red-400">{status.message}</span>
      )}
      {status.type === 'idle' && (
        <span className="text-xs text-white/40">eller dra och släpp hit</span>
      )}
    </div>
  );
}
