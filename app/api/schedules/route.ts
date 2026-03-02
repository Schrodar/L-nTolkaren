import { NextRequest, NextResponse } from 'next/server';

import { getAvailableBoats, getBoatSchedule } from '@/lib/schedule/load';

export async function GET(request: NextRequest) {
  const season = request.nextUrl.searchParams.get('season') ?? '';
  const boat = request.nextUrl.searchParams.get('boat') ?? '';

  if (!season.trim()) {
    return NextResponse.json({ error: 'season krävs' }, { status: 400 });
  }

  if (!boat.trim()) {
    const boats = getAvailableBoats(season);
    return NextResponse.json({ boats });
  }

  const schedule = await getBoatSchedule(season, boat);
  if (!schedule) {
    return NextResponse.json({ schedule: null }, { status: 404 });
  }

  return NextResponse.json({ schedule });
}
