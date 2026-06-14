# Posting ops: how automated daily posting works

The founder wants daily posts to go out automatically, with no daily intervention. This is the setup: the honest constraints, the recommended model, and the exact steps for each route.

Accounts:

- X: https://x.com/rohit_gajaraj (`@rohit_gajaraj`)
- LinkedIn: https://www.linkedin.com/in/rohit-gajaraj/

## Two real constraints (so the automation stays honest)

1. **Something has to run the job daily.** I am not an always-on service. Daily posting needs either a scheduler (Buffer, Typefully) or a cron in infrastructure we control. The repo already runs Cloudflare Worker crons (`resume-runs`, `outcome-tick`), so the second path fits cleanly.
2. **A public post is irreversible.** Posting under the founder's name with zero review is a real brand risk: a wrong or off-key post cannot be unsent. So the recommended model keeps a cheap safety valve without asking for daily attention.

## Recommended model: approve a batch, auto-post daily

- I generate a week of posts at a time into [`drafts/`](./drafts/).
- The founder skims and approves the batch once (about 5 minutes a week), flipping each `status` to `approved`. He can edit or kill any.
- A daily job posts the next `approved` draft (one X, one LinkedIn) on schedule and flips it to `posted`.
- Net result: zero daily intervention, one short weekly review, and nothing off-brand goes out unseen.

If the founder wants truly zero review ever, the same job can auto-generate and post without the weekly skim. Flagged honestly: that removes the only check between a bad draft and his public name. Available on request; not the default.

## Route 1: scheduler (fastest, both platforms, least engineering)

Best if the goal is "just works" with minimal moving parts. Buffer posts to personal X and personal LinkedIn (it has done the API integration both platforms restrict).

Founder steps:

1. Sign up at buffer.com (the free plan covers a few channels).
2. Connect channels: add X (`@rohit_gajaraj`) and LinkedIn (the personal profile `rohit-gajaraj`).
3. Set a daily posting schedule (for example 9:00 am local for X, 8:00 am for LinkedIn).
4. Optional, for full auto-fill: create a Buffer API access token (Buffer settings, developers) and share it with me. With it I push approved drafts straight into the queue; without it, you paste the approved drafts in once a week.

What I do: draft to `drafts/`, and with the token push approved posts into the Buffer queue automatically.

Alternative: Typefully (strong for X, good editor) plus a LinkedIn-capable tool. Buffer is the single-tool path for both.

## Route 2: self-hosted cron (most control, free, fits the repo)

Best if we want to own the pipeline and avoid a third party. A daily Cloudflare Worker cron (mirroring `resume-runs` / `outcome-tick`) reads the next approved draft and posts to both platforms.

X setup (founder):

1. Apply for a developer account at developer.x.com (the Free tier allows writing posts; 1 to 2 a day is well within the limits).
2. Create a Project and an App.
3. In the App's user-authentication settings, enable OAuth 1.0a with Read and Write.
4. Generate the four credentials: API Key, API Secret, Access Token, Access Token Secret (the token must carry Read and Write).
5. Share the four values; I store them as `wrangler` secrets, never in the client bundle and never committed, matching the repo's secret rules.

LinkedIn setup (founder):

1. Create an app at developer.linkedin.com, associated with a company page (LinkedIn requires one even for personal posting).
2. Request the "Share on LinkedIn" product to get the `w_member_social` scope.
3. Authorize once to mint a member access token for the profile.
4. Share the token; I store it as a secret.
   Honest flag: LinkedIn's personal-posting API can require app review and is the slower, fussier half. If it stalls, we use Buffer for LinkedIn and the cron for X.

What I build: a `post-daily` Worker cron plus a small posting module that reads `drafts/`, posts the next approved item, and flips its status to `posted`.

## Security and control

- I never take raw passwords. Only scoped API tokens or OAuth, which the founder can revoke at any time from X or LinkedIn settings.
- Tokens live in `wrangler` secrets or the scheduler's vault, never in the client bundle and never committed (the repo's env-split rule).
- The founder can pause the whole system at any moment by revoking a token or emptying the queue.

## Recommendation

Start with Route 1 (Buffer) for speed: connect both accounts, give me the API token, and we are live this week on the batch-approve model. Move to Route 2 (self-hosted cron) later if we want to drop the third party. LinkedIn automation is the one genuinely fussy piece, and Buffer is the path of least resistance for it.

## Live status (2026-06-15)

Route 1 (Buffer) is live. The Buffer MCP is connected for the org "My Organization" (`rohit.gajaraj@gmail.com`), so I push approved drafts straight into Buffer; no weekly paste needed.

Connected channels: X (`rohit_gajaraj`), LinkedIn (`rohit-gajaraj`), Threads (`rohit_gajaraj`). Free plan: 3 channels (full), 10 scheduled posts, 100 ideas. Bluesky is not connected (the 3-channel slot is taken).

Two Buffer realities we hit, and how the model adapts:

- **No per-post "notification" approval for X or LinkedIn.** Buffer only offers automatic publishing for these direct-publish channels, so the "ping me to confirm each" mode is not available as such. The faithful equivalent is the draft-then-approve gate: I push each item as a Buffer draft pre-set to its time; it stays a draft until the founder taps approve in the Buffer Drafts tab, then auto-posts at the set time. Nothing publishes unseen. If the founder later wants zero taps, switch the push from `saveToDraft` to a live automatic schedule.
- **X enforces 280 characters via the API.** Long X posts are pushed as threads, split at the draft's own paragraph breaks with no word changes. LinkedIn has no such limit and goes up as single posts.

Two things still need a manual hand each week: polls (Buffer's API has no poll field) and the Substack newsletter (published on its own). The Threads mirror is selective by design; mirror the strongest one or two pieces rather than the whole week, to keep the 10-post queue free.

Week one (2026-06-15 to 2026-06-21) is staged: 9 feed drafts in Buffer awaiting approval. Ledger with draft ids: [`drafts/week-2026-06-15.md`](./drafts/week-2026-06-15.md) "Staged to Buffer".
