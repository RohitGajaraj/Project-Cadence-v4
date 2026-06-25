/**
 * Quick smoke-test for the Cohere embed-v4 connection.
 * Run with: bun run scripts/test-cohere.ts
 * Requires COHERE_API_KEY in .env or environment.
 */
const key = process.env.COHERE_API_KEY;
if (!key) {
  console.error("❌  COHERE_API_KEY not set. Add it to .env and retry.");
  process.exit(1);
}

console.log("🔍  Testing Cohere embed-v4 connection...");

const res = await fetch("https://api.cohere.ai/compatibility/v1/embeddings", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "embed-v4.0",
    input: ["Cadence test embedding"],
    dimensions: 1536,
  }),
});

if (!res.ok) {
  const body = await res.text();
  console.error(`❌  Cohere API error ${res.status}:`, body.slice(0, 300));
  process.exit(1);
}

const json = (await res.json()) as {
  data: { embedding: number[] }[];
  usage?: { total_tokens?: number };
};
const vec = json.data[0]?.embedding;

if (!Array.isArray(vec) || vec.length !== 1536) {
  console.error(`❌  Unexpected response — got ${vec?.length ?? 0} dims, expected 1536`);
  process.exit(1);
}

console.log(
  `✅  Cohere embed-v4 connected. Vector: 1536 dims. Tokens used: ${json.usage?.total_tokens ?? "?"}`,
);
console.log(
  `    First 5 values: [${vec
    .slice(0, 5)
    .map((n) => n.toFixed(4))
    .join(", ")}]`,
);
