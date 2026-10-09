import { NextResponse } from 'next/server';

interface MojangVersionManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: Array<{
    id: string;
    type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
    url: string;
    time: string;
    releaseTime: string;
  }>;
}

let cachedManifest: any = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

export async function GET() {
  const now = Date.now();

  if (cachedManifest && now - lastFetchTime < CACHE_TTL_MS) {
    return NextResponse.json(cachedManifest);
  }

  try {
    const res = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', {
      headers: { 'User-Agent': 'VistaAFK-VersionChecker/1.0' },
      next: { revalidate: 600 },
    });

    if (!res.ok) {
      throw new Error(`Mojang API responded with HTTP ${res.status}`);
    }

    const data: MojangVersionManifest = await res.json();

    const releases = data.versions
      .filter((v) => v.type === 'release')
      .slice(0, 40)
      .map((v) => ({
        id: v.id,
        type: v.type,
        releaseTime: v.releaseTime,
      }));

    const snapshots = data.versions
      .filter((v) => v.type === 'snapshot')
      .slice(0, 15)
      .map((v) => ({
        id: v.id,
        type: v.type,
        releaseTime: v.releaseTime,
      }));

    cachedManifest = {
      success: true,
      source: 'Mojang Official Meta API',
      latest: data.latest,
      releases,
      snapshots,
      bedrockSupported: '1.20.0+ (Auto-negotiated via RakNet protocol)',
      autoNegotiate: true,
      lastUpdated: now,
    };
    lastFetchTime = now;

    return NextResponse.json(cachedManifest);
  } catch (err: any) {
    // Resilient fallback with modern Minecraft versions if offline or rate-limited
    const fallbackData = {
      success: true,
      source: 'VistaAFK Protocol Matrix (Fallback)',
      latest: {
        release: '1.21.4',
        snapshot: '24w50a',
      },
      releases: [
        { id: '1.21.4', type: 'release', releaseTime: '2024-12-03' },
        { id: '1.21.3', type: 'release', releaseTime: '2024-10-23' },
        { id: '1.21.1', type: 'release', releaseTime: '2024-08-08' },
        { id: '1.21', type: 'release', releaseTime: '2024-06-13' },
        { id: '1.20.6', type: 'release', releaseTime: '2024-04-29' },
        { id: '1.20.4', type: 'release', releaseTime: '2023-12-07' },
        { id: '1.20.2', type: 'release', releaseTime: '2023-09-21' },
        { id: '1.20.1', type: 'release', releaseTime: '2023-06-12' },
        { id: '1.19.4', type: 'release', releaseTime: '2023-03-14' },
        { id: '1.18.2', type: 'release', releaseTime: '2022-02-28' },
        { id: '1.17.1', type: 'release', releaseTime: '2021-07-06' },
        { id: '1.16.5', type: 'release', releaseTime: '2021-01-15' },
        { id: '1.12.2', type: 'release', releaseTime: '2017-09-18' },
        { id: '1.8.9', type: 'release', releaseTime: '2015-12-09' },
      ],
      snapshots: [
        { id: '24w50a', type: 'snapshot', releaseTime: '2024-12-11' },
      ],
      bedrockSupported: '1.20.0+ (Auto-negotiated via RakNet protocol)',
      autoNegotiate: true,
      lastUpdated: now,
    };

    return NextResponse.json(fallbackData);
  }
}
