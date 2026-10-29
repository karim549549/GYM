import { WorkspaceAction } from '../enums/workspace-action.enum';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import { WorkspacePermissionPolicy } from './workspace-permission.policy';

const policy = new WorkspacePermissionPolicy();
const can = (
  who: { role?: WorkspaceRole; isOwner?: boolean },
  action: WorkspaceAction,
) => policy.can(who, action).outcome === 'allowed';

const owner = { role: WorkspaceRole.COACH, isOwner: true };
const coach = { role: WorkspaceRole.COACH, isOwner: false };
const assistant = { role: WorkspaceRole.ASSISTANT, isOwner: false };

const OWNER_ONLY = [
  WorkspaceAction.TEAM_MANAGE,
  WorkspaceAction.BILLING,
  WorkspaceAction.WORKSPACE_SETTINGS,
  WorkspaceAction.BUSINESS_ANALYTICS,
];
const ASSISTANT_MAY = [
  WorkspaceAction.MEMBER,
  WorkspaceAction.CLIENTS_READ,
  WorkspaceAction.CLIENTS_WRITE,
  WorkspaceAction.SUBSCRIPTIONS_READ,
  WorkspaceAction.SUBSCRIPTIONS_WRITE,
  WorkspaceAction.PAYMENTS_READ,
  WorkspaceAction.PAYMENTS_WRITE,
  WorkspaceAction.CHECKIN_SCHEDULES_MANAGE,
];

describe('WorkspacePermissionPolicy', () => {
  it.each(Object.values(WorkspaceAction))('lets the owner %s', (action) => {
    expect(can(owner, action)).toBe(true);
  });

  it.each(
    Object.values(WorkspaceAction).filter((a) => !OWNER_ONLY.includes(a)),
  )('lets a coach who is not the owner %s', (action) => {
    expect(can(coach, action)).toBe(true);
  });

  it.each(OWNER_ONLY)('keeps %s to the owner', (action) => {
    expect(can(coach, action)).toBe(false);
    expect(can(assistant, action)).toBe(false);
  });

  it.each(ASSISTANT_MAY)('lets an assistant %s', (action) => {
    expect(can(assistant, action)).toBe(true);
  });

  it.each(
    Object.values(WorkspaceAction).filter((a) => !ASSISTANT_MAY.includes(a)),
  )('does not let an assistant %s', (action) => {
    expect(can(assistant, action)).toBe(false);
  });

  it('keeps health data and coaching away from an assistant', () => {
    expect(can(assistant, WorkspaceAction.HEALTH_DATA_READ)).toBe(false);
    expect(can(assistant, WorkspaceAction.COACHING_WRITE)).toBe(false);
  });

  it('refuses someone with no role at all, so a missing fact never opens a door', () => {
    expect(can({}, WorkspaceAction.CLIENTS_READ)).toBe(false);
    expect(can({}, WorkspaceAction.MEMBER)).toBe(false);
  });

  it('judges an owner by ownership even if the role were an assistant', () => {
    expect(
      can(
        { role: WorkspaceRole.ASSISTANT, isOwner: true },
        WorkspaceAction.BILLING,
      ),
    ).toBe(true);
  });
});
