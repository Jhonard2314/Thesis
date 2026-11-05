'use client';

import { useState, useRef } from "react";
import Link from 'next/link';
import BiasResultsPanel from '../components/BiasResultsPanel';

const isUrl = (str) => {
  try { new URL(str); return str.startsWith('http'); } catch { return false; }
};
const getBiasColor = (l) => ({ Low: '#10b981', Medium: '#f59e0b', High: '#ef4444' }[l] ?? '#64748b');
const getBiasBg    = (l) => ({ Low: 'rgba(16, 185, 129, 0.08)', Medium: 'rgba(245, 158, 11, 0.08)', High: 'rgba(239, 68, 68, 0.08)' }[l] ?? '#0F1E38');
const getBiasBadge = (l) => ({ Low: 'bg-green-100 text-green-700', Medium: 'bg-amber-100 text-amber-700', High: 'bg-red-100 text-red-700' }[l] ?? 'bg-slate-100 text-slate-600');

export default function AnalyzePage() {
  const [input, setInput]             = useState('');
  const [pastedText, setPastedText]   = useState('');
  const [savedUrl, setSavedUrl]       = useState('');
  const [stage, setStage]             = useState('idle');
  const [summaryData, setSummaryData] = useState(null);
  const [biasData, setBiasData]       = useState(null);
  const [errorMsg, setErrorMsg]       = useState('');

  const inputRef   = useRef(null);
  const pasteRef   = useRef(null);
  const resultsRef = useRef(null);

  const reset = () => {
    setInput(''); setPastedText(''); setSavedUrl('');
    setStage('idle'); setSummaryData(null); setBiasData(null); setErrorMsg('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const runAnalysis = async (content, url = null) => {
    setStage('analyzing'); setSummaryData(null); setBiasData(null);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    try {
      const r1 = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, action: 'get_summary', ...(url ? { url } : {}) }),
      });
      const d1 = await r1.json();
      if (d1.error) { setErrorMsg(d1.error); setStage('error'); return; }
      setSummaryData(d1);

      const r2 = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: d1.full_content || content, action: 'analyze_bias', ...(url ? { url } : {}) }),
      });
      const d2 = await r2.json();
      if (d2.error) { setErrorMsg(d2.error); setStage('error'); return; }
      setBiasData(d2); setStage('done');
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) { setErrorMsg(e.message || 'Network error'); setStage('error'); }
  };

  const analyze = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!isUrl(trimmed)) { await runAnalysis(trimmed); return; }

    setStage('extracting'); setSummaryData(null); setBiasData(null); setErrorMsg('');
    try {
      const r = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, action: 'get_summary' }),
      });
      const d = await r.json();
      if (d.error) {
        // Cloudflare / hard block — no point asking user to paste, explain it clearly
        if (d.blocked) { setErrorMsg(d.error); setStage('error'); return; }
        setSavedUrl(trimmed); setStage('needs_text'); setTimeout(() => pasteRef.current?.focus(), 100); return;
      }
      setSummaryData(d); setStage('analyzing');
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      const r2 = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, content: d.full_content, action: 'analyze_bias' }),
      });
      const d2 = await r2.json();
      if (d2.error) { setErrorMsg(d2.error); setStage('error'); return; }
      setBiasData(d2); setStage('done');
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) { setErrorMsg(e.message || 'Network error'); setStage('error'); }
  };

  const submitPasted = async () => {
    const t = pastedText.trim();
    if (!t) return;
    await runAnalysis(t, savedUrl || null);
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); analyze(); } };
  const loading   = stage === 'extracting' || stage === 'analyzing';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8fafc' }}>

      {/* Nav */}
      <header className="sticky top-0 z-50 px-6 py-3 flex items-center justify-between"
        style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <Link href="/" className="flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: '#64748b' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#0EA5E9'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          Back to News
        </Link>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0EA5E9' }}>
          Fine-Tuned Transformer-Based System
        </span>
      </header>

      {/* Logo + input */}
      <div className={`flex flex-col items-center justify-center transition-all duration-500 ${stage === 'idle' ? 'flex-1' : 'pt-10 pb-6'}`}>
        <div className="mb-8 text-center select-none">
          <h1 className="text-2xl font-black tracking-tight leading-tight text-center" style={{ color: '#0EA5E9' }}>
            Fine-Tuned Transformer-Based System
          </h1>
          <p className="text-xs uppercase tracking-widest mt-1 text-center" style={{ color: '#64748b' }}>
            Bias Assessment and Summarization of English News Articles · Powered by BERT-BABE
          </p>
        </div>

        <div className="w-full max-w-2xl px-4">
          {/* Input bar */}
          <div className="flex items-start gap-3 rounded-2xl px-4 py-3 transition-all"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
            {isUrl(input) ? (
              <svg className="w-5 h-5 mt-1 shrink-0" style={{ color: '#0EA5E9' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
              </svg>
            ) : (
              <svg className="w-5 h-5 mt-1 shrink-0" style={{ color: '#64748b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            )}
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey} rows={input.length > 120 ? 4 : 1}
              placeholder="Paste a URL or article text to analyze…"
              disabled={loading || stage === 'needs_text'}
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none disabled:opacity-50"
              style={{ color: '#0f172a', caretColor: '#0EA5E9' }}/>
            {input && !loading && stage !== 'needs_text' && (
              <button onClick={reset} style={{ color: '#94a3b8' }}
                className="mt-1 shrink-0 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button onClick={analyze} disabled={!input.trim() || loading || stage === 'needs_text'}
              className="px-6 py-2.5 text-sm font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#0EA5E9', color: '#ffffff' }}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  {stage === 'extracting' ? 'Fetching…' : 'Analyzing…'}
                </span>
              ) : 'Analyze Article'}
            </button>
            {stage !== 'idle' && (
              <button onClick={reset} className="px-6 py-2.5 text-sm font-medium rounded-xl transition-colors"
                style={{ background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b' }}>
                New Analysis
              </button>
            )}
          </div>

          {stage === 'idle' && (
            <p className="text-center text-xs mt-4" style={{ color: '#94a3b8' }}>
              Paste a news article URL <span className="mx-1 opacity-40">·</span> or paste the article text directly
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      {stage !== 'idle' && (
        <div ref={resultsRef} className="w-full max-w-6xl mx-auto px-4 pb-16">

          {/* needs_text */}
          {stage === 'needs_text' && (
            <div className="rounded-2xl p-6 max-w-2xl mx-auto"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                  <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Couldn't access this article automatically</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Open the article, select all text, copy and paste below.</p>
                </div>
              </div>
              {savedUrl && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-xs"
                  style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border)' }}>
                  <span className="truncate" style={{ color: 'var(--text-muted)' }}>{savedUrl}</span>
                  <a href={savedUrl} target="_blank" rel="noopener noreferrer"
                    className="ml-auto font-medium shrink-0" style={{ color: 'var(--accent)' }}>Open ↗</a>
                </div>
              )}
              <textarea ref={pasteRef} value={pastedText} onChange={(e) => setPastedText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) submitPasted(); }}
                rows={8} placeholder="Paste the full article text here…"
                className="w-full rounded-xl text-sm leading-relaxed p-4 outline-none resize-none"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', caretColor: 'var(--accent)' }}/>
              {pastedText.trim() && (
                <p className="text-xs mt-1.5" style={{ color: '#94a3b8' }}>{pastedText.trim().split(/\s+/).length} words</p>
              )}
              <div className="flex gap-3 mt-4">
                <button onClick={submitPasted} disabled={pastedText.trim().split(/\s+/).length < 30}
                  className="flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#0EA5E9', color: '#ffffff' }}>
                  Analyze Pasted Text
                </button>
                <button onClick={reset} className="px-5 py-2.5 text-sm font-medium rounded-xl transition-colors"
                  style={{ background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b' }}>
                  Cancel
                </button>
              </div>
              {pastedText.trim().split(/\s+/).length < 30 && pastedText.trim().length > 0 && (
                <p className="text-xs text-center mt-2" style={{ color: '#94a3b8' }}>Need at least 30 words.</p>
              )}
            </div>
          )}

          {/* Error */}
          {stage === 'error' && (
            <div className="rounded-2xl p-6 text-center max-w-lg mx-auto"
              style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)' }}>
              <p className="text-red-500 font-bold mb-1">Analysis Failed</p>
              <p className="text-red-400 text-sm mb-4">{errorMsg}</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button onClick={reset} className="px-5 py-2 rounded-lg text-sm font-medium"
                  style={{ background: '#ef4444', color: '#fff' }}>Try Again</button>
                {isUrl(input.trim()) && (
                  <button onClick={() => { setSavedUrl(input.trim()); setStage('needs_text'); setTimeout(() => pasteRef.current?.focus(), 100); }}
                    className="px-5 py-2 rounded-lg text-sm font-medium"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    Paste Article Text Instead
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && !summaryData && (
            <div className="flex flex-col items-center py-16" style={{ color: '#64748b' }}>
              <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"/>
              <p className="text-sm font-medium">
                {stage === 'extracting' ? 'Fetching article content…' : 'Running analysis…'}
              </p>
            </div>
          )}

          {/* Results */}
          {summaryData && (
            <BiasResultsPanel 
              biasData={biasData}
              summaryData={summaryData}
              isLoading={stage === 'analyzing'}
              articleUrl={savedUrl || (isUrl(input.trim()) ? input.trim() : null)}
              showArticleText={true}
            />
          )}
        </div>
      )}
    </div>
  );
}
