/**
 * What a member does in a workspace. Whether they own it is a separate fact
 * (`isOwner`): a freelance coach is an owner who coaches. The database check
 * constraint is built from this list.
 */
export enum WorkspaceRole {
  COACH = 'coach',
  ASSISTANT = 'assistant',
}
