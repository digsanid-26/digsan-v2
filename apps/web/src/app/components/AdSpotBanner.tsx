'use client';

import { useState, useEffect } from 'react';
import { getTokens } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface AdBannerData {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  aspectRatio: string;
}

interface SpotResponse {
  spot: { id: string; key: string; label: string; aspectRatio: string; maxSlots: number } | null;
  banners: AdBannerData[];
}

/**
 * Fetches and renders active ad banners for a given spot key.
 * Returns null if no banners are active (nothing rendered).
 */
export function AdSpotBanner({ spotKey, className = '' }: { spotKey: string; className?: string }) {
  const [banners, setBanners] = useState<AdBannerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tokens = getTokens();
        const res = await fetch(`${API_URL}/ads/spot/${spotKey}`, {
          headers: {
            ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
          },
        });
        if (!res.ok) return;
        const json = await res.json();
        const data: SpotResponse = json.data ?? json;
        if (!cancelled && data.banners?.length > 0) {
          setBanners(data.banners);
        }
      } catch {
        // Silent fail — ads are non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [spotKey]);

  if (loading || banners.length === 0) return null;

  return (
    <div className={className}>
      {banners.map((b) => (
        <a
          key={b.id}
          href={b.linkUrl || '#'}
          target={b.linkUrl ? '_blank' : undefined}
          rel="noopener noreferrer"
          className="block rounded-xl overflow-hidden hover:opacity-90 transition-opacity"
        >
          <img src={b.imageUrl} alt={b.title} className="w-full" referrerPolicy="no-referrer" />
        </a>
      ))}
    </div>
  );
}

/**
 * Fetches all active ad spots for a given page and renders them by key.
 * Returns a map of spotKey -> banners for flexible rendering.
 */
export function usePageAds(page: string) {
  const [ads, setAds] = useState<Record<string, AdBannerData[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tokens = getTokens();
        const res = await fetch(`${API_URL}/ads/page/${page}`, {
          headers: {
            ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
          },
        });
        if (!res.ok) return;
        const json = await res.json();
        const data: Array<{ key: string; banners: AdBannerData[] }> = json.data ?? json;
        if (!cancelled) {
          const map: Record<string, AdBannerData[]> = {};
          for (const s of data) {
            if (s.banners?.length > 0) map[s.key] = s.banners;
          }
          setAds(map);
        }
      } catch {
        // Silent fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page]);

  return { ads, loading };
}
