// Shared visual constants for the family tree (used by the explorer and public pages).

import type { Group } from './treeTypes';

export const STYLE: Record<Group, { bg: string; border: string; size: number }> = {
  self:        { bg: '#254474', border: 'rgba(96,165,250,0.85)', size: 96 },
  spouse:      { bg: '#7e22ce', border: 'rgba(216,180,254,0.7)', size: 76 },
  parent:      { bg: '#1d4ed8', border: 'rgba(96,165,250,0.7)', size: 74 },
  grandparent: { bg: '#4338ca', border: 'rgba(165,180,252,0.7)', size: 66 },
  ancestor:    { bg: '#6d28d9', border: 'rgba(196,181,253,0.7)', size: 58 },
  kakak:       { bg: '#c2410c', border: 'rgba(251,146,60,0.7)', size: 70 },
  adik:        { bg: '#047857', border: 'rgba(52,211,153,0.7)', size: 70 },
  child:       { bg: '#b45309', border: 'rgba(251,191,36,0.7)', size: 64 },
  uncle:       { bg: '#0e7490', border: 'rgba(103,232,249,0.7)', size: 66 },
};

// SVG internal offset (large to fit the ancestral chain).
export const OX = 1600;
export const OY = 1600;
