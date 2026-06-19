-- WM-M12: the atomic credit-debit RPC that fills the WM-M4 seam.
--
-- Spec: docs/planning/workspace-tenancy-and-monetization-plan.md (WM-M12).
-- A real managed AI call meters the account pool through this function: it draws the
-- call's credits down INCLUDED-first, then TOP-UP, in a single locked transaction, and
-- writes the matching credit_ledger debit (tagged user / surface / ai_event / product).
-- The whole credit engine stays dormant behind credits_enabled() until the founder
-- flips it; this function only runs when runtime.server.ts calls it (gated by that flag).
--
-- Idempotent: CREATE OR REPLACE. Depends on the WM-M2 account_credits + credit_ledger
-- tables. Service-role only by construction (the credit tables have no write policy);
-- SECURITY DEFINER + a row lock make the draw-down atomic and race-safe.

create or replace function public.debit_account_credits(
  _account_id uuid,
  _credits bigint,
  _user_id uuid,
  _surface text,
  _ai_event_id uuid,
  _product_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_included bigint;
  v_topup bigint;
  v_from_included bigint;
  v_from_topup bigint;
begin
  if _credits is null or _credits <= 0 then
    return;
  end if;

  -- Lock the pool row so concurrent debits cannot race the draw-down.
  select balance_credits, topup_credits
    into v_included, v_topup
  from public.account_credits
  where account_id = _account_id
  for update;
  if not found then
    return;
  end if;

  -- Draw INCLUDED first, then TOP-UP. Never spend more than is available (floor at 0);
  -- the pre-call assert is what prevents an overdraw, but be defensive here too.
  v_from_included := least(_credits, greatest(coalesce(v_included, 0), 0));
  v_from_topup := least(_credits - v_from_included, greatest(coalesce(v_topup, 0), 0));

  if v_from_included = 0 and v_from_topup = 0 then
    return;
  end if;

  update public.account_credits
     set balance_credits = coalesce(balance_credits, 0) - v_from_included,
         topup_credits = coalesce(topup_credits, 0) - v_from_topup
   where account_id = _account_id;

  insert into public.credit_ledger
    (account_id, user_id, delta_credits, reason, surface, ai_event_id, product_id)
  values
    (_account_id, _user_id, -(v_from_included + v_from_topup), 'debit', _surface, _ai_event_id, _product_id);
end;
$$;
