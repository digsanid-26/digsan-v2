import { describeParentage, describeUnion, evaluateRelation } from './relation-status.util';

const none = new Set<string>();
const noDecisions = new Map<string, boolean>();

describe('two-way relation confirmation (F2-03)', () => {
  it('relations between people without accounts are confirmed at once', () => {
    expect(evaluateRelation([{ personId: 'f', approvers: [] }, { personId: 'c', approvers: [] }], new Set(['adi']), noDecisions))
      .toEqual({ status: 'CONFIRMED', pending: [] });
  });

  it("drawing someone else's account keeps the relation proposed until they agree", () => {
    const ends = [{ personId: 'father', approvers: [] }, { personId: 'budi', approvers: ['budi'] }];
    expect(evaluateRelation(ends, new Set(['adi']), noDecisions)).toEqual({ status: 'PROPOSED', pending: ['budi'] });
    expect(evaluateRelation(ends, new Set(['adi']), new Map([['budi', true]])).status).toBe('CONFIRMED');
    // Budi drawing the same father in his own tree also confirms it.
    expect(evaluateRelation(ends, new Set(['adi', 'budi']), noDecisions).status).toBe('CONFIRMED');
  });

  it('a rejection wins, unless that person later draws the relation themselves', () => {
    const ends = [{ personId: 'x', approvers: ['budi'] }, { personId: 'y', approvers: ['citra'] }];
    expect(evaluateRelation(ends, none, new Map([['budi', true], ['citra', false]])).status).toBe('REJECTED');
    expect(evaluateRelation(ends, new Set(['citra']), new Map([['budi', true], ['citra', false]])).status).toBe('CONFIRMED');
  });

  it('your own relations (you are an end) need nobody else', () => {
    const ends = [{ personId: 'adi', approvers: ['adi'] }, { personId: 'father', approvers: [] }];
    expect(evaluateRelation(ends, new Set(['adi']), noDecisions).status).toBe('CONFIRMED');
  });

  it('describes the relation from the confirmer’s point of view', () => {
    expect(describeParentage({ name: 'Slamet', sex: 'MALE', isMe: false }, { name: 'Budi', isMe: true })).toBe('Slamet adalah ayah Anda');
    expect(describeParentage({ name: 'Budi', sex: 'MALE', isMe: true }, { name: 'Raka', isMe: false })).toBe('Raka adalah anak Anda');
    expect(describeUnion({ name: 'Budi', isMe: true }, { name: 'Sari', isMe: false })).toBe('Sari adalah pasangan Anda');
  });
});
