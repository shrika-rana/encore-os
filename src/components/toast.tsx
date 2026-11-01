import { create } from 'zustand';
import { CheckCircle2, Info } from 'lucide-react';

interface Toast { id: number; text: string; tone: 'ok' | 'info' | 'berry' }
interface ToastState { toasts: Toast[]; push: (text: string, tone?: Toast['tone']) => void }

let n = 0;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (text, tone = 'ok') => {
    const id = ++n;
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
}));

export const toast = (text: string, tone?: Toast['tone']) => useToasts.getState().push(text, tone);

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.tone === 'ok' ? <CheckCircle2 size={16} /> : <Info size={16} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
