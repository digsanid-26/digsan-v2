// Shared types for the family tree explorer.

export type Group =
  | 'self' | 'spouse' | 'parent' | 'grandparent' | 'ancestor'
  | 'kakak' | 'adik' | 'child' | 'uncle';

export interface TNode { id: string; name: string; role: string; x: number; y: number; group: Group; count?: number; tag?: string; }
export type Poly = { points: number[][]; marriage?: boolean; tag?: string };

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

export interface Member {
  name: string;
  gender: 'L' | 'P' | '';
  alive: boolean;
  photo: string | null;
  verified?: boolean;
  familyConfig?: NodeFamilyConfig;
  email?: string;
  phone?: string;
  linkedUserId?: string | null;
  /** True when a super_user issued temporary early-access credentials here. */
  earlyAccess?: boolean;
  /** Username of the linked account — powers /id/{username}. */
  username?: string | null;
  // ─── Explicit graph relations (for recursively-added circles) ───
  /** Blood parent node id (couple resolved via that parent's spouse). */
  parentId?: string | null;
  /** Marriage link node id. */
  spouseId?: string | null;
  /** Visual/relationship group. Present only on explicitly-added nodes. */
  group?: Group;
  /** Display role label for explicitly-added nodes. */
  role?: string;
  /** Public display name — overrides name on public family/profile pages. */
  publicName?: string | null;
  /** Custom status label — overrides the auto-generated role label (Suami, Istri, Anak 1pa, etc.) on public tree. */
  statusLabel?: string | null;
}
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
