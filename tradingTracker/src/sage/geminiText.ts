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


export async function analyzeSignalHebrew(signal: { symbol: string; side: 'LONG' | 'SHORT'; entry?: number | null; stop?: number | null; take?: number | null; reason?: string | null }): Promise<string> {
  const model = getTextModel()
  const context = JSON.stringify(signal, null, 2)
  const prompt = [
    'אתה אנליסט מסחר בקריפטו. נתח את ההצעה לעסקה הבאה בעברית בלבד, מבעוד מועד (לפני כניסה).',
    'מטרתך היא לעזור לסוחר להחליט אם להיכנס עכשיו, להמתין לאישור נוסף, או לוותר.',
    'הימנע מלדמיין שנסגרה עסקה. אין להניח שהכניסה בוצעה בפועל.',
    'צור פלט ממוקד ומובנה בסעיפים קצרים:',
    '- תמצית (כיוון, רמת כניסה, SL/TP מוצעים, R:R אם ידוע)',
    '- נימוקים טכניים (פיבונאצ׳י/‏FVG/‏תמיכה־התנגדות/‏מגמה/‏RSI) ומידת הקונפלואנס',
    '- מה חסר לאישור (לדוגמה: נר אימות, שובר מבנה, בדיקת נפח)',
    '- ניהול סיכון מומלץ (גודל פוזיציה, היכן ה־SL ולמה, היכן ה־TP ולמה)',
    '- המלצה: כניסה עכשיו / המתנה / הימנעות + ציון ביטחון (0–100)',
    '- צ׳ק־ליסט קצר לביצוע הברור',
    '',
    'נתוני ההצעה (JSON):',
    context,
  ].join('\n')
  const r = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
  return r.response.text()
}


