#!/usr/bin/env bash
# lane.test.sh - proves the atomic-claim invariants lane.sh exists to guarantee.
# Run: bash scripts/lane.test.sh   (uses a throwaway ledger; never touches the real one)
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
LANE="$HERE/lane.sh"
export CADENCE_LEDGER="$(mktemp -d)/ledger"
trap 'rm -rf "$(dirname "$CADENCE_LEDGER")"' EXIT

pass=0; fail=0
ok()   { echo "  ok   - $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL - $1"; fail=$((fail+1)); }

echo "lane.sh atomic-claim tests (ledger: $CADENCE_LEDGER)"
bash "$LANE" init >/dev/null

# 1) 12 lanes race for the SAME id -> exactly one wins.
echo "[1] concurrent same-id claim -> exactly one winner"
tmp="$(mktemp -d)"
for i in $(seq 1 12); do
  ( bash "$LANE" claim RACE-1 "$i" "src/lib/race-$i.ts" >/dev/null 2>&1; echo "$?" > "$tmp/$i" ) &
done
wait
wins=0; for i in $(seq 1 12); do [ "$(cat "$tmp/$i")" = "0" ] && wins=$((wins+1)); done
rm -rf "$tmp"
[ "$wins" = "1" ] && ok "exactly 1 of 12 concurrent claims won (got $wins)" || bad "expected 1 winner, got $wins"

# 2) disjoint globs -> both granted
echo "[2] disjoint file globs -> both granted"
bash "$LANE" release D-A >/dev/null 2>&1; bash "$LANE" release D-B >/dev/null 2>&1
bash "$LANE" claim D-A 1 "src/lib/incidents*.ts" >/dev/null;  ra=$?
bash "$LANE" claim D-B 2 "src/lib/knowledge-graph*.ts" >/dev/null; rb=$?
{ [ "$ra" = 0 ] && [ "$rb" = 0 ]; } && ok "two disjoint claims both granted" || bad "disjoint claims rejected (ra=$ra rb=$rb)"

# 3) overlapping globs across DIFFERENT items -> second rejected with conflict (exit 3)
echo "[3] overlapping globs across different items -> conflict"
bash "$LANE" claim OVL-1 1 "src/components/studio/**" >/dev/null; o1=$?
bash "$LANE" claim OVL-2 2 "src/components/studio/ChangesPanel.tsx" >/dev/null 2>&1; o2=$?
{ [ "$o1" = 0 ] && [ "$o2" = 3 ]; } && ok "overlapping second claim rejected (exit 3)" || bad "overlap not caught (o1=$o1 o2=$o2)"

# 4) release frees the item for re-claim
echo "[4] release -> re-claim succeeds"
bash "$LANE" claim REL 1 "src/lib/rel.ts" >/dev/null
bash "$LANE" release REL >/dev/null
bash "$LANE" claim REL 2 "src/lib/rel.ts" >/dev/null; rr=$?
[ "$rr" = 0 ] && ok "re-claim after release succeeded" || bad "re-claim failed (rr=$rr)"

# 5) reap removes a stale claim (force an old heartbeat)
echo "[5] reap removes stale claims"
bash "$LANE" claim STALE 1 "src/lib/stale.ts" >/dev/null
sed -i.bak 's/^beat=.*/beat=1/' "$CADENCE_LEDGER/claims/STALE/meta" && rm -f "$CADENCE_LEDGER/claims/STALE/meta.bak"
bash "$LANE" reap 6 >/dev/null
[ ! -d "$CADENCE_LEDGER/claims/STALE" ] && ok "stale claim reaped" || bad "stale claim survived reap"

# 6) a second claim on a held item reports HELD (exit 1), does not steal it
echo "[6] double-claim is rejected, holder preserved"
bash "$LANE" claim HOLD 1 "src/lib/hold.ts" >/dev/null
bash "$LANE" claim HOLD 2 "src/lib/hold-other.ts" >/dev/null 2>&1; hh=$?
holder="$(bash "$LANE" held HOLD)"
{ [ "$hh" = 1 ] && echo "$holder" | grep -q "lane=1"; } && ok "held item not stolen (still lane 1)" || bad "double-claim mishandled (hh=$hh holder='$holder')"

# 7) pinned reservations survive reap (legacy-lane area reservations must not expire)
echo "[7] pinned reservation survives reap"
bash "$LANE" release D-B >/dev/null 2>&1   # free the earlier knowledge-graph claim so the pin can land
bash "$LANE" pin LANE2-AREA 2 "src/lib/knowledge-graph*,src/lib/rag/*" "legacy area" >/dev/null
sed -i.bak 's/^beat=.*/beat=1/' "$CADENCE_LEDGER/claims/LANE2-AREA/meta" && rm -f "$CADENCE_LEDGER/claims/LANE2-AREA/meta.bak"
bash "$LANE" reap 6 >/dev/null
[ -d "$CADENCE_LEDGER/claims/LANE2-AREA" ] && ok "pinned reservation survived reap" || bad "pinned reservation was reaped"

# 8) a pinned area still blocks an overlapping claim from another lane
echo "[8] pinned area blocks overlapping claim"
bash "$LANE" claim SOME-KG 3 "src/lib/knowledge-graph-drift.functions.ts" >/dev/null 2>&1; kk=$?
[ "$kk" = 3 ] && ok "overlapping claim against pinned area rejected (exit 3)" || bad "pinned area did not block overlap (kk=$kk)"

# 9) lane-aware: a lane's own pinned area does NOT block that lane's own per-item claim,
#    but DOES block another lane's overlapping claim.
echo "[9] lane-aware overlap (own area allows self, blocks others)"
bash "$LANE" pin L1-AREA 1 "src/lib/cockpit/**" "area" >/dev/null
bash "$LANE" claim L1-ITEM 1 "src/lib/cockpit/incidents.ts" >/dev/null 2>&1; self=$?   # same lane -> allowed
bash "$LANE" claim L3-ITEM 3 "src/lib/cockpit/incidents.ts" >/dev/null 2>&1; cross=$?   # other lane -> blocked
{ [ "$self" = 0 ] && [ "$cross" = 3 ]; } && ok "same-lane claim allowed ($self), cross-lane blocked ($cross)" || bad "lane-aware overlap wrong (self=$self cross=$cross)"

echo
echo "RESULT: $pass passed, $fail failed"
[ "$fail" = 0 ]
