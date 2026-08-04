'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Users, ArrowRight, Loader2, X, KeyRound, BadgeCheck, LogIn, PanelLeft } from 'lucide-react';
import { publicTreeApi, treeApi, savePendingClaim } from '@/lib/tree';
import type { PublicFamily } from '@/lib/tree';
import { auth, getTokens, getUser, saveTokens, saveUser } from '@/lib/auth';
import type { TreeConfig, Members, TNode, Poly, Group } from '@/app/components/treeTypes';
import { DEFAULT_CONFIG } from '@/app/components/treeTypes';
import { STYLE } from '@/app/components/treeStyle';
import PublicTreeCanvas from '@/app/components/PublicTreeCanvas';
import FamilyNodeTreeCanvas, { type FamilyNodeItem, type FamilyNodeLink, type FamilyNodeMember } from '@/app/components/FamilyNodeTreeCanvas';
import AppHeader from '@/app/components/AppHeader';
import { AdSpotBanner } from '@/app/components/AdSpotBanner';
import { ThemeProvider } from '@/app/components/ThemeProvider';
import { AuthProvider } from '@/components/providers/auth-provider';

// ─── Branch geometry ────────────────────────────────────────
// Every ancestry branch is drawn at a fixed horizontal offset from the column of
// the person it belongs to. These are shared by the layout AND by the spacing
// math that decides how far apart a couple must sit, so the two can never drift
// out of sync — that drift is what used to make the husband's uncles land on top
// of the wife's parents.
const UNCLE_OFFSET = 180;    // Paman/Bibi bubble, sideways from the Ortu column
const SIB_OFFSET = 180;      // Saudara bubble, sideways from the person's column
const PARENT_SPACING = 130;  // Ayah↔Ibu gap once the Ortu bubble is expanded
const COUPLE_CLEARANCE = 32; // minimum empty space between two branch envelopes
const MIN_COUPLE_GAP = 160;  // never squeeze a bare couple tighter than this

const radiusOf = (g: Group) => (STYLE[g]?.size ?? 60) / 2;

// Local layout helpers for main family + both sets of parents + Keluarga Besar
const spreadX = (count: number, gap: number, cx: number): number[] => {
  if (count <= 0) return [];
  const total = (count - 1) * gap;
  return Array.from({ length: count }, (_, i) => cx - total / 2 + i * gap);
};
function connectDown(lines: Poly[], midX: number, parentY: number, childXs: number[], childY: number) {
  if (childXs.length === 0) return;
  const trunkY = (parentY + childY) / 2;
  lines.push({ points: [[midX, parentY], [midX, trunkY]] });
  const xs = [...childXs, midX];
  lines.push({ points: [[Math.min(...xs), trunkY], [Math.max(...xs), trunkY]] });
  for (const cx of childXs) lines.push({ points: [[cx, trunkY], [cx, childY]] });
}

