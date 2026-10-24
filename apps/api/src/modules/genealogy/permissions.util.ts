/**
 * F2-01 — the authority matrix (docs/tasklist-perbaikan.md §3.3) as ONE pure
 * function. Every place that decides "may this user change this person?"
 * asks `decide()` instead of re-implementing role checks.
 *
 * Outcomes:
 *  - DIRECT   : may change it now (audited)
 *  - PROPOSAL : may suggest a change; someone with DIRECT must approve
 *  - DENY     : not allowed
 */

export type Decision = 'DIRECT' | 'PROPOSAL' | 'DENY';

export type Action =
  | 'person.edit'            // profile fields (name, dates, photo, …)
  | 'person.manageStewards'  // appoint/remove co-stewards (wali bersama)
  | 'merge.decide'           // approve/reject merging this person with another
  | 'relation.confirm';      // confirm a relationship touching this person

export type StewardRoleT = 'OWNER' | 'PRIMARY' | 'CO_STEWARD' | 'GUARDIAN';

export interface Actor {
  userId: string;
  roles: string[];
}

export interface PersonContext {
  personId: string;
  /** Account that claimed this person, if any. */
  accountUserId: string | null;
  /** Status of that account (ACTIVE, EARLY_ACCESS, …). */
  accountStatus: string | null;
  /** Who created the early-access account (its guardian). */
  accountCreatedById: string | null;
  vitalStatus: 'LIVING' | 'DECEASED' | 'UNKNOWN';
  mergedIntoId: string | null;
  stewards: { userId: string; role: StewardRoleT }[];
  /** The actor holds a GRANTED guardian consent from this person's account. */
  actorHasConsent: boolean;
  /** The person lies within the actor's family neighbourhood. */
  inActorFamily: boolean;
}

export interface PermissionResult {
  decision: Decision;
  reason: string;
}

const ADMIN = ['admin', 'super_admin'];
const allow = (reason: string): PermissionResult => ({ decision: 'DIRECT', reason });
const propose = (reason: string): PermissionResult => ({ decision: 'PROPOSAL', reason });
const deny = (reason: string): PermissionResult => ({ decision: 'DENY', reason });

export function decide(actor: Actor, action: Action, p: PersonContext): PermissionResult {
  if (p.mergedIntoId) return deny('Data ini sudah digabung ke orang lain');
  const isAdmin = actor.roles.some((r) => ADMIN.includes(r));
  const stewardRole = p.stewards.find((s) => s.userId === actor.userId)?.role ?? null;
  const isSelf = !!p.accountUserId && p.accountUserId === actor.userId;
  const hasActiveAccount = !!p.accountUserId && p.accountStatus !== 'EARLY_ACCESS';
  const isGuardianOfEarlyAccess = p.accountStatus === 'EARLY_ACCESS' && p.accountCreatedById === actor.userId;

  switch (action) {
    case 'person.edit': {
      if (isSelf) return allow('Data diri sendiri');
      if (hasActiveAccount) {
        // A person with an active account owns their profile.
        if (p.actorHasConsent) return allow('Izin wali dari pemilik akun');
        if (isAdmin) return allow('Admin platform');
        return p.inActorFamily ? propose('Pemilik akun yang menyetujui perubahan') : deny('Bukan anggota keluarga');
      }
      if (isGuardianOfEarlyAccess) return allow('Wali akun early access');
      if (p.accountUserId) {
        // Early-access account managed by someone else.
        if (isAdmin) return allow('Admin platform');
        return p.inActorFamily ? propose('Wali akun early access yang menyetujui') : deny('Bukan anggota keluarga');
      }
      // No account: stewards manage it (for the deceased, every steward).
      if (stewardRole) return allow(p.vitalStatus === 'DECEASED' ? 'Pengelola almarhum/almarhumah' : 'Pengelola data');
      if (isAdmin) return allow('Admin platform');
      return p.inActorFamily ? propose('Pengelola data yang menyetujui perubahan') : deny('Bukan anggota keluarga');
    }

    case 'person.manageStewards': {
      if (isSelf) return allow('Data diri sendiri');
      if (hasActiveAccount) return isAdmin ? allow('Admin platform') : deny('Hanya pemilik akun');
      if (isGuardianOfEarlyAccess) return allow('Wali akun early access');
      if (stewardRole === 'PRIMARY' || stewardRole === 'OWNER' || stewardRole === 'GUARDIAN') return allow('Pengelola utama');
      return isAdmin ? allow('Admin platform') : deny('Hanya pengelola utama');
    }

    case 'merge.decide':
    case 'relation.confirm': {
      if (isSelf) return allow('Data diri sendiri');
      if (hasActiveAccount) return deny('Hanya pemilik akun');
      if (isGuardianOfEarlyAccess) return allow('Wali akun early access');
      if (stewardRole) return allow('Pengelola data');
      return deny('Bukan pengelola orang ini');
    }
  }
}

/**
 * Who must approve a decision on a person: the account itself, the
 * early-access guardian, or (no account) every steward.
 */
export function approversFor(p: PersonContext): string[] {
  if (p.accountUserId && p.accountStatus !== 'EARLY_ACCESS') return [p.accountUserId];
  if (p.accountUserId && p.accountCreatedById) return [p.accountCreatedById];
  return [...new Set(p.stewards.map((s) => s.userId))];
}
