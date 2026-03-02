import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { BoatSchedule } from '@/lib/schedules/types';

function getSeasonDir(season: string): string {
  return path.join(process.cwd(), 'data', 'schedules', season);
}

export async function getAvailableBoats(season: string): Promise<string[]> {
  const seasonDir = getSeasonDir(season);
  try {
    const entries = await fs.readdir(seasonDir, { withFileTypes: true });
    return entries
      .filter(
        (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'),
      )
      .map((entry) => entry.name.replace(/\.json$/i, ''))
      .sort((a, b) => a.localeCompare(b, 'sv-SE'));
  } catch {
    return [];
  }
}

export async function getBoatSchedule(
  season: string,
  boat: string,
): Promise<BoatSchedule | null> {
  const seasonDir = getSeasonDir(season);
  const schedulePath = path.join(seasonDir, `${boat}.json`);

  try {
    const raw = await fs.readFile(schedulePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<BoatSchedule>;

    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.boat !== 'string') return null;
    if (typeof parsed.season !== 'string') return null;
    if (!parsed.period || typeof parsed.period !== 'object') return null;
    if (
      typeof parsed.period.from !== 'string' ||
      typeof parsed.period.to !== 'string'
    ) {
      return null;
    }

    return {
      boat: parsed.boat,
      season: parsed.season,
      period: parsed.period,
      commonWorkPattern: parsed.commonWorkPattern,
      days: parsed.days ?? {},
    };
  } catch {
    return null;
  }
}
