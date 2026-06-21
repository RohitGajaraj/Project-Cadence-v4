-- WM-M14: let an account OWNER set per-product / per-member spend caps.
-- credit_caps already has a members-read policy + the runtime enforcement
-- (assertCreditCaps) + the pure cap math; the owner WRITE path was deferred. This adds
-- it: only the account owner can create/update/delete caps for their account. Reads stay
-- open to members (the existing policy). Caps are inert until credits_enabled() is on.
drop policy if exists "account owner writes caps" on public.credit_caps;
create policy "account owner writes caps" on public.credit_caps
  for all to authenticated
  using (
    exists (select 1 from public.accounts a where a.id = credit_caps.account_id and a.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.accounts a where a.id = credit_caps.account_id and a.owner_id = auth.uid())
  );
