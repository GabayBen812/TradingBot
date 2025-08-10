import { GoogleGenerativeAI, type GenerationConfig, type SafetySetting } from '@google/generative-ai';
import { AiSchema, type AIResp } from './schemas';
import { tryParseJSON } from './utils';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;

export function getGemini() {
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY');
  const genAI = new GoogleGenerativeAI(apiKey);
  const generationConfig: GenerationConfig = {
    temperature: 0.3,
    maxOutputTokens: 800,
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
}): string[] {
  const base = JSON.stringify(input.taMultiTF);
  const shared = `System: ${baseSystemPrompt}\nContext: Symbol=${input.symbol}, Interval=${input.interval}. TA=${base}. Note=${input.userNote ?? ''}.\n`;
  const v1 = shared + 'Task: Provide a JSON-only decision using the schema. Focus on trend, momentum, and volatility filter.';
  const v2 = shared + 'Task: Provide a JSON-only decision using the schema. Be conservative; if disagreement across TFs, prefer No-Trade.';
  const v3 = shared + 'Task: Provide a JSON-only decision using the schema. Emphasize risk-first; ensure stop placement is defensible.';
  return [v1, v2, v3];
}

export async function askGemini(prompt: string): Promise<AIResp> {
  const model = getGemini();
  const r = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
  const text = r.response.text();
  const parsed = tryParseJSON(text);
  if (parsed.ok) return AiSchema.parse(parsed.value);
  // repair step
  const fixed = await repairToJSON(text);
  return AiSchema.parse(fixed);
}

export async function repairToJSON(raw: string): Promise<AIResp> {
  const model = getGemini();
  const repairPrompt = `The following text is intended to be valid JSON for a strict schema. Fix it into VALID JSON only, no commentary.\nText:\n${raw}`;
  const r = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: repairPrompt }] }] });
  const text = r.response.text();
  const parsed = tryParseJSON(text);
  if (!parsed.ok) throw new Error('Failed to repair JSON');
  return AiSchema.parse(parsed.value);
}


