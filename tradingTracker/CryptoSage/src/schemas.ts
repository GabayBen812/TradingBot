import { z } from 'zod';

export const ForecastPoint = z.object({ t: z.number().int(), price: z.number().positive() });

export const AiSchema = z.object({
  verdict: z.enum(['Buy', 'Sell', 'No-Trade']),
  confidence: z.number().min(0).max(1),
  analysis_text: z.string().min(10),
  levels: z.object({
    entry: z.number().positive(),
    stop: z.number().positive(),
    tp1: z.number().positive(),
    tp2: z.number().positive(),
  }),
  risk: z.object({
    r: z.number().min(0),
    notes: z.string().optional().default(''),
  }),
  checklist: z.array(z.string()),
  forecast: z.object({
    horizonMinutes: z.number().int().min(5).max(120),
    points: z.array(ForecastPoint).min(2),
    rationale: z.string().min(5),
  }),
  annotations: z.object({
    fibLevels: z.record(z.string(), z.number()).optional().default({}),
    keyLevels: z.array(z.number()).optional().default([]),
  }),
  uncertainty_reasons: z.array(z.string()).optional().default([]),
  what_would_change_my_mind: z.array(z.string()).optional().default([]),
});

export type AIResp = z.infer<typeof AiSchema>;


