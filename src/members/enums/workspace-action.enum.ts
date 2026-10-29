/**
 * What a request can ask to do inside a workspace. Every route that works on a workspace names
 * one with `@RequireAction`, and `WorkspacePermissionPolicy` decides who may.
 */
export enum WorkspaceAction {
  /** Anything a member may do: the home numbers, the package list, their own profile. */
  MEMBER = 'member',
  CLIENTS_READ = 'clients_read',
  CLIENTS_WRITE = 'clients_write',
  SUBSCRIPTIONS_READ = 'subscriptions_read',
  SUBSCRIPTIONS_WRITE = 'subscriptions_write',
  PAYMENTS_READ = 'payments_read',
  PAYMENTS_WRITE = 'payments_write',
  CHECKIN_SCHEDULES_MANAGE = 'checkin_schedules_manage',
  /** What clients handed in about their bodies: intake answers, check-in answers, progress. */
  HEALTH_DATA_READ = 'health_data_read',
  COACHING_READ = 'coaching_read',
  /** Plans, meal plans, forms, the exercise and food libraries, answering check-ins. */
  COACHING_WRITE = 'coaching_write',
  PACKAGES_WRITE = 'packages_write',
  WORKSPACE_SETTINGS = 'workspace_settings',
  BUSINESS_ANALYTICS = 'business_analytics',
  BILLING = 'billing',
  TEAM_MANAGE = 'team_manage',
}
