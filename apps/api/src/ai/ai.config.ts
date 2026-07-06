export interface AiModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}

// $/1M tokens (cached 2026-06-24 via the claude-api skill). Falls back to the
// opus-4-8 row for any model string not listed here.
export const AI_MODEL_PRICES: Record<string, AiModelPrice> = {
  'claude-opus-4-8': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-opus-4-7': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-opus-4-6': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-sonnet-5': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-sonnet-4-6': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
};

export function priceForModel(model: string): AiModelPrice {
  return AI_MODEL_PRICES[model] ?? AI_MODEL_PRICES['claude-opus-4-8'];
}

export function costUsdFor(model: string, inputTokens: number, outputTokens: number): number {
  const price = priceForModel(model);
  return (inputTokens / 1_000_000) * price.inputPerMTok + (outputTokens / 1_000_000) * price.outputPerMTok;
}
