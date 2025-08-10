import { GoogleGenerativeAI, type GenerationConfig, type SafetySetting } from '@google/generative-ai';
import { AiSchema, type AIResp } from './schemas';
import { tryParseJSON } from './utils';

const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();

export function getGemini() {
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY. Set it in .env.local and restart the dev server.');
  const genAI = new GoogleGenerativeAI(apiKey);
  const generationConfig: GenerationConfig = {
    temperature: 0.3,
    maxOutputTokens: 600,
    responseMimeType: 'application/json',
  };
  const safetySettings: SafetySetting[] = [];
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro', generationConfig, safetySettings });
  return model;
}

export const baseSystemPrompt = `You are CryptoSage, a radical-candor crypto day-trading assistant.
Rules:
- Prefer No-Trade if uncertainty > 0.4 or lacking confluence.
- Be objective, concise, strictly avoid persuasion or pleasantries.
- Output STRICT JSON only, following the provided schema exactly. No code fences.
- Never invent data. Use the TA JSON and user note only.
- If volatility is low (ATR%), default to No-Trade unless exceptional confluence exists.
`;

export function buildPromptVariants(input: {
  symbol: string;
  interval: string;
  taMultiTF: unknown;
  userNote?: string;
  userPlan?: { side?: 'Buy' | 'Sell'; amount?: number; entry?: number; stop?: number; tp1?: number; tp2?: number };
}): string[] {
  const base = JSON.stringify(input.taMultiTF);
  const schemaText = `Schema (ALL fields required, exact keys, no extra keys):
{
  "verdict": "Buy" | "Sell" | "No-Trade",
  "confidence": number in [0,1],
  "analysis_text": string (>=10 chars, English preferred),
  "levels": { "entry": number, "stop": number, "tp1": number, "tp2": number },
  "risk": { "r": number >= 0, "notes": string },
  "checklist": string[],
  "forecast": {
    "horizonMinutes": integer between 5 and 120,
    "points": [{"t": unix_ms_number, "price": number}] (>=2 points),
    "rationale": string
  },
  "annotations": { "fibLevels": { [ratio: string]: number }, "keyLevels": number[] },
  "uncertainty_reasons": string[],
  "what_would_change_my_mind": string[]
}
Hard constraints:
- verdict MUST be exactly one of: Buy, Sell, No-Trade (no other language or spaces)
- All numbers must be numeric values (not strings)
- timestamps t are milliseconds since epoch (number)
`;
  const plan = input.userPlan
    ? `UserTradeIdea: ${JSON.stringify(input.userPlan)} (critique this plan explicitly: feasibility, better entry/stop/TP, and whether to skip)`
    : '';
  const shared = `System: ${baseSystemPrompt}\nContext: Symbol=${input.symbol}, Interval=${input.interval}. TA=${base}. Note=${input.userNote ?? ''}. ${plan}\n${schemaText}\nReturn ONLY valid JSON for the schema.`;
  const v1 = shared + '\nFocus: trend, momentum, volatility filter.';
  const v2 = shared + '\nBe conservative; if disagreement across TFs, prefer No-Trade.';
  const v3 = shared + '\nEmphasize risk-first; ensure stop placement is defensible.';
  return [v1, v2, v3];
}

export async function askGemini(prompt: string): Promise<AIResp> {
  const model = getGemini();
  const r = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
  const text = r.response.text();
  const parsed = tryParseJSON(text);
  if (parsed.ok) return AiSchema.parse(parsed.value);
  const fixed = await repairToJSON(text);
  return AiSchema.parse(fixed);
}

export async function repairToJSON(raw: string): Promise<AIResp> {
  const model = getGemini();
  const repairPrompt = `Fix into VALID JSON only (no commentary) using this schema. Ensure values are the correct types and enums are exact.\n${raw}`;
  const r = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: repairPrompt }] }] });
  const text = r.response.text();
  const parsed = tryParseJSON(text);
  if (!parsed.ok) throw new Error('Failed to repair JSON');
  return AiSchema.parse(parsed.value);
}


