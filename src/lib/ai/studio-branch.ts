/**
 * I3: collision-safe working-branch name for a Studio changeset.
 *
 * The Studio engine isolates each mission's edits on its own `studio/*` branch
 * (no local checkout; everything goes through the GitHub Git Data API). The
 * earlier fallback name was `studio/${missionId.slice(0, 8)}`, which truncated
 * the mission UUID to 32 bits: two concurrent missions whose UUIDs shared a
 * leading hex prefix would compute the SAME branch and silently build on each
 * other's head (the per-path `builder_file_claims` guard only catches same-FILE
 * collisions, not two missions sharing a branch with different files).
 *
 * Binding the branch to the changeset's own UUID (a fresh DB-generated id per
 * changeset) makes that collision impossible while keeping the mission prefix
 * for human readability. The result is always a valid single git ref segment
 * (`studio/<hex>-<hex>`): lowercased, hyphen-joined, illegal characters stripped.
 */
export function studioBranchName(missionId: string, changesetId: string): string {
  const mission = hexSlug(missionId, 8) || "m";
  const changeset = hexSlug(changesetId, 12) || "c";
  return `studio/${mission}-${changeset}`;
}

/** Keep only [a-z0-9] from a UUID-like id and cap the length. */
function hexSlug(id: string, max: number): string {
  return (id ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, max);
}
