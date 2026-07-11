export interface AiModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}

// $/1M tokens (cached 2026-06-24 via the claude-api skill). Falls back to the
// opus-4-8 row for any model string not listed here — a deliberate over-estimate,
// so an unknown model can only make the budget guard stricter, never laxer.
//
// The gateway rows are the OpenRouter slugs (ANTHROPIC_BASE_URL pointed at a
// compatible gateway, see .env.example). They are priced separately because the
// opus-4-8 fallback would misreport them: Gemini Pro is cheaper than Opus, so
// spend was being over-reported, and a Fable-tier model would be under-reported.
export const AI_MODEL_PRICES: Record<string, AiModelPrice> = {
  'claude-opus-4-8': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-opus-4-7': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-opus-4-6': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-sonnet-5': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-sonnet-4-6': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
  // gateway slugs (verified against OpenRouter's /models 2026-07-11)
  'anthropic/claude-opus-4.8': { inputPerMTok: 5, outputPerMTok: 25 },
  'anthropic/claude-sonnet-5': { inputPerMTok: 2, outputPerMTok: 10 },
  'anthropic/claude-haiku-4.5': { inputPerMTok: 1, outputPerMTok: 5 },
  'anthropic/claude-fable-5': { inputPerMTok: 10, outputPerMTok: 50 },
  'google/gemini-3.1-pro-preview': { inputPerMTok: 2, outputPerMTok: 12 },
  'google/gemini-3-flash-preview': { inputPerMTok: 0.5, outputPerMTok: 3 },
  'google/gemini-3.1-flash-lite': { inputPerMTok: 0.25, outputPerMTok: 1.5 },
};

export function priceForModel(model: string): AiModelPrice {
  return AI_MODEL_PRICES[model] ?? AI_MODEL_PRICES['claude-opus-4-8'];
}

export function costUsdFor(model: string, inputTokens: number, outputTokens: number): number {
  const price = priceForModel(model);
  return (inputTokens / 1_000_000) * price.inputPerMTok + (outputTokens / 1_000_000) * price.outputPerMTok;
}
