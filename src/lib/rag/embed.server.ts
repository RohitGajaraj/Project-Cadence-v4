/**
 * Embeddings helper. Uses Lovable AI Gateway /v1/embeddings with the
 * 1536-dim Matryoshka size so vectors fit the `vector(1536)` columns
 * defined in our migrations.
 */
const EMB_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
export const EMB_MODEL = "openai/text-embedding-3-small";
export const EMB_DIMS = 1536;

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  if (inputs.length === 0) return [];
  // Batch in chunks of 64 to stay well under the 256 limit.
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += 64) {
    const slice = inputs.slice(i, i + 64).map((s) => s.slice(0, 32_000));
    const res = await fetch(EMB_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMB_MODEL, input: slice, dimensions: EMB_DIMS }),
    });
    if (!res.ok) throw new Error(`embeddings ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    for (const row of j.data) out[i + row.index] = row.embedding;
  }
  return out;
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}