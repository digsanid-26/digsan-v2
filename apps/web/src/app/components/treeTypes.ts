// Shared types for the family tree explorer.

export type Group =
  | 'self' | 'spouse' | 'parent' | 'grandparent' | 'ancestor'
  | 'kakak' | 'adik' | 'child' | 'uncle';

export interface TNode { id: string; name: string; role: string; x: number; y: number; group: Group; count?: number; }
export type Poly = { points: number[][]; marriage?: boolean };

export interface TreeConfig {
  configured: boolean;
  mainFamilyName: string;
  spouseCount: number;
  childCount: number;
  extFamilyName: string;
  parentCount: number;
  olderCount: number;
  youngerCount: number;
  simbahP: number;
  simbahM: number;
}

export interface NodeFamilyConfig {
  olderCount?: number;
  youngerCount?: number;
  siblingCount?: number; // legacy fallback (treated as older)
  spouseCount?: number;
  childCount?: number;
}

export interface Member { name: string; gender: 'L' | 'P' | ''; alive: boolean; photo: string | null; verified?: boolean; familyConfig?: NodeFamilyConfig; }
export type Members = Record<string, Member>;

export const DEFAULT_CONFIG: TreeConfig = {
  configured: false,
  mainFamilyName: '',
  spouseCount: 1,
  childCount: 2,
  extFamilyName: '',
  parentCount: 2,
  olderCount: 2,
  youngerCount: 2,
  simbahP: 2,
  simbahM: 2,
};
