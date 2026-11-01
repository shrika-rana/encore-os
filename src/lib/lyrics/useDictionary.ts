import { useEffect, useState } from 'react';
import { Dict, getLoadedDictionary, loadDictionary } from './pron';

/** Loads the pronunciation dictionary once and shares it across components */
export function useDictionary(): Dict | null {
  const [dict, setDict] = useState<Dict | null>(getLoadedDictionary());
  useEffect(() => {
    if (dict) return;
    let alive = true;
    loadDictionary().then((d) => alive && setDict(d)).catch(() => {});
    return () => { alive = false; };
  }, [dict]);
  return dict;
}
