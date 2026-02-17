/**
 * Art groups processing utilities
 */

import { descriptionFromRawRow } from './textNormalization';

export type ArtGroup = {
  art: string;
  rows: string[];
};

export type ArtCountRow = {
  art: string;
  description: string;
  count: number;
};

/**
 * Builds art count summary from art groups
 * Extracts descriptions and counts, sorted by count descending
 */
export function buildArtCountsFromArtGroups(artGroups: ArtGroup[]): ArtCountRow[] {
  return artGroups
    .map((g) => {
      const first = g.rows[0] ?? '';
      return {
        art: g.art,
        description: first ? descriptionFromRawRow(g.art, first) : 'Okänd',
        count: g.rows.length,
      };
    })
    .sort((a, b) => b.count - a.count);
}
