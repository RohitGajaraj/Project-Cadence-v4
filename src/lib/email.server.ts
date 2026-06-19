/**
 * Pluggable transactional email (server-only).
 *
 * WM-F5: sending invite emails requires an outbound email provider, which is founder-gated
 * (no provider/secret is wired, and outbound sending is on the founder pickup list). So this
 * is a graceful no-op that ALWAYS returns the copy-paste link: invites work end-to-end without
 * email (the inviter shares the link), and when a provider is added the send is wired here and
 * `sent` flips to true. Keeping the seam here means callers never branch on whether email exists.
 */

export type InviteEmail = {
  to: string;
  inviteLink: string;
  workspaceName?: string;
};

export type EmailResult = { sent: boolean; link: string };

/**
 * Send a workspace-invite email. Currently a no-op (no provider wired) that returns the link
 * so the caller can surface it for copy-paste. Never throws — a delivery failure must never
 * block creating the invitation.
 */
export async function sendInviteEmail(args: InviteEmail): Promise<EmailResult> {
  // No provider configured (founder-gated). Return the link; the inviter shares it manually.
  // When an email provider is wired, send here and return { sent: true, link }.
  return { sent: false, link: args.inviteLink };
}
