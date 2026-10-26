/**
 * The platform owner's account is silently added as an ACCEPTED collaborator
 * with every permission on each new campaign (src/app/api/projects/route.ts),
 * so support can get into any creator's dashboard without being invited.
 *
 * That shadow seat must stay invisible: it is hidden from the team list, and
 * it must never be treated as a real team member for notifications. Before
 * this constant existed the new-message notifier fanned out to every
 * community-rights collaborator and mailed the owner about every backer
 * message on the platform.
 */
export const PLATFORM_OWNER_EMAIL = "mikeisflux@indiecrowdfund.com";

export function isPlatformOwnerEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === PLATFORM_OWNER_EMAIL;
}
