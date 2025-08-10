import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Interval = '1m' | '5m' | '15m';

export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
};

type UIState = {
  tab: 'chat' | 'history';
};

type CircuitState = {
  enabled: boolean;
  dailyLoss: number; // absolute loss accrued today
  dailyCap: number; // absolute loss cap for today
};

type Store = {
  symbol: string;
  interval: Interval;
  messages: Message[];
  ui: UIState;
  circuit: CircuitState;
  setSymbol: (s: string) => void;
  setInterval: (i: Interval) => void;
  pushMessage: (m: Message) => void;
  setTab: (t: UIState['tab']) => void;
  setCircuit: (c: Partial<CircuitState>) => void;
};

export const useStore = create<Store>()(
  persist(
    (set) => ({
      symbol: 'BTCUSDT',
      interval: '1m',
      messages: [],
      ui: { tab: 'chat' },
      circuit: { enabled: true, dailyLoss: 0, dailyCap: 200 },
      setSymbol: (s) => set({ symbol: s.toUpperCase() }),
      setInterval: (i) => set({ interval: i }),
      pushMessage: (m) => set((st) => ({ messages: [...st.messages, m] })),
      setTab: (t) => set((st) => ({ ui: { ...st.ui, tab: t } })),
      setCircuit: (c) => set((st) => ({ circuit: { ...st.circuit, ...c } })),
    }),
    { name: 'cryptosage-state' }
  )
);


