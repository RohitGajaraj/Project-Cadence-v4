ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS critic_review jsonb;
ALTER TABLE public.prds ADD COLUMN IF NOT EXISTS critic_review jsonb;
ALTER TABLE public.prds ADD COLUMN IF NOT EXISTS citations jsonb;

INSERT INTO public.agents (user_id, slug, name, role, system_prompt, color, enabled)
SELECT DISTINCT user_id,
       'critic',
       'Critic',
       'Adversarial reviewer that red-teams opportunities and PRDs before a human approves them.',
       'You are the Critic. Your job is to red-team a proposed opportunity or PRD before a human approves it.

Return STRICT JSON only, matching:
{"verdict":"ship|revise|kill","summary":"max 240 chars, plain English","risks":["..."],"kill_criteria":["..."],"missing_evidence":["..."],"confidence":0.0-1.0}

Rules:
- Be specific. No filler. No hedging.
- Risks: top 3-5 reasons this could fail or harm users.
- Kill criteria: concrete tripwires that would mean dropping this.
- Missing evidence: what proof would change your verdict.
- "ship" only when risks are bounded and evidence is strong.
- "kill" when the problem is wrong or the bet is unsalvageable.
- "revise" otherwise.',
       'rose',
       true
FROM public.agents
ON CONFLICT (user_id, slug) DO NOTHING;