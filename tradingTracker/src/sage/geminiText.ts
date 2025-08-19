import { GoogleGenerativeAI, type GenerationConfig, type SafetySetting } from '@google/generative-ai'
import type { Trade } from '../types'

const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim()

function getTextModel() {
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY. Set it in .env.local and restart the dev server.')
  const genAI = new GoogleGenerativeAI(apiKey)
  const generationConfig: GenerationConfig = {
    temperature: 0.4,
    maxOutputTokens: 900,
    responseMimeType: 'text/plain',
  }
  const safetySettings: SafetySetting[] = []
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash', generationConfig, safetySettings })
}

export async function analyzeTradeHebrew(trade: Trade): Promise<string> {
  const model = getTextModel()
  const context = JSON.stringify(trade, null, 2)
  const prompt = [
    'אתה אנליסט מסחר בקריפטו. נתח את העסקה הבאה בעברית בלבד.',
    'היה ענייני, תכליתי, וללא ניסוחים שיווקיים.',
    'צור פלט מובנה בסעיפים קצרים:',
    '- תמצית',
    '- נימוקי כניסה/יציאה',
    '- יחס סיכון/סיכוי (R:R) והאם היה סביר בהתחשב בנתונים',
    '- נקודות לשיפור (טיימינג, סטופ, טייק, ניהול פוזיציה, גודל עסקה)',
    '- מה הייתי עושה אחרת',
    '- צ׳ק-ליסט פרקטי לפעם הבאה',
    '',
    'נתוני העסקה (JSON):',
    context,
  ].join('\n')
  const r = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
  return r.response.text()
}


