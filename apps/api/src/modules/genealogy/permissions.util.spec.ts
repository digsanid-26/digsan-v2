import { approversFor, decide, type PersonContext } from './permissions.util';

const base: PersonContext = {
  personId: 'p', accountUserId: null, accountStatus: null, accountCreatedById: null, vitalStatus: 'LIVING',
  mergedIntoId: null, stewards: [], actorHasConsent: false, inActorFamily: false,
};
const me = { userId: 'me', roles: [] as string[] };
const admin = { userId: 'adm', roles: ['admin'] };

describe('authority matrix (F2-01)', () => {
  it('a person with an active account owns their profile', () => {
    const p = { ...base, accountUserId: 'mother', accountStatus: 'ACTIVE' };
    expect(decide({ userId: 'mother', roles: [] }, 'person.edit', p).decision).toBe('DIRECT');
    expect(decide(me, 'person.edit', { ...p, inActorFamily: true }).decision).toBe('PROPOSAL');
    expect(decide(me, 'person.edit', p).decision).toBe('DENY');
    expect(decide(me, 'person.edit', { ...p, actorHasConsent: true }).decision).toBe('DIRECT');
    expect(decide(me, 'merge.decide', { ...p, inActorFamily: true, stewards: [{ userId: 'me', role: 'CO_STEWARD' }] }).decision).toBe('DENY');
    expect(approversFor(p)).toEqual(['mother']);
  });

  it('an early-access account is managed by the guardian who created it', () => {
    const p = { ...base, accountUserId: 'baby', accountStatus: 'EARLY_ACCESS', accountCreatedById: 'me' };
    expect(decide(me, 'person.edit', p).decision).toBe('DIRECT');
    expect(decide(me, 'person.manageStewards', p).decision).toBe('DIRECT');
    expect(decide({ userId: 'aunt', roles: [] }, 'person.edit', { ...p, inActorFamily: true }).decision).toBe('PROPOSAL');
    expect(approversFor(p)).toEqual(['me']);
  });

  it('a person without account is managed by stewards; relatives may only propose', () => {
    const p = { ...base, stewards: [{ userId: 'adi', role: 'PRIMARY' as const }, { userId: 'budi', role: 'CO_STEWARD' as const }] };
    expect(decide({ userId: 'adi', roles: [] }, 'person.edit', p).decision).toBe('DIRECT');
    expect(decide({ userId: 'budi', roles: [] }, 'person.edit', p).decision).toBe('DIRECT');
    expect(decide({ userId: 'budi', roles: [] }, 'person.manageStewards', p).decision).toBe('DENY');
    expect(decide({ userId: 'adi', roles: [] }, 'person.manageStewards', p).decision).toBe('DIRECT');
    expect(decide({ userId: 'citra', roles: [] }, 'person.edit', { ...p, inActorFamily: true }).decision).toBe('PROPOSAL');
    expect(decide({ userId: 'stranger', roles: [] }, 'person.edit', p).decision).toBe('DENY');
    expect(approversFor(p).sort()).toEqual(['adi', 'budi']);
  });

  it('admins may edit (audited) but never decide merges for others', () => {
    const p = { ...base, stewards: [{ userId: 'adi', role: 'PRIMARY' as const }] };
    expect(decide(admin, 'person.edit', p).decision).toBe('DIRECT');
    expect(decide(admin, 'merge.decide', p).decision).toBe('DENY');
  });

  it('nothing may be done to a merged tombstone', () => {
    const p = { ...base, mergedIntoId: 'other', stewards: [{ userId: 'me', role: 'PRIMARY' as const }] };
    expect(decide(me, 'person.edit', p).decision).toBe('DENY');
  });
});