export default function PublicFamilyPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug as string;

  const [data, setData] = useState<PublicFamily<Partial<TreeConfig>, Members> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TNode | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [viewMode, setViewMode] = useState<'member' | 'familynode'>('member');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Super user early access form
  const [isSuperUser, setIsSuperUser] = useState(false);
  const [eaOpen, setEaOpen] = useState(false);
  const [eaEmail, setEaEmail] = useState('');
  const [eaPassword, setEaPassword] = useState('');
  const [eaPhone, setEaPhone] = useState('');
  const [eaLoading, setEaLoading] = useState(false);
  const [eaError, setEaError] = useState('');
  const [eaSuccess, setEaSuccess] = useState('');
  const [eaLoginLoading, setEaLoginLoading] = useState(false);
  const [eaLoginError, setEaLoginError] = useState('');

  // Deep link from an invitation: /family/{slug}?m={nodeId} focuses that member.
  // Also read public link token from ?t= query param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get('m');
    if (m) setHighlightId(m);
    const t = params.get('t');
    if (t) setLinkToken(t);
    const u = getUser();
    setIsLoggedIn(!!u);
    setIsSuperUser(u?.roles?.includes('super_user') ?? false);
  }, []);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    const tokens = getTokens();
    publicTreeApi
      .getFamily<Partial<TreeConfig>, Members>(slug, linkToken ?? undefined, tokens?.accessToken)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e: Error) => { if (!cancelled) setError(e.message || 'Gagal memuat keluarga'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, linkToken]);

  const config: TreeConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...(data?.config ?? {}) }),
    [data?.config],
  );
  const members: Members = useMemo(() => data?.members ?? {}, [data?.members]);

  // ─── Hover + expansion state ───
  // hoverTarget: which node is currently hovered
  // hoverLevel: 'none' | 'spouse-level' (parents faint) | 'parent-level' (parents solid + siblings faint)
  // expansionStack: LIFO stack of expanded branches — only the last one can be closed
  type Expansion = { id: string; tag: string; kind: 'parent' | 'sibling' | 'uncle' | 'grandparent' };
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);
  const [hoverLevel, setHoverLevel] = useState<'none' | 'spouse-level' | 'parent-level'>('none');
  const [expansionStack, setExpansionStack] = useState<Expansion[]>([]);

  // Derived expansion state
  const expandedParent = expansionStack.find(e => e.kind === 'parent')?.id ?? null;
  const expandedGroup = expansionStack.find(e => e.kind === 'sibling')?.id ?? null;
  const expandedUncle = expansionStack.find(e => e.kind === 'uncle')?.id ?? null;
  const expandedGrandparent = expansionStack.find(e => e.kind === 'grandparent')?.id ?? null;

  // Determine which "side" a node belongs to: 'self' or 'spouse-N'
  // Only same-side expansions are allowed simultaneously.
  const getSide = (id: string): string => {
    if (id === 'self' || id.startsWith('self-') || id.startsWith('grp-self-') || id.startsWith('sib-self-') || id.startsWith('unc-self-')) return 'self';
    const m = id.match(/^spouse-(\d+)/) || id.match(/^grp-spouse-(\d+)/) || id.match(/^sib-spouse-(\d+)/) || id.match(/^unc-spouse-(\d+)/);
    return m ? `spouse-${m[1]}` : 'self';
  };
  const activeSide = expansionStack.length > 0 ? getSide(expansionStack[0].id) : null;

  // Determine which parent tag a node id belongs to
  const getParentTag = (id: string): string | null => {
    if (id === 'self-ortu' || id.startsWith('self-ortu-parent-')) return 'self-parents';
    const m = id.match(/^spouse-(\d+)-ortu(-parent-\d+)?$/);
    if (m) return `spouse-${m[1]}-parents`;
    return null;
  };

  // Determine which grandparent tag a node id belongs to
  const getGrandparentTag = (id: string): string | null => {
    if (id === 'self-simbah') return 'self-grandparents';
    const m = id.match(/^spouse-(\d+)-simbah$/);
    if (m) return `spouse-${m[1]}-grandparents`;
    return null;
  };

  // Determine which uncle tag a node id belongs to
  const getUncleTag = (id: string): string | null => {
    if (id.startsWith('grp-self-paman')) return 'self-uncles';
    const m = id.match(/^grp-spouse-(\d+)-paman/);
    if (m) return `spouse-${m[1]}-uncles`;
    return null;
  };

  // Determine which sibling tag a group node id belongs to
  const getSiblingTag = (id: string): string | null => {
    if (id.startsWith('grp-self-saudara')) return 'self-siblings';
    const m = id.match(/^grp-spouse-(\d+)-saudara/);
    if (m) return `spouse-${m[1]}-siblings`;
    return null;
  };

  // Determine which sibling tag an individual expanded sibling node id belongs to
  const getSiblingTagFromIndividual = (id: string): string | null => {
    if (id.startsWith('sib-self-saudara')) return 'self-siblings';
    const m = id.match(/^sib-spouse-(\d+)-saudara/);
    if (m) return `spouse-${m[1]}-siblings`;
    return null;
  };

  // Which parent tag does a spouse/self hover reveal?
  const getParentsTagForNode = (id: string): string | null => {
    if (id === 'self') return 'self-parents';
    if (id.startsWith('spouse-') && !id.includes('-ortu') && !id.includes('-kakak') && !id.includes('-adik') && !id.includes('-paman') && !id.includes('-simbah')) {
      const m = id.match(/^spouse-(\d+)$/);
      if (m) return `spouse-${m[1]}-parents`;
    }
    return null;
  };

  const onNodeHover = useCallback((node: TNode | null) => {
    if (!node) {
      // Don't clear hover if there are active expansions — expanded branches persist
      if (expansionStack.length === 0) {
        setHoverTarget(null);
        setHoverLevel('none');
      }
      return;
    }
    // If there are active expansions on one side, don't change hover when
    // hovering a node on the other side — prevents hiding active branches
    if (activeSide && getSide(node.id) !== activeSide) {
      return;
    }
    setHoverTarget(node.id);

    // Determine hover level based on what node is hovered
    const parentsTag = getParentsTagForNode(node.id);
    if (parentsTag) {
      // Hovering self or spouse → show their parents faint
      setHoverLevel('spouse-level');
      return;
    }
    const parentTag = getParentTag(node.id);
    if (parentTag) {
      // Hovering an Ortu node → parents solid, show siblings + grandparents + uncles faint
      setHoverLevel('parent-level');
      return;
    }
    // Hovering grandparent or uncle → keep parent-level (stay visible)
    if (getGrandparentTag(node.id) || getUncleTag(node.id)) {
      setHoverLevel('parent-level');
      return;
    }
    // Hovering a sibling group bubble or individual sibling → keep parent-level
    const sibTag = getSiblingTag(node.id) || getSiblingTagFromIndividual(node.id);
    if (sibTag) {
      setHoverLevel('parent-level');
      return;
    }
    // Hovering any other node (child, etc.) → reset
    setHoverLevel('none');
  }, [expansionStack.length, activeSide]);

  // ─── Family Node Tree data (L103) ───────────────────────────
  const familyNodeTree = useMemo(() => {
    if (!data?.config) return { nodes: [] as FamilyNodeItem[], links: [] as FamilyNodeLink[] };
    const cfg = config;
    const ms = members;
    const fnNodes: FamilyNodeItem[] = [];
    const fnLinks: FamilyNodeLink[] = [];

    // Self family node (center)
    const selfMembers: FamilyNodeMember[] = [];
    const selfM = ms['self'];
    selfMembers.push({ name: selfM?.publicName || selfM?.name || data.owner?.name || 'Kepala Keluarga', photo: selfM?.photo || data.owner?.avatar || null, role: 'head' });
    for (let i = 0; i < cfg.spouseCount; i++) {
      const sp = ms[`spouse-${i}`];
      selfMembers.push({ name: sp?.publicName || sp?.name || 'Pasangan', photo: sp?.photo || null, role: 'spouse' });
    }
    for (let i = 0; i < cfg.childCount; i++) {
      const c = ms[`child-${i}`];
      selfMembers.push({ name: c?.publicName || c?.name || `Anak ${i + 1}`, photo: c?.photo || null, role: 'child' });
    }
    fnNodes.push({
      id: 'fn-self',
      name: data.name || 'Keluarga Kami',
      familyImage: data.familyImage,
      slug: slug,
      kind: 'self',
      memberCount: selfMembers.length,
      fnMembers: selfMembers,
      x: 0, y: 0,
    });

    // Parent family node (above)
    if (cfg.parentCount > 0) {
      const p0 = ms['parent-0'];
      const p1 = ms['parent-1'];
      const parentName = [p0?.publicName || p0?.name, p1?.publicName || p1?.name].filter(Boolean).join(' & ') || 'Keluarga Orang Tua';
      const parentMembers: FamilyNodeMember[] = [];
      if (p0) parentMembers.push({ name: p0.publicName || p0.name, photo: p0.photo || null, role: 'head' });
      if (p1) parentMembers.push({ name: p1.publicName || p1.name, photo: p1.photo || null, role: 'spouse' });
      fnNodes.push({
        id: 'fn-parent',
        name: `Keluarga ${parentName}`,
        familyImage: null,
        slug: null,
        kind: 'parent',
        fnMembers: parentMembers.length > 0 ? parentMembers : undefined,
        x: 0, y: -280,
      });
      fnLinks.push({ from: 'fn-self', to: 'fn-parent' });
    }

    // Older siblings (left)
    for (let i = 0; i < cfg.olderCount; i++) {
      const k = ms[`older-${i}`];
      const sibName = k?.publicName || k?.name || `Kakak ${i + 1}`;
      fnNodes.push({
        id: `fn-kakak-${i}`,
        name: `Keluarga ${sibName}`,
        familyImage: k?.photo || null,
        slug: null,
        kind: 'sibling',
        fnMembers: k ? [{ name: k.publicName || k.name, photo: k.photo || null, role: 'head' }] : undefined,
        x: -240 * (i + 1), y: 0,
      });
      fnLinks.push({ from: 'fn-self', to: `fn-kakak-${i}` });
    }

    // Younger siblings (right)
    for (let i = 0; i < cfg.youngerCount; i++) {
      const a = ms[`younger-${i}`];
      const sibName = a?.publicName || a?.name || `Adik ${i + 1}`;
      fnNodes.push({
        id: `fn-adik-${i}`,
        name: `Keluarga ${sibName}`,
        familyImage: a?.photo || null,
        slug: null,
        kind: 'sibling',
        fnMembers: a ? [{ name: a.publicName || a.name, photo: a.photo || null, role: 'head' }] : undefined,
        x: 240 * (i + 1), y: 0,
      });
      fnLinks.push({ from: 'fn-self', to: `fn-adik-${i}` });
    }

    // Children with spouses (below)
    const childNodes: FamilyNodeItem[] = [];
    for (let i = 0; i < cfg.childCount; i++) {
      const c = ms[`child-${i}`];
      const hasSpouse = c?.spouseId || ms[`child-${i}-spouse`];
      if (hasSpouse) {
        const childName = c?.publicName || c?.name || `Anak ${i + 1}`;
        const childMembers: FamilyNodeMember[] = [];
        if (c) childMembers.push({ name: c.publicName || c.name, photo: c.photo || null, role: 'head' });
        const spouseKey = c?.spouseId || `child-${i}-spouse`;
        const cs = ms[spouseKey];
        if (cs) childMembers.push({ name: cs.publicName || cs.name, photo: cs.photo || null, role: 'spouse' });
        childNodes.push({
          id: `fn-child-${i}`,
          name: `Keluarga ${childName}`,
          familyImage: c?.photo || null,
          slug: null,
          kind: 'child',
          fnMembers: childMembers.length > 0 ? childMembers : undefined,
          x: 0, y: 0,
        });
      }
    }
    const childSpread = 220;
    childNodes.forEach((n, idx) => {
      n.x = (idx - (childNodes.length - 1) / 2) * childSpread;
      n.y = 280;
      fnNodes.push(n);
      fnLinks.push({ from: 'fn-self', to: n.id });
    });

    return { nodes: fnNodes, links: fnLinks };
  }, [data, config, members, slug]);

  // ─── Layout: main family (always visible) + parent sets + sibling groups (tagged, hidden by default) ───
  const { nodes, lines, layoutInfo } = useMemo(() => {
    if (!data?.config) return { nodes: [] as TNode[], lines: [] as Poly[], layoutInfo: null as null | { selfX: number; spouseXs: number[]; coupleMid: number } };
    const cfg = config;
    const ns: TNode[] = [];
    const ls: Poly[] = [];

    // ─── Space the couple by the room each side's ancestry actually needs ───
    // Branch offsets are absolute distances from their owner's column, so a
    // FIXED couple gap made the two sides interpenetrate: self's ibu-side uncles
    // sit at selfX + 180 while the spouse's Ortu sat only 160 away. Measure each
    // partner's horizontal envelope first, then place the columns so the
    // envelopes can never touch.
    const branchCount = (m: Members[string] | undefined) =>
      (m?.familyConfig?.olderCount ?? 0) + (m?.familyConfig?.youngerCount ?? 0) + (m?.familyConfig?.siblingCount ?? 0);

    const envelopeOf = (person: 'self' | number): { left: number; right: number } => {
      const isSelf = person === 'self';
      const key = isSelf ? 'self' : `spouse-${person}`;
      const mem = members[key];
      const ownR = radiusOf(isSelf ? 'self' : 'spouse');
      let left = ownR;
      let right = ownR;

      // Siblings/uncles only render when the person has parents, so the envelope
      // must be gated the same way or the layout would reserve phantom space.
      const parentCount = isSelf ? cfg.parentCount : (mem?.familyConfig?.parentCount ?? 0);
      if (parentCount > 0) {
        // Reserve the EXPANDED Ayah/Ibu width up front. Opening the Ortu bubble
        // then costs no extra room, so the tree never shifts or collides on click.
        const parentHalf = PARENT_SPACING / 2 + radiusOf('parent');
        left = Math.max(left, parentHalf);
        right = Math.max(right, parentHalf);

        // Saudara bubble: self fans left, a spouse fans right (away from centre).
        const sibs = isSelf
          ? (mem?.familyConfig?.olderCount ?? cfg.olderCount)
            + (mem?.familyConfig?.youngerCount ?? cfg.youngerCount)
            + (mem?.familyConfig?.siblingCount ?? 0)
          : branchCount(mem);
        if (sibs > 0) {
          const reach = SIB_OFFSET + radiusOf(isSelf ? 'kakak' : 'adik');
          if (isSelf) left = Math.max(left, reach);
          else right = Math.max(right, reach);
        }

        // Paman/Bibi: ayah's siblings sit left, ibu's siblings sit right.
        const uncleReach = UNCLE_OFFSET + radiusOf('uncle');
        const ayahKey = isSelf ? 'parent-0' : `${key}-parent-0`;
        const ibuKey = isSelf ? 'parent-1' : `${key}-parent-1`;
        if (branchCount(members[ayahKey]) > 0) left = Math.max(left, uncleReach);
        if (branchCount(members[ibuKey]) > 0) right = Math.max(right, uncleReach);
      }
      return { left, right };
    };

    // Self + spouses (y = 0) — always visible (no tag)
    const partners: Array<'self' | number> = ['self', ...Array.from({ length: cfg.spouseCount }, (_, i) => i)];
    const envelopes = partners.map(envelopeOf);
    const rawXs = [0];
    for (let i = 1; i < envelopes.length; i++) {
      const gap = Math.max(MIN_COUPLE_GAP, envelopes[i - 1].right + COUPLE_CLEARANCE + envelopes[i].left);
      rawXs.push(rawXs[i - 1] + gap);
    }
    // Centre the row — envelopes included — on x = 0 so the canvas stays balanced.
    const rowShift = ((rawXs[0] - envelopes[0].left) + (rawXs[rawXs.length - 1] + envelopes[envelopes.length - 1].right)) / 2;
    const coupleXs = rawXs.map((x) => x - rowShift);
    const selfX = coupleXs[0];
    const spouseXs = coupleXs.slice(1);
    ns.push({ id: 'self', name: 'Anda', role: 'Diri Sendiri', x: selfX, y: 0, group: 'self' });
    for (let i = 0; i < cfg.spouseCount; i++) {
      const sx = spouseXs[i];
      ns.push({ id: `spouse-${i}`, name: cfg.spouseCount > 1 ? `Pasangan ${i + 1}` : 'Pasangan', role: 'Suami / Istri', x: sx, y: 0, group: 'spouse' });
      ls.push({ points: [[selfX, 0], [sx, 0]], marriage: true });
    }
    const coupleMid = coupleXs.reduce((a, b) => a + b, 0) / coupleXs.length;

    // Children (y = 210) — always visible
    const childXs = spreadX(cfg.childCount, 130, coupleMid);
    childXs.forEach((x, i) => ns.push({ id: `child-${i}`, name: `Anak ${i + 1}`, role: 'Keturunan', x, y: 210, group: 'child' }));
    connectDown(ls, coupleMid, 0, childXs, 210);

    // ─── Self's parents (tag: 'self-parents') — single "Ortu" circle ───
    if (cfg.parentCount > 0) {
      const ortuY = -210;
      ns.push({ id: 'self-ortu', name: 'Ortu', role: 'Orang Tua', x: selfX, y: ortuY, group: 'parent', tag: 'self-parents' });
      ls.push({ points: [[selfX, ortuY], [selfX, 0]], tag: 'self-parents' });

      // Self's siblings (tag: 'self-siblings') — ONE combined group bubble on the LEFT
      const selfSibOlder = members['self']?.familyConfig?.olderCount ?? cfg.olderCount;
      const selfSibYounger = members['self']?.familyConfig?.youngerCount ?? cfg.youngerCount;
      const selfSibLegacy = members['self']?.familyConfig?.siblingCount ?? 0;
      const totalSibs = selfSibOlder + selfSibYounger + selfSibLegacy;
      if (totalSibs > 0) {
        const sibX = selfX - SIB_OFFSET;
        const sibTrunkY = -105;
        ns.push({ id: 'grp-self-saudara', name: `Saudara ${totalSibs}`, role: 'group', x: sibX, y: 0, group: 'kakak', count: totalSibs, tag: 'self-siblings' });
        ls.push({ points: [[sibX, 0], [sibX, sibTrunkY], [selfX, sibTrunkY]], tag: 'self-siblings' });
      }

      // Self's grandparents (tag: 'self-grandparents') — single "Simbah" circle above Ortu
      if (cfg.simbahP > 0 || cfg.simbahM > 0) {
        const simbahY = -420;
        const simbahTrunkY = -315;
        ns.push({ id: 'self-simbah', name: 'Simbah', role: 'Simbah', x: selfX, y: simbahY, group: 'grandparent', tag: 'self-grandparents' });
        ls.push({ points: [[selfX, -210], [selfX, simbahTrunkY], [selfX, simbahY]], tag: 'self-grandparents' });
      }

      // Self's uncles — attached to Simbah level, like siblings attach to parent level
      const ayahMember = members['parent-0'];
      const ayahUncleOlder = ayahMember?.familyConfig?.olderCount ?? 0;
      const ayahUncleYounger = ayahMember?.familyConfig?.youngerCount ?? 0;
      const ayahUncleLegacy = ayahMember?.familyConfig?.siblingCount ?? 0;
      const totalAyahUncles = ayahUncleOlder + ayahUncleYounger + ayahUncleLegacy;
      if (totalAyahUncles > 0) {
        const uncleX = selfX - UNCLE_OFFSET;
        const uncleTrunkY = -315;
        ns.push({ id: 'grp-self-paman-ayah', name: `Paman/Bibi ${totalAyahUncles}`, role: 'group', x: uncleX, y: -420, group: 'uncle', count: totalAyahUncles, tag: 'self-uncles' });
        ls.push({ points: [[uncleX, -420], [uncleX, uncleTrunkY], [selfX, uncleTrunkY]], tag: 'self-uncles' });
      }
      const ibuMember = members['parent-1'];
      const ibuUncleOlder = ibuMember?.familyConfig?.olderCount ?? 0;
      const ibuUncleYounger = ibuMember?.familyConfig?.youngerCount ?? 0;
      const ibuUncleLegacy = ibuMember?.familyConfig?.siblingCount ?? 0;
      const totalIbuUncles = ibuUncleOlder + ibuUncleYounger + ibuUncleLegacy;
      if (totalIbuUncles > 0) {
        const uncleX = selfX + UNCLE_OFFSET;
        const uncleTrunkY = -315;
        ns.push({ id: 'grp-self-paman-ibu', name: `Paman/Bibi ${totalIbuUncles}`, role: 'group', x: uncleX, y: -420, group: 'uncle', count: totalIbuUncles, tag: 'self-uncles' });
        ls.push({ points: [[uncleX, -420], [uncleX, uncleTrunkY], [selfX, uncleTrunkY]], tag: 'self-uncles' });
      }
    }

    // ─── Spouse's parents (tag: 'spouse-0-parents', etc.) — single "Ortu" circle ───
    for (let si = 0; si < cfg.spouseCount; si++) {
      const sx = spouseXs[si];
      const spMember = members[`spouse-${si}`];
      // A spouse's ancestry comes from their OWN tree config (hydrated by the
      // API as familyConfig) — never from the slug owner's counts.
      const spParentCount = spMember?.familyConfig?.parentCount ?? 0;
      if (spParentCount > 0) {
        const tag = `spouse-${si}-parents`;
        const ortuY = -210;
        ns.push({ id: `spouse-${si}-ortu`, name: 'Ortu', role: 'Orang Tua', x: sx, y: ortuY, group: 'parent', tag });
        ls.push({ points: [[sx, ortuY], [sx, 0]], tag });

        // Spouse's siblings — ONE combined group bubble on the RIGHT
        const spSibOlder = spMember?.familyConfig?.olderCount ?? 0;
        const spSibYounger = spMember?.familyConfig?.youngerCount ?? 0;
        const spSibLegacy = spMember?.familyConfig?.siblingCount ?? 0;
        const totalSibs = spSibOlder + spSibYounger + spSibLegacy;
        if (totalSibs > 0) {
          const sibTag = `spouse-${si}-siblings`;
          const sibX = sx + SIB_OFFSET;
          const sibTrunkY = -105;
          ns.push({ id: `grp-spouse-${si}-saudara`, name: `Saudara ${totalSibs}`, role: 'group', x: sibX, y: 0, group: 'adik', count: totalSibs, tag: sibTag });
          ls.push({ points: [[sibX, 0], [sibX, sibTrunkY], [sx, sibTrunkY]], tag: sibTag });
        }

        // Spouse's grandparents (tag: 'spouse-{i}-grandparents') — "Simbah" circle above Ortu
        if (cfg.simbahP > 0 || cfg.simbahM > 0) {
          const gpTag = `spouse-${si}-grandparents`;
          const simbahY = -420;
          const simbahTrunkY = -315;
          ns.push({ id: `spouse-${si}-simbah`, name: 'Simbah', role: 'Simbah', x: sx, y: simbahY, group: 'grandparent', tag: gpTag });
          ls.push({ points: [[sx, -210], [sx, simbahTrunkY], [sx, simbahY]], tag: gpTag });
        }

        // Spouse's uncles — attached to Simbah level, like siblings attach to parent level
        const spAyahMember = members[`spouse-${si}-parent-0`];
        const spAyahUncleOlder = spAyahMember?.familyConfig?.olderCount ?? 0;
        const spAyahUncleYounger = spAyahMember?.familyConfig?.youngerCount ?? 0;
        const spAyahUncleLegacy = spAyahMember?.familyConfig?.siblingCount ?? 0;
        const spTotalAyahUncles = spAyahUncleOlder + spAyahUncleYounger + spAyahUncleLegacy;
        if (spTotalAyahUncles > 0) {
          const uncleTag = `spouse-${si}-uncles`;
          const uncleX = sx - UNCLE_OFFSET;
          const uncleTrunkY = -315;
          ns.push({ id: `grp-spouse-${si}-paman-ayah`, name: `Paman/Bibi ${spTotalAyahUncles}`, role: 'group', x: uncleX, y: -420, group: 'uncle', count: spTotalAyahUncles, tag: uncleTag });
          ls.push({ points: [[uncleX, -420], [uncleX, uncleTrunkY], [sx, uncleTrunkY]], tag: uncleTag });
        }
        const spIbuMember = members[`spouse-${si}-parent-1`];
        const spIbuUncleOlder = spIbuMember?.familyConfig?.olderCount ?? 0;
        const spIbuUncleYounger = spIbuMember?.familyConfig?.youngerCount ?? 0;
        const spIbuUncleLegacy = spIbuMember?.familyConfig?.siblingCount ?? 0;
        const spTotalIbuUncles = spIbuUncleOlder + spIbuUncleYounger + spIbuUncleLegacy;
        if (spTotalIbuUncles > 0) {
          const uncleTag = `spouse-${si}-uncles`;
          const uncleX = sx + UNCLE_OFFSET;
          const uncleTrunkY = -315;
          ns.push({ id: `grp-spouse-${si}-paman-ibu`, name: `Paman/Bibi ${spTotalIbuUncles}`, role: 'group', x: uncleX, y: -420, group: 'uncle', count: spTotalIbuUncles, tag: uncleTag });
          ls.push({ points: [[uncleX, -420], [uncleX, uncleTrunkY], [sx, uncleTrunkY]], tag: uncleTag });
        }
      }
    }

    return { nodes: ns, lines: ls, layoutInfo: { selfX, spouseXs, coupleMid } };
  }, [data?.config, config, members]);

  // ─── Expand sibling group bubbles and Ortu bubbles into individual circles ───
  const { displayNodes, displayLines } = useMemo(() => {
    let curNodes = nodes;
    let curLines = lines;

    // ── Expand Ortu bubble into Ayah + Ibu ──
    if (expandedParent) {
      const ortuNode = curNodes.find(n => n.id === expandedParent);
      if (ortuNode) {
        const tag = ortuNode.tag;
        const cx = ortuNode.x;
        const y = ortuNode.y;
        const parentXs = [cx - PARENT_SPACING / 2, cx + PARENT_SPACING / 2];
        const parentLabels = ['Ayah', 'Ibu'];
        const parentNodes: TNode[] = parentXs.map((x, i) => ({
          id: `${ortuNode.id}-parent-${i}`,
          name: parentLabels[i],
          role: 'Orang Tua',
          x,
          y,
          group: 'parent',
          tag,
        }));
        curNodes = curNodes.filter(n => n.id !== expandedParent).concat(parentNodes);
        // Replace the single Ortu line with individual lines from each parent to the child below
        const childY = 0;
        const trunkY = (y + childY) / 2;
        const childX = (() => {
          if (ortuNode.id === 'self-ortu') return curNodes.find(n => n.id === 'self')?.x ?? cx;
          const m = ortuNode.id.match(/^spouse-(\d+)-ortu$/);
          if (m) return curNodes.find(n => n.id === `spouse-${m[1]}`)?.x ?? cx;
          return cx;
        })();
        curLines = curLines.filter(l => l.tag !== tag).concat(
          [{ points: [[parentXs[0], y], [parentXs[1], y]], tag }],
          parentXs.map(x => ({ points: [[x, y], [x, trunkY]], tag })),
          [{ points: [[parentXs[0], trunkY], [parentXs[1], trunkY]], tag }],
          [{ points: [[childX, trunkY], [childX, childY]], tag }]
        );
      }
    }

    // ── Expand uncle group bubbles ──
    if (expandedUncle) {
      const uncNode = curNodes.find(n => n.id === expandedUncle);
      if (uncNode) {
        const uncTag = uncNode.tag;
        const uncCount = uncNode.count ?? 0;
        if (uncTag && uncCount > 0) {
          const UNC_SPACING = 90;
          const ux = uncNode.x;
          const uy = uncNode.y;
          const isLeft = ux < 0 || expandedUncle.includes('-ayah');
          const uncPrefix = expandedUncle.replace('grp-', 'unc-');
          const uncXs = isLeft
            ? Array.from({ length: uncCount }, (_, i) => ux - i * UNC_SPACING)
            : Array.from({ length: uncCount }, (_, i) => ux + i * UNC_SPACING);
          const uncNodes: TNode[] = uncXs.map((x, i) => ({
            id: `${uncPrefix}-${i}`,
            name: `Paman/Bibi ${i + 1}`,
            role: 'Paman/Bibi',
            x,
            y: uy,
            group: 'uncle',
            tag: uncTag,
          }));
          curNodes = curNodes.filter(n => n.id !== expandedUncle).concat(uncNodes);
          // Trunk point is the Simbah position at y=-420, trunk horizontal at y=-315
          const trunkX = (() => {
            if (expandedUncle.startsWith('grp-self-')) return nodes.find(n => n.id === 'self-simbah')?.x ?? 0;
            const m = expandedUncle.match(/^grp-spouse-(\d+)-paman/);
            if (m) return nodes.find(n => n.id === `spouse-${m[1]}-simbah`)?.x ?? 0;
            return ux;
          })();
          curLines = curLines.filter(l => l.tag !== uncTag).concat(
            uncXs.map(x => ({ points: [[x, uy], [x, -315], [trunkX, -315]], tag: uncTag }))
          );
        }
      }
    }

    // ── Expand Simbah bubble into Simbah Kakung + Simbah Putri ──
    if (expandedGrandparent) {
      const gpNode = curNodes.find(n => n.id === expandedGrandparent);
      if (gpNode) {
        const gpTag = gpNode.tag;
        if (gpTag) {
          const GP_SPACING = 130;
          const gx = gpNode.x;
          const gy = gpNode.y; // -420
          const gpXs = [gx - GP_SPACING / 2, gx + GP_SPACING / 2];
          const gpNodes: TNode[] = [
            { id: `${expandedGrandparent}-parent-0`, name: 'Simbah Kakung', role: 'Simbah', x: gpXs[0], y: gy, group: 'grandparent', tag: gpTag },
            { id: `${expandedGrandparent}-parent-1`, name: 'Simbah Putri', role: 'Simbah', x: gpXs[1], y: gy, group: 'grandparent', tag: gpTag },
          ];
          curNodes = curNodes.filter(n => n.id !== expandedGrandparent).concat(gpNodes);
          // Trunk: vertical from ortu (y=-210) to trunk (y=-315), horizontal between the two grandparents, vertical down to each
          const trunkX = (() => {
            if (expandedGrandparent === 'self-simbah') return nodes.find(n => n.id === 'self-ortu')?.x ?? gx;
            const m = expandedGrandparent.match(/^spouse-(\d+)-simbah$/);
            if (m) return nodes.find(n => n.id === `spouse-${m[1]}-ortu`)?.x ?? gx;
            return gx;
          })();
          curLines = curLines.filter(l => l.tag !== gpTag).concat(
            [{ points: [[trunkX, -210], [trunkX, -315]], tag: gpTag }],
            [{ points: [[gpXs[0], -315], [gpXs[1], -315]], tag: gpTag }],
            gpXs.map(x => ({ points: [[x, -315], [x, gy]], tag: gpTag })),
          );
        }
      }
    }

    // ── Expand sibling group bubbles ──
    if (!expandedGroup) return { displayNodes: curNodes, displayLines: curLines };
    const grpNode = curNodes.find(n => n.id === expandedGroup);
    if (!grpNode) return { displayNodes: curNodes, displayLines: curLines };

    // Determine the sibling group details
    const count = grpNode.count ?? 0;
    const tag = grpNode.tag;
    if (!tag || count === 0) return { displayNodes: curNodes, displayLines: curLines };

    // Generate individual sibling circles at the same position area
    const SIB_SPACING = 90;
    const cx = grpNode.x;
    const y = grpNode.y;
    const groupPrefix = expandedGroup.replace('grp-', 'sib-');

    // Pack circles outward from the group bubble's x (self→left, spouse→right)
    const isSelfSide = expandedGroup.startsWith('grp-self-');
    const sibXs = isSelfSide
      ? Array.from({ length: count }, (_, i) => cx - i * SIB_SPACING)
      : Array.from({ length: count }, (_, i) => cx + i * SIB_SPACING);
    // The bubble packs the older siblings first, so label them accordingly.
    const sibOlderCount = isSelfSide
      ? (members['self']?.familyConfig?.olderCount ?? config.olderCount)
      : (members[expandedGroup.replace(/^grp-(spouse-\d+)-saudara$/, '$1')]?.familyConfig?.olderCount ?? 0);
    const sibNodes: TNode[] = sibXs.map((x, i) => ({
      id: `${groupPrefix}-${i}`,
      name: i < sibOlderCount ? `Kakak ${i + 1}` : `Adik ${i - sibOlderCount + 1}`,
      role: i < sibOlderCount ? 'Saudara Tua' : 'Saudara Muda',
      x,
      y,
      group: i < sibOlderCount ? 'kakak' : 'adik',
      tag,
    }));

    // Replace the group bubble with individual circles
    const newNodes = curNodes.filter(n => n.id !== expandedGroup).concat(sibNodes);

    // Remove the old group→parent line and add individual lines from each sibling to the trunk
    // The trunk horizontal endpoint is the main node (selfX or spouse x), not the bubble center
    const trunkX = (() => {
      if (expandedGroup.startsWith('grp-self-')) return nodes.find(n => n.id === 'self')?.x ?? 0;
      const m = expandedGroup.match(/^grp-spouse-(\d+)-saudara/);
      if (m) return nodes.find(n => n.id === `spouse-${m[1]}`)?.x ?? 0;
      return cx;
    })();
    const newLines = curLines.filter(l => l.tag !== tag).concat(
      sibXs.map(x => ({ points: [[x, y], [x, -105], [trunkX, -105]], tag }))
    );

    return { displayNodes: newNodes, displayLines: newLines };
  }, [nodes, lines, expandedGroup, expandedParent, expandedUncle, expandedGrandparent, members, config.olderCount]);

  // Compute visible tags and opacity overrides based on hover state
  const { visibleTags, nodeOpacity, lineOpacity } = useMemo(() => {
    const vTags = new Set<string>();
    const nOp: Record<string, number> = {};
    const lOp: number[] = displayLines.map(() => 1);

    if (hoverLevel === 'none' || !hoverTarget) {
      // Show all expanded branches with opacity 1
      for (const exp of expansionStack) {
        vTags.add(exp.tag);
      }
      for (const n of displayNodes) {
        if (n.tag && vTags.has(n.tag)) nOp[n.id] = 1;
        else if (n.tag && !vTags.has(n.tag)) nOp[n.id] = 0;
      }
      for (let i = 0; i < displayLines.length; i++) {
        const lt = displayLines[i].tag;
        if (lt && vTags.has(lt)) lOp[i] = 1;
        else if (lt && !vTags.has(lt)) lOp[i] = 0;
      }
      return { visibleTags: vTags, nodeOpacity: nOp, lineOpacity: lOp };
    }

    // Determine which parent tag is active
    let activeParentTag: string | null = null;
    let activeSibTag: string | null = null;
    let activeGpTag: string | null = null;
    let activeUncleTag: string | null = null;

    if (hoverLevel === 'spouse-level') {
      activeParentTag = getParentsTagForNode(hoverTarget);
    } else if (hoverLevel === 'parent-level') {
      activeParentTag = getParentTag(hoverTarget);
      // If hovering a sibling group or individual sibling, also find the parent tag
      if (!activeParentTag) {
        const sibTag = getSiblingTag(hoverTarget) || getSiblingTagFromIndividual(hoverTarget);
        if (sibTag) {
          activeSibTag = sibTag;
          // Derive parent tag from sibling tag
          if (sibTag === 'self-siblings') activeParentTag = 'self-parents';
          else {
            const m = sibTag.match(/^spouse-(\d+)-siblings$/);
            if (m) activeParentTag = `spouse-${m[1]}-parents`;
          }
        }
      } else {
        // Hovering a parent → derive sibling tag
        if (activeParentTag === 'self-parents') activeSibTag = 'self-siblings';
        else {
          const m = activeParentTag.match(/^spouse-(\d+)-parents$/);
          if (m) activeSibTag = `spouse-${m[1]}-siblings`;
        }
      }
      // Derive grandparent and uncle tags from parent tag
      if (activeParentTag === 'self-parents') {
        activeGpTag = 'self-grandparents';
        activeUncleTag = 'self-uncles';
      } else if (activeParentTag) {
        const m = activeParentTag.match(/^spouse-(\d+)-parents$/);
        if (m) {
          activeGpTag = `spouse-${m[1]}-grandparents`;
          activeUncleTag = `spouse-${m[1]}-uncles`;
        }
      }
      // If hovering grandparent or uncle directly, derive from those
      if (!activeParentTag) {
        const gpTag = getGrandparentTag(hoverTarget);
        if (gpTag) {
          activeGpTag = gpTag;
          if (gpTag === 'self-grandparents') {
            activeParentTag = 'self-parents';
            activeUncleTag = 'self-uncles';
          } else {
            const m = gpTag.match(/^spouse-(\d+)-grandparents$/);
            if (m) {
              activeParentTag = `spouse-${m[1]}-parents`;
              activeUncleTag = `spouse-${m[1]}-uncles`;
            }
          }
        }
        const uncTag = getUncleTag(hoverTarget);
        if (uncTag) {
          activeUncleTag = uncTag;
          if (uncTag === 'self-uncles') activeParentTag = 'self-parents';
          else {
            const m = uncTag.match(/^spouse-(\d+)-uncles$/);
            if (m) activeParentTag = `spouse-${m[1]}-parents`;
          }
        }
      }
    }

    if (activeParentTag) {
      vTags.add(activeParentTag);
      if (hoverLevel === 'spouse-level') {
        // Parents faint (0.35)
        for (const n of displayNodes) {
          if (n.tag === activeParentTag) nOp[n.id] = 0.35;
        }
        for (let i = 0; i < displayLines.length; i++) {
          if (displayLines[i].tag === activeParentTag) lOp[i] = 0.35;
        }
      } else if (hoverLevel === 'parent-level') {
        // Parents solid (1.0)
        for (const n of displayNodes) {
          if (n.tag === activeParentTag) nOp[n.id] = 1;
        }
        for (let i = 0; i < displayLines.length; i++) {
          if (displayLines[i].tag === activeParentTag) lOp[i] = 1;
        }
        // Siblings faint (0.35) — unless expanded (then solid) or hovered directly (then solid)
        if (activeSibTag) {
          vTags.add(activeSibTag);
          const isExpanded = expandedGroup && displayNodes.some(n => n.tag === activeSibTag && n.id.startsWith('sib-'));
          const isHovered = getSiblingTag(hoverTarget) === activeSibTag;
          const sibOpacity = (isExpanded || isHovered) ? 1 : 0.35;
          for (const n of displayNodes) {
            if (n.tag === activeSibTag) nOp[n.id] = sibOpacity;
          }
          for (let i = 0; i < displayLines.length; i++) {
            if (displayLines[i].tag === activeSibTag) lOp[i] = sibOpacity;
          }
        }
        // Grandparents faint (0.35)
        if (activeGpTag) {
          vTags.add(activeGpTag);
          for (const n of displayNodes) {
            if (n.tag === activeGpTag) nOp[n.id] = 0.35;
          }
          for (let i = 0; i < displayLines.length; i++) {
            if (displayLines[i].tag === activeGpTag) lOp[i] = 0.35;
          }
        }
        // Uncles faint (0.35)
        if (activeUncleTag) {
          vTags.add(activeUncleTag);
          for (const n of displayNodes) {
            if (n.tag === activeUncleTag) nOp[n.id] = 0.35;
          }
          for (let i = 0; i < displayLines.length; i++) {
            if (displayLines[i].tag === activeUncleTag) lOp[i] = 0.35;
          }
        }
      }
    }

    // Override: expanded branches always get opacity 1 regardless of hover
    for (const exp of expansionStack) {
      for (const n of displayNodes) {
        if (n.tag === exp.tag) nOp[n.id] = 1;
      }
      for (let i = 0; i < displayLines.length; i++) {
        if (displayLines[i].tag === exp.tag) lOp[i] = 1;
      }
    }

    // All other tagged nodes/lines are hidden
    for (const n of displayNodes) {
      if (n.tag && !vTags.has(n.tag)) nOp[n.id] = 0;
    }
    for (let i = 0; i < displayLines.length; i++) {
      const lt = displayLines[i].tag;
      if (lt && !vTags.has(lt)) lOp[i] = 0;
    }

    return { visibleTags: vTags, nodeOpacity: nOp, lineOpacity: lOp };
  }, [hoverTarget, hoverLevel, displayNodes, displayLines, expansionStack]);

  // ─── Compute close button position for the last-expanded branch only (LIFO) ───
  const closeButtons = useMemo(() => {
    if (expansionStack.length === 0) return [];
    const last = expansionStack[expansionStack.length - 1];

    if (last.kind === 'parent') {
      const ortuNode = nodes.find(n => n.id === last.id);
      if (ortuNode?.tag) {
        return [{ x: ortuNode.x, y: -105, tag: ortuNode.tag }];
      }
    }

    if (last.kind === 'sibling') {
      const sibNodes = displayNodes.filter(n => n.id.startsWith('sib-') && n.tag === last.tag);
      if (sibNodes.length > 0) {
        const trunkNode = last.id.startsWith('grp-self-')
          ? nodes.find(n => n.id === 'self')
          : nodes.find(n => n.id === last.id.replace(/^grp-(spouse-\d+)-saudara$/, '$1'));
        const trunkX = trunkNode?.x ?? 0;
        const outermost = sibNodes.reduce((prev, curr) =>
          Math.abs(curr.x - trunkX) > Math.abs(prev.x - trunkX) ? curr : prev
        );
        return [{ x: outermost.x, y: -105, tag: last.tag }];
      }
    }

    if (last.kind === 'uncle') {
      const uncNodes = displayNodes.filter(n => n.id.startsWith('unc-') && n.tag === last.tag);
      if (uncNodes.length > 0) {
        const trunkNode = last.id.startsWith('grp-self-')
          ? nodes.find(n => n.id === 'self-simbah')
          : nodes.find(n => n.id === last.id.replace(/^grp-(spouse-\d+)-paman.*$/, 'spouse-$1-simbah'));
        const trunkX = trunkNode?.x ?? 0;
        const outermost = uncNodes.reduce((prev, curr) =>
          Math.abs(curr.x - trunkX) > Math.abs(prev.x - trunkX) ? curr : prev
        );
        return [{ x: outermost.x, y: -315, tag: last.tag }];
      }
    }

    if (last.kind === 'grandparent') {
      const gpNode = nodes.find(n => n.id === last.id);
      if (gpNode?.tag) {
        return [{ x: gpNode.x, y: -315, tag: gpNode.tag }];
      }
    }

    return [];
  }, [expansionStack, displayNodes, nodes]);

  const onCloseBranch = useCallback((tag: string) => {
    setExpansionStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.tag !== tag) return prev; // LIFO: only close the last-opened branch
      return prev.slice(0, -1);
    });
  }, []);

  // Rendered circles use layout-specific ids ("self-ortu-parent-0",
  // "sib-self-saudara-2", "unc-self-paman-ayah-1"), but the member records saved
  // by the tree editor are keyed by the canonical node ids ("parent-0",
  // "older-2", "unclePo-1"). Without this translation every expanded circle
  // falls back to its generic label and shows no photo.
  const memberKeyFor = (id: string): string => {
    // Parents — Ayah = parent-0, Ibu = parent-1
    let m = id.match(/^self-ortu-parent-(\d+)$/);
    if (m) return `parent-${m[1]}`;
    m = id.match(/^spouse-(\d+)-ortu-parent-(\d+)$/);
    if (m) return `spouse-${m[1]}-parent-${m[2]}`;

    // Grandparents — the Simbah bubble expands to whichever side exists
    const gpSide = config.simbahP > 0 ? 'P' : 'M';
    m = id.match(/^self-simbah-parent-(\d+)$/);
    if (m) return `gp${gpSide}-${m[1]}`;
    m = id.match(/^spouse-(\d+)-simbah-parent-(\d+)$/);
    if (m) return `spouse-${m[1]}-gp${gpSide}-${m[2]}`;

    // Siblings — the bubble packs the older ones first, then the younger ones
    m = id.match(/^sib-self-saudara-(\d+)$/);
    if (m) {
      const i = Number(m[1]);
      const older = members['self']?.familyConfig?.olderCount ?? config.olderCount;
      return i < older ? `older-${i}` : `younger-${i - older}`;
    }
    m = id.match(/^sib-spouse-(\d+)-saudara-(\d+)$/);
    if (m) {
      const si = m[1];
      const i = Number(m[2]);
      const older = members[`spouse-${si}`]?.familyConfig?.olderCount ?? 0;
      return i < older ? `spouse-${si}-older-${i}` : `spouse-${si}-younger-${i - older}`;
    }

    // Uncles/aunts — ayah's siblings are paternal (P), ibu's are maternal (M)
    m = id.match(/^unc-self-paman-(ayah|ibu)-(\d+)$/);
    if (m) {
      const side = m[1] === 'ayah' ? 'P' : 'M';
      const i = Number(m[2]);
      const older = members[m[1] === 'ayah' ? 'parent-0' : 'parent-1']?.familyConfig?.olderCount ?? 0;
      return i < older ? `uncle${side}o-${i}` : `uncle${side}y-${i - older}`;
    }
    m = id.match(/^unc-spouse-(\d+)-paman-(ayah|ibu)-(\d+)$/);
    if (m) {
      const si = m[1];
      const side = m[2] === 'ayah' ? 'P' : 'M';
      const i = Number(m[3]);
      const older = members[`spouse-${si}-parent-${m[2] === 'ayah' ? 0 : 1}`]?.familyConfig?.olderCount ?? 0;
      return i < older ? `spouse-${si}-uncle${side}o-${i}` : `spouse-${si}-uncle${side}y-${i - older}`;
    }

    return id;
  };

  const resolve = (id: string, fallback: string) => {
    const m = members[memberKeyFor(id)];
    const rawName = id === 'self' ? (m?.name || data?.owner?.name || 'Anda') : (m?.name || fallback);
    const name = m?.publicName || rawName;
    const photo = id === 'self' ? (m?.photo || data?.owner?.avatar || null) : (m?.photo || null);
    return { name, photo, alive: m?.alive !== false, gender: m?.gender || '', verified: id === 'self' ? true : m?.verified, statusLabel: m?.statusLabel || null };
  };

  const onNodeClick = (node: TNode) => {
    // If a sibling group is expanded and user clicks an individual sibling circle → open modal
    if (expandedGroup && (node.id.startsWith('sib-') || node.id.startsWith('sib-spouse-'))) {
      setSelectedNode(node);
      setClaimError(null);
      setEaError('');
      setEaSuccess('');
      setEaOpen(false);
      return;
    }
    // If an Ortu bubble is expanded and user clicks an individual parent circle → open modal
    if (expandedParent && (node.id.startsWith('self-ortu-parent-') || node.id.match(/^spouse-\d+-ortu-parent-/))) {
      setSelectedNode(node);
      setClaimError(null);
      setEaError('');
      setEaSuccess('');
      setEaOpen(false);
      return;
    }
    // If an uncle group is expanded and user clicks an individual uncle circle → open modal
    if (expandedUncle && node.id.startsWith('unc-')) {
      setSelectedNode(node);
      setClaimError(null);
      setEaError('');
      setEaSuccess('');
      setEaOpen(false);
      return;
    }
    // If a Simbah bubble is expanded and user clicks an individual grandparent circle → open modal
    if (expandedGrandparent && (node.id.startsWith('self-simbah-parent-') || node.id.match(/^spouse-\d+-simbah-parent-/))) {
      setSelectedNode(node);
      setClaimError(null);
      setEaError('');
      setEaSuccess('');
      setEaOpen(false);
      return;
    }
    // Ortu bubble click → expand into Ayah + Ibu (push to stack, do NOT toggle)
    if (node.name === 'Ortu' && node.tag) {
      // Block if a different side already has active expansions
      if (activeSide && getSide(node.id) !== activeSide) return;
      setExpansionStack(prev =>
        prev.some(e => e.id === node.id) ? prev : [...prev, { id: node.id, tag: node.tag!, kind: 'parent' as const }]
      );
      return;
    }
    // Simbah bubble click → expand into Simbah Kakung + Simbah Putri (push to stack)
    if (node.name === 'Simbah' && node.tag) {
      if (activeSide && getSide(node.id) !== activeSide) return;
      setExpansionStack(prev =>
        prev.some(e => e.id === node.id) ? prev : [...prev, { id: node.id, tag: node.tag!, kind: 'grandparent' as const }]
      );
      return;
    }
    // All nodes → open unified modal
    setSelectedNode(node);
    setClaimError(null);
    setEaError('');
    setEaSuccess('');
    setEaOpen(false);
  };

  const closeModal = () => { setSelectedNode(null); setClaimError(null); setEaError(''); setEaSuccess(''); setEaOpen(false); setEaLoginError(''); };

  const confirmClaim = async () => {
    if (!selectedNode) return;
    if (!getTokens()?.accessToken) {
      savePendingClaim({ slug, nodeId: selectedNode.id });
      router.push(`/register?tree=${encodeURIComponent(slug)}&node=${encodeURIComponent(selectedNode.id)}`);
      return;
    }
    setClaiming(true);
    setClaimError(null);
    try {
      await treeApi.claimNode(slug, selectedNode.id);
      const refreshed = await publicTreeApi.getFamily<Partial<TreeConfig>, Members>(slug, linkToken ?? undefined, getTokens()?.accessToken);
      setData(refreshed);
      closeModal();
    } catch (e: any) {
      setClaimError(e.message || 'Gagal mengklaim bagian ini');
    } finally {
      setClaiming(false);
    }
  };

  const handleEarlyAccess = async () => {
    if (!selectedNode) return;
    setEaError('');
    setEaSuccess('');
    if (!eaEmail || !eaPassword) { setEaError('Email dan password wajib diisi'); return; }
    if (eaPassword.length < 6) { setEaError('Password minimal 6 karakter'); return; }
    setEaLoading(true);
    try {
      const res = await treeApi.createEarlyAccessForNode(selectedNode.id, eaEmail, eaPassword, eaPhone || undefined);
      setEaSuccess(`Early access berhasil dibuat untuk ${res.user.email}`);
      const refreshed = await publicTreeApi.getFamily<Partial<TreeConfig>, Members>(slug, linkToken ?? undefined, getTokens()?.accessToken);
      setData(refreshed);
      setTimeout(() => closeModal(), 3000);
    } catch (e: any) {
      setEaError(e.message || 'Gagal membuat early access');
    } finally {
      setEaLoading(false);
    }
  };

  /**
   * Sign in as this node's early-access account. The super_user's own session
   * is replaced, so confirm first and send them straight to the profile form
   * they came to fill in.
   */
  const handleLoginEarlyAccess = async () => {
    if (!selectedNode) return;
    const tokens = getTokens();
    if (!tokens?.accessToken) { setEaLoginError('Sesi Anda berakhir, silakan masuk lagi'); return; }
    if (!confirm('Anda akan keluar dari akun Anda dan masuk sebagai anggota ini untuk melengkapi profilnya. Lanjutkan?')) return;
    setEaLoginError('');
    setEaLoginLoading(true);
    try {
      const res = await auth.loginAsEarlyAccess(tokens.accessToken, selectedNode.id, slug);
      saveTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      saveUser(res.user);
      router.push('/profile');
    } catch (e: any) {
      setEaLoginError(e.message || 'Gagal login early access');
    } finally {
      setEaLoginLoading(false);
    }
  };

  // Resolve member info for the selected node
  const selectedMember = selectedNode ? members[memberKeyFor(selectedNode.id)] : null;
  const selectedResolved = selectedNode ? resolve(selectedNode.id, selectedNode.name) : null;
  const isVerifiedNode = selectedNode && selectedNode.id !== 'self' && (selectedMember?.verified || selectedMember?.linkedUserId);
  const isSelfNode = selectedNode?.id === 'self';
  // A node the super_user issued temporary credentials for — they may sign in
  // as this person to complete their profile.
  const isEarlyAccessNode = !!(selectedMember?.earlyAccess && selectedMember?.linkedUserId);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#05050f' }}>
      {isLoggedIn ? (
        <ThemeProvider>
          <AuthProvider>
            <AppHeader />
          </AuthProvider>
        </ThemeProvider>
      ) : (
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <Link href="/">
            <Image src="/logo-white.svg" alt="Digsan" width={110} height={28} priority className="h-7 w-auto" />
          </Link>
          <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors">Masuk</Link>
        </header>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-white/50">
          <Loader2 className="animate-spin mr-2" size={20} /> Memuat silsilah…
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <Users size={40} className="text-white/25 mb-3" />
          <h1 className="text-white text-lg font-semibold mb-1">Akses terbatas</h1>
          <p className="text-white/40 text-sm mb-5 max-w-sm">{error}</p>
          <div className="flex gap-3">
            <Link href="/login" className="text-blue-400 hover:underline text-sm">Masuk</Link>
            <Link href="/" className="text-white/40 hover:text-white text-sm">Kembali ke beranda</Link>
          </div>
        </div>
      ) : data ? (
        <main className="flex-1 flex flex-col lg:flex-row relative">
          {/* Toggle button */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="fixed top-20 left-2 z-30 p-2 rounded-lg border border-white/10 bg-[#0a0a16]/90 backdrop-blur text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={sidebarOpen ? 'Sembunyikan info' : 'Tampilkan info'}
          >
            <PanelLeft size={18} />
          </button>

          {/* Left sidebar — cover + family info */}
          <aside
            className={`${
              sidebarOpen ? 'w-full lg:w-80 xl:w-96' : 'w-0'
            } shrink-0 overflow-hidden transition-all duration-300 border-r border-white/[0.06] bg-[#070712]`}
          >
            <div className="w-80 xl:w-96 h-full overflow-y-auto">
              {/* Cover image — 2:1 aspect ratio */}
              {data.coverImage ? (
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: '2 / 1' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={data.coverImage} alt="Cover" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#070712]" />
                </div>
              ) : (
                <div className="w-full bg-gradient-to-b from-white/[0.03] to-transparent" style={{ aspectRatio: '2 / 1' }} />
              )}

              {/* Family info — left aligned, no family image */}
              <div className="px-5 py-4 text-left space-y-3">
                <p className="text-blue-400/80 text-[10px] font-medium uppercase tracking-wider">Silsilah Keluarga</p>
                <h1
                  className="text-2xl font-bold text-white tracking-tight leading-tight"
                  style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
                >
                  {data.name}
                </h1>

                {data.headName && (
                  <p className="text-white/50 text-sm">
                    Kepala Keluarga: <span className="text-white/70 font-medium">{data.headName}</span>
                  </p>
                )}

                {data.familyBio && (
                  <p className="text-white/45 text-sm leading-relaxed">{data.familyBio}</p>
                )}

                {data.description && !data.familyBio && (
                  <p className="text-white/45 text-sm leading-relaxed">{data.description}</p>
                )}

                {/* Marriage info */}
                {data.marriageStatus && data.marriageStatus !== 'NONE' && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
                    {data.marriageDate && (
                      <span>
                        Pernikahan: {new Date(data.marriageDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                      {data.marriageStatus === 'ONGOING' ? 'Berlangsung' :
                       data.marriageStatus === 'DIVORCED' ? 'Cerai Hidup' :
                       data.marriageStatus === 'WIDOWED' ? 'Cerai Mati' : data.marriageStatus}
                    </span>
                  </div>
                )}

                {data.owner && (
                  <div className="flex items-center gap-2 text-white/60 text-sm pt-2 border-t border-white/[0.06]">
                    {data.owner.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={data.owner.avatar} alt={data.owner.name} referrerPolicy="no-referrer" className="w-6 h-6 rounded-full object-cover" />
                    ) : null}
                    <span>Dikelola oleh {data.owner.name}</span>
                    {data.owner.username && (
                      <Link href={`/id/${data.owner.username}`} className="inline-flex items-center gap-1 text-blue-400 hover:underline ml-auto">
                        Profil <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Ad banner 3:1 */}
              <div className="px-5 pb-3">
                <AdSpotBanner spotKey="family-sidebar-3-1" placeholder placeholderText="Slot Iklan 3:1" className="rounded-xl overflow-hidden" />
              </div>

              {/* CTA — Bagian dari keluarga ini? */}
              <div className="px-5 pb-5 pt-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left">
                  <h2 className="text-white font-semibold text-sm mb-1">Bagian dari keluarga ini?</h2>
                  <p className="text-white/45 text-xs mb-3 leading-relaxed">Gabung untuk melengkapi profil Anda dan menjaga silsilah tetap hidup.</p>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    Bergabung di digsan.id <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          {/* Right — tree + CTA */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Invited-member banner */}
            {highlightId && (
              <div className="px-6 pt-3 mb-1">
                <div className="max-w-md rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-center">
                  <p className="text-amber-200 text-sm">Anda diundang — bagian Anda ditandai <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 align-middle" /> pada silsilah di bawah.</p>
                </div>
              </div>
            )}

            {/* Tree */}
            <section className="px-2 sm:px-4 pb-8 flex-1">
              {viewMode === 'familynode' ? (
                <FamilyNodeTreeCanvas
                  nodes={familyNodeTree.nodes}
                  links={familyNodeTree.links}
                  onNodeClick={(fn) => {
                    if (fn.slug && fn.slug !== slug) {
                      router.push(`/family/${fn.slug}`);
                    }
                  }}
                  onBack={() => setViewMode('member')}
                  className="w-full h-[85vh] min-h-[480px] rounded-2xl border border-white/[0.06] bg-white/[0.01]"
                />
              ) : displayNodes.length ? (
                <PublicTreeCanvas
                  nodes={displayNodes}
                  lines={displayLines}
                  resolve={resolve}
                  onNodeClick={onNodeClick}
                  onGroupClick={(n) => {
                    // Sibling group bubbles → expand (push to stack)
                    if (n.id.startsWith('grp-self-saudara') || n.id.match(/^grp-spouse-\d+-saudara/)) {
                      if (n.tag) {
                        // Block if a different side already has active expansions
                        if (activeSide && getSide(n.id) !== activeSide) return;
                        setExpansionStack(prev =>
                          prev.some(e => e.id === n.id) ? prev : [...prev, { id: n.id, tag: n.tag!, kind: 'sibling' as const }]
                        );
                      }
                      return;
                    }
                    // Uncle group bubbles → expand (push to stack)
                    if (n.id.startsWith('grp-self-paman') || n.id.match(/^grp-spouse-\d+-paman/)) {
                      if (n.tag) {
                        if (activeSide && getSide(n.id) !== activeSide) return;
                        setExpansionStack(prev =>
                          prev.some(e => e.id === n.id) ? prev : [...prev, { id: n.id, tag: n.tag!, kind: 'uncle' as const }]
                        );
                      }
                      return;
                    }
                    if (n.id === 'grp-kb') {
                      setViewMode('familynode');
                    }
                  }}
                  highlightId={highlightId ?? undefined}
                  focusId="self"
                  className="w-full h-[85vh] min-h-[480px] rounded-2xl border border-white/[0.06] bg-white/[0.01]"
                  visibleTags={visibleTags}
                  onNodeHover={onNodeHover}
                  nodeOpacity={nodeOpacity}
                  lineOpacity={lineOpacity}
                  hoveredNodeId={hoverTarget}
                  closeButtons={closeButtons}
                  onCloseBranch={onCloseBranch}
                  onBackgroundClick={() => {
                    if (expansionStack.length === 0) {
                      setHoverTarget(null);
                      setHoverLevel('none');
                    }
                  }}
                />
              ) : (
                <div className="h-[480px] flex items-center justify-center text-white/40 text-sm">
                  Silsilah belum disiapkan.
                </div>
              )}
              {viewMode === 'familynode' ? (
                <p className="text-center text-white/25 text-xs mt-2">
                  Klik lingkaran untuk membuka halaman keluarga. Klik "Mode Familymember" untuk kembali.
                </p>
              ) : displayNodes.length ? (
                <p className="text-center text-white/25 text-xs mt-2">
                  Geser untuk menjelajah, gulir/pinch untuk memperbesar. Lingkaran bergaris putus-putus belum diklaim.
                </p>
              ) : null}
            </section>
          </div>
        </main>
      ) : null}

      <footer className="text-center pb-5 text-white/25 text-xs">
        © {new Date().getFullYear()} Digsan — Platform Keluarga Indonesia
      </footer>

      {/* Unified node modal — membercard for verified, claim+early access for unclaimed */}
      {selectedNode && selectedResolved && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0a16] p-6 text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              aria-label="Tutup"
              className="absolute top-3 right-3 text-white/40 hover:text-white/80 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Photo / avatar */}
            {selectedResolved.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedResolved.photo} alt={selectedResolved.name} referrerPolicy="no-referrer" className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-2 border-white/10" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3 border-2 border-white/10">
                <Users size={28} className="text-white/30" />
              </div>
            )}

            {/* View 1: Membercard for verified/active nodes */}
            {(isVerifiedNode || isSelfNode) && (
              <>
                {isVerifiedNode && (
                  <div className="inline-flex items-center gap-1 text-emerald-400 text-xs mb-1">
                    <BadgeCheck size={14} /> Terverifikasi
                  </div>
                )}
                <h3 className="text-white font-semibold text-lg mb-1">{selectedResolved.name}</h3>
                <p className="text-white/40 text-xs mb-3">{selectedResolved.statusLabel || selectedNode.role}</p>
                <div className="grid grid-cols-2 gap-2 text-left mb-4">
                  <div className="rounded-lg bg-white/5 px-3 py-2">
                    <p className="text-white/30 text-[10px] uppercase">Jenis Kelamin</p>
                    <p className="text-white/70 text-sm">{selectedResolved.gender === 'L' ? 'Laki-laki' : selectedResolved.gender === 'P' ? 'Perempuan' : '—'}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 px-3 py-2">
                    <p className="text-white/30 text-[10px] uppercase">Status</p>
                    <p className="text-white/70 text-sm">{selectedResolved.alive ? 'Hidup' : 'Meninggal'}</p>
                  </div>
                  {selectedMember?.email && (
                    <div className="rounded-lg bg-white/5 px-3 py-2 col-span-2">
                      <p className="text-white/30 text-[10px] uppercase">Email</p>
                      <p className="text-white/70 text-sm truncate">{selectedMember.email}</p>
                    </div>
                  )}
                  {selectedMember?.phone && (
                    <div className="rounded-lg bg-white/5 px-3 py-2 col-span-2">
                      <p className="text-white/30 text-[10px] uppercase">No. HP</p>
                      <p className="text-white/70 text-sm">{selectedMember.phone}</p>
                    </div>
                  )}
                </div>
                {isSelfNode && data?.owner?.username && (
                  <button
                    onClick={() => data?.owner?.username && router.push(`/id/${data.owner.username}`)}
                    className="w-full py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    Lihat Profil Lengkap
                  </button>
                )}

                {/* Early-access members get their own public profile page */}
                {!isSelfNode && selectedMember?.username && (
                  <button
                    onClick={() => router.push(`/id/${selectedMember.username}`)}
                    className="w-full py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    Lihat Profil Publik
                  </button>
                )}

                {/* Sign in as this member to complete their profile — super_user only */}
                {isSuperUser && isEarlyAccessNode && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    {eaLoginError && <p className="text-xs text-red-400 mb-2">{eaLoginError}</p>}
                    <button
                      onClick={handleLoginEarlyAccess}
                      disabled={eaLoginLoading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black transition-colors"
                    >
                      <LogIn size={15} />
                      {eaLoginLoading ? 'Masuk…' : 'Login Early Access'}
                    </button>
                    <p className="text-white/35 text-[11px] mt-2 leading-relaxed">
                      Anda akan masuk sebagai anggota ini untuk melengkapi profilnya. Sesi Anda saat ini akan digantikan.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* View 2: Claim + Early Access for unclaimed nodes */}
            {!isVerifiedNode && !isSelfNode && (
              <>
                <h3 className="text-white font-semibold text-lg mb-1">
                  Apakah ini <span className="text-blue-400">{selectedResolved.name}</span>?
                </h3>
                <p className="text-white/50 text-sm mb-5">
                  Jika ini Anda, hubungkan akun untuk melengkapi profil dan mengedit bagian silsilah ini.
                </p>
                {claimError && (
                  <p className="text-red-400 text-sm mb-3">{claimError}</p>
                )}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={confirmClaim}
                    disabled={claiming}
                    className="w-full py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white transition-colors"
                  >
                    {claiming ? 'Memproses…' : 'Ya, ini saya'}
                  </button>
                  <button
                    onClick={closeModal}
                    className="w-full py-2.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
                  >
                    Bukan saya
                  </button>
                </div>

                {/* Early Access — super_user only */}
                {isSuperUser && (
                  <div className="mt-4 pt-4 border-t border-white/10 text-left">
                    <button
                      type="button"
                      onClick={() => setEaOpen((v) => !v)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-2">
                        <KeyRound size={16} className="text-amber-400" />
                        <span className="text-sm font-medium text-amber-400">Buat Early Access</span>
                      </div>
                      <span className="text-amber-400 text-xs">{eaOpen ? '▲' : '▼'}</span>
                    </button>
                    {eaOpen && (
                      <div className="mt-3 space-y-2">
                        {eaError && <p className="text-xs text-red-400">{eaError}</p>}
                        {eaSuccess && <p className="text-xs text-emerald-400">{eaSuccess}</p>}
                        <input
                          type="email"
                          placeholder="Email"
                          value={eaEmail}
                          onChange={(e) => setEaEmail(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none border bg-white/5 border-white/15 text-white placeholder-white/30"
                        />
                        <input
                          type="password"
                          placeholder="Password (min. 6 karakter)"
                          value={eaPassword}
                          onChange={(e) => setEaPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none border bg-white/5 border-white/15 text-white placeholder-white/30"
                        />
                        <input
                          type="tel"
                          placeholder="No. HP (opsional)"
                          value={eaPhone}
                          onChange={(e) => setEaPhone(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none border bg-white/5 border-white/15 text-white placeholder-white/30"
                        />
                        <button
                          type="button"
                          onClick={handleEarlyAccess}
                          disabled={eaLoading}
                          className="w-full py-2 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
                        >
                          {eaLoading ? 'Membuat…' : 'Buat Early Access'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
