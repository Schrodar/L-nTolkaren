// app/test/page.tsx
import React from 'react';

// Ändra import-path om du inte har @/ alias
import namdo from '../../data/schedules/ao_vinter_2025_26/Namdo.json';

type TimeRange = { start: string | null; end: string | null };

type RowLike = {
  label?: string;
  klockslag?: TimeRange;
  aoBruttotidA?: string | null;
  aoRastB?: TimeRange;
  annanRast1?: TimeRange;
  annanRast2?: TimeRange;
  // Tillåt extra fält utan att TS gnäller om din JSON har mer
  [key: string]: any;
};

function isRowLikeArray(x: any): x is RowLike[] {
  return Array.isArray(x) && (x.length === 0 || typeof x[0] === 'object');
}

function fmtRange(r?: TimeRange) {
  if (!r) return '—';
  const a = r.start ?? '—';
  const b = r.end ?? '—';
  if (a === '—' && b === '—') return '—';
  return `${a}–${b}`;
}

function renderRowsTable(title: string, rows: any) {
  if (!rows) return null;

  // Om någon råkat dumpa "... (finns i filen)" som string osv:
  if (typeof rows === 'string') {
    return (
      <div className="mt-3 rounded-xl border p-3">
        <div className="text-sm font-semibold">{title}</div>
        <pre className="mt-2 whitespace-pre-wrap text-xs text-neutral-700">
          {rows}
        </pre>
      </div>
    );
  }

  if (!isRowLikeArray(rows)) {
    return (
      <div className="mt-3 rounded-xl border p-3">
        <div className="text-sm font-semibold">{title}</div>
        <pre className="mt-2 whitespace-pre-wrap text-xs text-neutral-700">
          {JSON.stringify(rows, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-700">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th>Label</th>
              <th>Klockslag</th>
              <th>Ao bruttotid (A)</th>
              <th>Ao rast (B)</th>
              <th>Annan rast 1</th>
              <th>Annan rast 2</th>
              <th>Extra</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, idx) => {
              const extraKeys = Object.keys(r).filter(
                (k) =>
                  ![
                    'label',
                    'klockslag',
                    'aoBruttotidA',
                    'aoRastB',
                    'annanRast1',
                    'annanRast2',
                  ].includes(k),
              );

              return (
                <tr key={idx} className="[&>td]:px-3 [&>td]:py-2 align-top">
                  <td className="font-medium">{r.label ?? '—'}</td>
                  <td>{fmtRange(r.klockslag)}</td>
                  <td>{r.aoBruttotidA ?? '—'}</td>
                  <td>{fmtRange(r.aoRastB)}</td>
                  <td>{fmtRange(r.annanRast1)}</td>
                  <td>{fmtRange(r.annanRast2)}</td>
                  <td className="text-xs text-neutral-600">
                    {extraKeys.length ? (
                      <details>
                        <summary className="cursor-pointer select-none">
                          visa
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap">
                          {JSON.stringify(
                            extraKeys.reduce((acc: any, k) => {
                              acc[k] = r[k];
                              return acc;
                            }, {}),
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TestPage() {
  const data: any = namdo;

  const meta = data?.meta ?? {};
  const blocks: any[] = Array.isArray(data?.blocks) ? data.blocks : [];

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">AO Preview: Nämdö</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Render av tabellstruktur från <code>Namdo.json</code>
          </p>
        </div>

        <div className="text-right text-sm text-neutral-700">
          <div>
            <span className="font-medium">Giltighet: </span>
            {meta?.validity ?? '—'}
          </div>
          <div>
            <span className="font-medium">Version: </span>
            {meta?.versionLabel ?? '—'} {meta?.versionDate ?? ''}
          </div>
        </div>
      </div>

      {/* META */}
      <section className="mt-6 rounded-2xl border p-4">
        <h2 className="text-lg font-semibold">Meta</h2>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-neutral-500">Titel</div>
            <div>{meta?.documentTitle ?? '—'}</div>
          </div>
          <div>
            <div className="text-neutral-500">Avdelning</div>
            <div>{meta?.department ?? '—'}</div>
          </div>
          <div>
            <div className="text-neutral-500">Fartyg</div>
            <div>
              {meta?.ship?.prefix ? `${meta.ship.prefix} ` : ''}
              {meta?.ship?.name ?? '—'}
            </div>
          </div>
          <div>
            <div className="text-neutral-500">Befattning</div>
            <div>{meta?.role ?? '—'}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-neutral-500">Per.1</div>
            <div>{meta?.period1Note ?? '—'}</div>
          </div>
        </div>
      </section>

      {/* BLOCKS */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold">Blocks ({blocks.length || 0})</h2>

        <div className="mt-3 space-y-6">
          {blocks.map((b, i) => (
            <article key={i} className="rounded-2xl border p-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <div className="text-sm text-neutral-500">Block {i + 1}</div>
                  <h3 className="text-base font-semibold mt-1">
                    {b?.heading ?? '—'}
                  </h3>
                  <div className="text-sm text-neutral-700 mt-1">
                    <span className="font-medium">Period: </span>
                    {b?.period?.from ?? '—'} → {b?.period?.to ?? '—'}
                    {b?.variant ? (
                      <>
                        {' '}
                        <span className="text-neutral-400">•</span>{' '}
                        <span className="font-medium">Variant: </span>
                        {b.variant}
                      </>
                    ) : null}
                  </div>

                  {Array.isArray(b?.variantNotes) && b.variantNotes.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {b.variantNotes.map((n: string, idx: number) => (
                        <span
                          key={idx}
                          className="text-xs rounded-full border px-2 py-1 text-neutral-700"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                {Array.isArray(b?.notes) && b.notes.length ? (
                  <div className="md:max-w-md rounded-xl bg-neutral-50 border p-3">
                    <div className="text-sm font-semibold">Notes</div>
                    <ul className="mt-2 list-disc pl-5 text-sm text-neutral-700 space-y-1">
                      {b.notes.map((n: string, idx: number) => (
                        <li key={idx}>{n}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {renderRowsTable('Weekdays', b?.weekdays)}
              {renderRowsTable('Date overrides', b?.dateOverrides)}
            </article>
          ))}
        </div>
      </section>

      {/* RAW DEBUG */}
      <section className="mt-10 rounded-2xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Raw JSON (debug)</h2>
          <span className="text-xs text-neutral-500">
            (fäll ut om du vill se hela objektet)
          </span>
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer select-none text-sm text-neutral-700">
            Visa rådata
          </summary>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-neutral-50 p-3 text-xs">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      </section>
    </main>
  );
}
