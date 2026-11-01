import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useStore } from '../../store';
import { aiSuggest, AIConfig, Provider } from '../../lib/lyrics/cowriter';
import { toast } from '../../components/toast';

const MODEL_DEFAULT: Record<Provider, string> = { gemini: 'gemini-2.5-flash', openai: 'gpt-4o-mini' };

export function AISettings({ onClose }: { onClose: () => void }) {
  const ai = useStore((s) => s.ai);
  const setAI = useStore((s) => s.setAI);
  const [draft, setDraft] = useState<AIConfig>(ai);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const patch = (p: Partial<AIConfig>) => { setDraft((d) => ({ ...d, ...p })); setResult(null); };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const lines = await aiSuggest(draft, {
        title: 'Test', theme: 'first snow', mood: 'Dreamy', genre: 'Indie pop', section: 'Verse', chords: 'C G Am F',
        previousLines: [], targetSyllables: 7, count: 1,
      }, null);
      setResult({ ok: true, text: `Connected. Sample line: “${lines[0].text}”` });
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : 'Connection failed.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal
      title="Connect an AI model"
      onClose={onClose}
      footer={
        <>
          {ai.apiKey && (
            <button className="btn btn-ghost" onClick={() => { setAI({ apiKey: '' }); toast('AI model disconnected', 'info'); onClose(); }}>
              Disconnect
            </button>
          )}
          <button className="btn" onClick={test} disabled={!draft.apiKey || testing}>
            {testing ? <Loader2 size={14} className="spin" /> : null} Test connection
          </button>
          <button className="btn btn-primary" onClick={() => { setAI(draft); toast(draft.apiKey ? 'AI model connected' : 'Settings saved'); onClose(); }}>
            Save
          </button>
        </>
      }
    >
      <p className="muted" style={{ margin: 0 }}>
        Line ideas work offline. Add your own API key to get fully original lines written with your song's context.
        The key is stored only in this browser and sent only to the provider you pick.
      </p>
      <div className="segmented" role="group" aria-label="Provider">
        {(['gemini', 'openai'] as Provider[]).map((p) => (
          <button key={p} aria-pressed={draft.provider === p} onClick={() => patch({ provider: p, model: MODEL_DEFAULT[p] })}>
            {p === 'gemini' ? 'Google Gemini' : 'OpenAI-compatible'}
          </button>
        ))}
      </div>
      <label className="field">
        <span>API key</span>
        <input className="input" type="password" autoComplete="off" value={draft.apiKey} onChange={(e) => patch({ apiKey: e.target.value.trim() })}
          placeholder={draft.provider === 'gemini' ? 'Paste a key from Google AI Studio' : 'sk-…'} />
      </label>
      <div className="grid-2">
        <label className="field">
          <span>Model</span>
          <input className="input" value={draft.model} onChange={(e) => patch({ model: e.target.value })} />
        </label>
        {draft.provider === 'openai' && (
          <label className="field">
            <span>API base URL</span>
            <input className="input" value={draft.baseUrl} onChange={(e) => patch({ baseUrl: e.target.value })} />
          </label>
        )}
      </div>
      {result && (
        <div className="engine-note" style={{ color: result.ok ? 'var(--ok)' : 'var(--berry)' }}>
          {result.ok && <CheckCircle2 size={14} style={{ flex: 'none', marginTop: 2 }} />} {result.text}
        </div>
      )}
    </Modal>
  );
}
