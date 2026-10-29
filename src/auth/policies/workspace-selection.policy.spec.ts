import { WorkspaceRole } from '../../members/enums/workspace-role.enum';
import type { Membership } from '../../members/interfaces/membership.interface';
import { WorkspaceSelectionPolicy } from './workspace-selection.policy';

const A: Membership = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  role: WorkspaceRole.COACH,
  isOwner: true,
};
const B: Membership = {
  workspaceId: '22222222-2222-4222-8222-222222222222',
  role: WorkspaceRole.ASSISTANT,
  isOwner: false,
};
const STRANGER = '33333333-3333-4333-8333-333333333333';

describe('WorkspaceSelectionPolicy', () => {
  const policy = new WorkspaceSelectionPolicy();

  describe('when no workspace was asked for', () => {
    it.each([
      ['has no memberships', [], { outcome: 'none' }],
      ['has one membership', [A], { outcome: 'selected', membership: A }],
      ['has several memberships', [A, B], { outcome: 'must_choose' }],
    ] as const)('a person who %s', (_label, memberships, expected) => {
      expect(policy.select([...memberships], undefined)).toEqual(expected);
    });

    it('treats an empty value as not asked', () => {
      expect(policy.select([A], '')).toEqual({
        outcome: 'selected',
        membership: A,
      });
    });
  });

  describe('when a workspace was asked for', () => {
    it('selects it among several', () => {
      expect(policy.select([A, B], B.workspaceId)).toEqual({
        outcome: 'selected',
        membership: B,
      });
    });

    it('accepts the id in any letter case', () => {
      expect(policy.select([A], A.workspaceId.toUpperCase())).toEqual({
        outcome: 'selected',
        membership: A,
      });
    });

    it.each([
      ['a workspace the person is not a member of', [A, B], STRANGER],
      ['a workspace when the person has none', [], STRANGER],
      ['a value that is not an id', [A], "' or 1=1 --"],
    ] as const)('refuses %s', (_label, memberships, requested) => {
      expect(policy.select([...memberships], requested)).toEqual({
        outcome: 'forbidden',
      });
    });
  });
});
