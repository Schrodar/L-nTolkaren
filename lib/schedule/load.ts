import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import type { BoatOption, BoatScheduleCompact } from '@/lib/schedule/types';

function getSeasonDir(season: string): string {
  return path.join(process.cwd(), 'data', 'schedules', season);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeStandard(raw: unknown): BoatScheduleCompact['standard'] {
  const out: BoatScheduleCompact['standard'] = {};
  if (!isObject(raw)) return out;

  for (const [key, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) continue;
    if (['1', '2', '3', '4', '5', '6', '7'].includes(key)) {
      out[key as keyof BoatScheduleCompact['standard']] = value;
    } else {
      out[key as keyof BoatScheduleCompact['standard']] = value;
    }
  }

  return out;
}

export async function getBoatSchedule(
  season: string,
  boatFileBaseName: string,
): Promise<BoatScheduleCompact | null> {
  const filePath = path.join(getSeasonDir(season), `${boatFileBaseName}.json`);

  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) return null;

    const boat =
      typeof parsed.boat === 'string' ? parsed.boat : boatFileBaseName;
    const normalizedSeason =
      typeof parsed.season === 'string' ? parsed.season : season;

    const periodRaw = isObject(parsed.period) ? parsed.period : null;
    const from = typeof periodRaw?.from === 'string' ? periodRaw.from : '';
    const to = typeof periodRaw?.to === 'string' ? periodRaw.to : '';
    if (!from || !to) return null;

    const overrides = isObject(parsed.overrides)
      ? (parsed.overrides as Record<
          string,
          BoatScheduleCompact['overrides'][string]
        >)
      : {};

    return {
      boat,
      season: normalizedSeason,
      period: { from, to },
      standard: normalizeStandard(parsed.standard),
      overrides,
      meta: isObject(parsed.meta) ? parsed.meta : undefined,
    };
  } catch {
    return null;
  }
}

export function getAvailableBoats(season: string): BoatOption[] {
  const seasonDir = getSeasonDir(season);
  try {
    const entries = fs.readdirSync(seasonDir, { withFileTypes: true });
    const files = entries
      .filter(
        (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'),
      )
      .map((entry) => entry.name.replace(/\.json$/i, ''))
      .sort((a, b) => a.localeCompare(b, 'sv-SE'));

    return files.map((fileBaseName) => {
      const filePath = path.join(seasonDir, `${fileBaseName}.json`);
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw) as unknown;
        const label =
          isObject(parsed) && typeof parsed.boat === 'string'
            ? parsed.boat
            : fileBaseName;
        return { value: fileBaseName, label };
      } catch {
        return { value: fileBaseName, label: fileBaseName };
      }
    });
  } catch {
    return [];
  }
}
