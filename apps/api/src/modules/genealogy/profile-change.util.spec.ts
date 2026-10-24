import { changesFrom, editedFields, snapshotOf, staleFields, toLayoutPatch, toPersonData } from './profile-change.util';

const person = { displayName: 'Bapak Slamet', sex: 'MALE', vitalStatus: 'LIVING', photo: null, isPlaceholder: false };

describe('profile changes (F2-02)', () => {
  it('a lagging circle is not a change: only edits since the snapshot count', () => {
    const draft = { ...person, displayName: 'Pak Slamet' };
    // Budi has always written "Pak Slamet" → nothing to propose.
    expect(editedFields(draft, person, snapshotOf(draft), false)).toEqual({});
    // Budi now marks him deceased → only that is proposed.
    const edited = { ...draft, vitalStatus: 'DECEASED' };
    expect(editedFields(edited, person, snapshotOf(draft), false)).toEqual({ vitalStatus: { from: 'LIVING', to: 'DECEASED' } });
  });

  it('without a snapshot, only the sole view of a person counts as editing it', () => {
    const draft = { ...person, displayName: 'Slamet' };
    expect(editedFields(draft, person, null, true)).toEqual({ displayName: { from: 'Bapak Slamet', to: 'Slamet' } });
    expect(editedFields(draft, person, null, false)).toEqual({});
  });

  it('ignores placeholders, cleared photos and unknown sex', () => {
    expect(editedFields({ ...person, displayName: 'Ayah', isPlaceholder: true }, person, snapshotOf(person), true)).toEqual({});
    const withPhoto = { ...person, photo: 'a.jpg' };
    expect(editedFields({ ...withPhoto, photo: null, sex: 'UNKNOWN' }, withPhoto, snapshotOf(withPhoto), true)).toEqual({});
  });

  it('maps person values onto a layout circle', () => {
    expect(toLayoutPatch({ displayName: 'X', sex: 'FEMALE', vitalStatus: 'DECEASED' })).toEqual({ name: 'X', gender: 'P', alive: false });
  });

  it('validates API input and detects stale proposals', () => {
    const p = { ...person, birthDate: new Date('1950-01-01T00:00:00.000Z') };
    const c = changesFrom({ displayName: '  Slamet  ', sex: 'X', birthDate: '1951-02-03', foo: 1 }, p);
    expect(c).toEqual({
      displayName: { from: 'Bapak Slamet', to: 'Slamet' },
      birthDate: { from: '1950-01-01T00:00:00.000Z', to: '1951-02-03T00:00:00.000Z' },
    });
    expect(toPersonData(c)).toMatchObject({ displayName: 'Slamet', birthDate: new Date('1951-02-03'), isPlaceholder: false });
    expect(staleFields(c, p)).toEqual([]);
    expect(staleFields(c, { ...p, displayName: 'Mbah Slamet' })).toEqual(['displayName']);
  });
});
