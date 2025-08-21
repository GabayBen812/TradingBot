import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import Button from '../components/ui/Button'
import { useNavigate } from 'react-router-dom'

type Item = { id: string; text: string; checked: boolean }
type Section = { id: string; title: string; items: Item[] }

// Bump key for the new concise Hebrew checklist
const STORAGE_KEY = 'trading_checklist_v3_he'

function buildDefaultSections(): Section[] {
  return [
    {
      id: 'trend-structure',
      title: '1. מגמה ומבנה',
      items: [
        { id: 'trend-rt', text: 'יש שבירת מבנה + ריטסט? מתאים למגמה או היפוך ברור?', checked: false },
      ],
    },
    {
      id: 'fibonacci',
      title: '2. פיבונאצ׳י',
      items: [
        { id: 'fib-0618', text: 'כניסה סביב 0.618/0.786 עם קונפלואנס (תמיכה/התנגדות/ליקווידיטי).', checked: false },
      ],
    },
    {
      id: 'pattern',
      title: '3. אישור דפוס',
      items: [
        { id: 'pattern-confirm', text: 'דאבל טופ/בוטם או נר דחייה חזק (אופציונלי: RSI/ווליום).', checked: false },
      ],
    },
    {
      id: 'risk',
      title: '4. ניהול סיכון',
      items: [
        { id: 'risk-rr', text: 'R/R ≥ 2.5, סטופ מעבר לרעש, סיכון <1% מההון.', checked: false },
      ],
    },
    {
      id: 'execution',
      title: '5. ביצוע',
      items: [
        { id: 'execution-confirm', text: 'כניסה בנר מאשר (או SL צמוד אם אגרסיבי), SL+TP מוגדרים מיד.', checked: false },
      ],
    },
    {
      id: 'management',
      title: '6. ניהול תוך כדי',
      items: [
        { id: 'management-be', text: 'סטופ ל־BE ב־R=1, חלקיות ברמות מפתח, לשמור על תוכנית עם R/R משתלם.', checked: false },
      ],
    },
  ]
}

export default function Checklist() {
  const navigate = useNavigate()
  const [sections, setSections] = useState<Section[]>(() => {
    // Force new concise list; do not migrate old text to avoid mixing languages
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    } catch {}
    return buildDefaultSections()
  })

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sections)) } catch {}
  }, [sections])

  const total = useMemo(() => sections.reduce((acc, s) => acc + s.items.length, 0), [sections])
  const checked = useMemo(() => sections.reduce((acc, s) => acc + s.items.filter(i => i.checked).length, 0), [sections])
  const allChecked = checked === total && total > 0

  const toggle = (sid: string, iid: string) => {
    setSections(prev => prev.map(s => s.id !== sid ? s : ({
      ...s,
      items: s.items.map(i => i.id === iid ? { ...i, checked: !i.checked } : i)
    })))
  }

  const reset = () => setSections(buildDefaultSections())

  return (
    <div className="space-y-6 text-right" dir="rtl" lang="he">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">צ׳ק-ליסט למסחר</h1>
        <div className="text-sm text-gray-400">{checked}/{total} הושלמו</div>
      </div>

      {sections.map(section => (
        <Card key={section.id}>
          <CardHeader>
            <div className="font-semibold">{section.title}</div>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              {section.items.map(item => (
                <label key={item.id} className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1 accent-blue-500" checked={item.checked} onChange={() => toggle(section.id, item.id)} />
                  <span>{item.text}</span>
                </label>
              ))}
            </div>
          </CardBody>
        </Card>
      ))}

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={reset}>איפוס</Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate(-1)}>חזרה</Button>
          <Button disabled={!allChecked} onClick={() => { window.localStorage.removeItem(STORAGE_KEY); navigate('/') }}>סיום</Button>
        </div>
      </div>
    </div>
  )
}


