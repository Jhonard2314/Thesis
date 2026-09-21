'use client';

import { useState, useRef } from "react";
import Link from 'next/link';

const isUrl = (str) => {
  try { new URL(str); return str.startsWith('http'); } catch { return false; }
};
const getBiasColor = (l) => ({ Low: '#4CAF50', Medium: '#FFC107', High: '#F44336' }[l] ?? '#8BA3C1');
const getBiasBg    = (l) => ({ Low: '#0d2b0d', Medium: '#2b2200', High: '#2b0d0d' }[l] ?? '#0F1E38');
const getBiasBadge = (l) => ({ Low: 'bg-green-900 text-green-300', Medium: 'bg-yellow-900 text-yellow-300', High: 'bg-red-900 text-red-300' }[l] ?? 'bg-slate-700 text-slate-300');

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
      if (d.error) { setSavedUrl(trimmed); setStage('needs_text'); setTimeout(() => pasteRef.current?.focus(), 100); return; }
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
    <div className="min-h-screen flex flex-col" style={{ background: '#0B1628' }}>

      {/* Nav */}
      <header className="sticky top-0 z-50 px-6 py-3 flex items-center justify-between"
        style={{ background: '#0D1B2E', borderBottom: '1px solid #1E3A5F' }}>
        <Link href="/" className="flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: '#8BA3C1' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#17C3B2'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#8BA3C1'}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          Back to News
        </Link>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#17C3B2' }}>
          NewsApex · Article Analyzer
        </span>
      </header>

      {/* Logo + input */}
      <div className={`flex flex-col items-center justify-center transition-all duration-500 ${stage === 'idle' ? 'flex-1' : 'pt-10 pb-6'}`}>
        <div className="mb-8 text-center select-none">
          <h1 className="text-4xl font-black tracking-tight" style={{ color: '#17C3B2' }}>NewsApex</h1>
          <p className="text-xs uppercase tracking-widest mt-1" style={{ color: '#8BA3C1' }}>
            Media Bias Analyzer · Powered by BERT-BABE
          </p>
        </div>

        <div className="w-full max-w-2xl px-4">
          {/* Input bar */}
          <div className="flex items-start gap-3 rounded-2xl px-4 py-3 transition-all"
            style={{ background: '#112240', border: '1px solid #1E3A5F' }}>
            {isUrl(input) ? (
              <svg className="w-5 h-5 mt-1 shrink-0" style={{ color: '#17C3B2' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
              </svg>
            ) : (
              <svg className="w-5 h-5 mt-1 shrink-0" style={{ color: '#8BA3C1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            )}
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey} rows={input.length > 120 ? 4 : 1}
              placeholder="Paste a URL or article text to analyze…"
              disabled={loading || stage === 'needs_text'}
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none disabled:opacity-50"
              style={{ color: '#E2EAF4', caretColor: '#17C3B2' }}/>
            {input && !loading && stage !== 'needs_text' && (
              <button onClick={reset} style={{ color: '#5A7A9A' }}
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
              style={{ background: '#17C3B2', color: '#0B1628' }}>
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
                style={{ background: 'transparent', border: '1px solid #1E3A5F', color: '#8BA3C1' }}>
                New Analysis
              </button>
            )}
          </div>

          {stage === 'idle' && (
            <p className="text-center text-xs mt-4" style={{ color: '#5A7A9A' }}>
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
            <div className="rounded-2xl p-6 max-w-2xl mx-auto" style={{ background: '#112240', border: '1px solid #1E3A5F' }}>
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: '#2b2200' }}>
                  <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-sm text-white">Couldn't access this article automatically</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8BA3C1' }}>Open the article, select all text, copy and paste below.</p>
                </div>
              </div>
              {savedUrl && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-xs" style={{ background: '#0D1B2E', border: '1px solid #1E3A5F' }}>
                  <span className="truncate" style={{ color: '#8BA3C1' }}>{savedUrl}</span>
                  <a href={savedUrl} target="_blank" rel="noopener noreferrer"
                    className="ml-auto font-medium shrink-0" style={{ color: '#17C3B2' }}>Open ↗</a>
                </div>
              )}
              <textarea ref={pasteRef} value={pastedText} onChange={(e) => setPastedText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) submitPasted(); }}
                rows={8} placeholder="Paste the full article text here…"
                className="w-full rounded-xl text-sm leading-relaxed p-4 outline-none resize-none"
                style={{ background: '#0D1B2E', border: '1px solid #1E3A5F', color: '#E2EAF4', caretColor: '#17C3B2' }}/>
              {pastedText.trim() && (
                <p className="text-xs mt-1.5" style={{ color: '#5A7A9A' }}>{pastedText.trim().split(/\s+/).length} words</p>
              )}
              <div className="flex gap-3 mt-4">
                <button onClick={submitPasted} disabled={pastedText.trim().split(/\s+/).length < 30}
                  className="flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#17C3B2', color: '#0B1628' }}>
                  Analyze Pasted Text
                </button>
                <button onClick={reset} className="px-5 py-2.5 text-sm font-medium rounded-xl transition-colors"
                  style={{ background: 'transparent', border: '1px solid #1E3A5F', color: '#8BA3C1' }}>
                  Cancel
                </button>
              </div>
              {pastedText.trim().split(/\s+/).length < 30 && pastedText.trim().length > 0 && (
                <p className="text-xs text-center mt-2" style={{ color: '#5A7A9A' }}>Need at least 30 words.</p>
              )}
            </div>
          )}

          {/* Error */}
          {stage === 'error' && (
            <div className="rounded-2xl p-6 text-center max-w-lg mx-auto" style={{ background: '#2b0d0d', border: '1px solid #7f1d1d' }}>
              <p className="text-red-400 font-bold mb-1">Analysis Failed</p>
              <p className="text-red-500 text-sm mb-4">{errorMsg}</p>
              <button onClick={reset} className="px-5 py-2 rounded-lg text-sm font-medium"
                style={{ background: '#F44336', color: '#fff' }}>Try Again</button>
            </div>
          )}

          {/* Loading */}
          {loading && !summaryData && (
            <div className="flex flex-col items-center py-16" style={{ color: '#8BA3C1' }}>
              <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"/>
              <p className="text-sm font-medium">
                {stage === 'extracting' ? 'Fetching article content…' : 'Running analysis…'}
              </p>
            </div>
          )}

          {/* Results */}
          {summaryData && (
            <div className="flex gap-6 mt-2">
              {/* Left panel */}
              <div className="w-72 shrink-0 space-y-4">
                <div className="rounded-xl p-5" style={{ background: '#112240', border: '1px solid #1E3A5F' }}>
                  <h4 className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: '#8BA3C1' }}>Executive Summary</h4>
                  {summaryData.summary
                    ? <p className="text-sm leading-relaxed italic" style={{ color: '#B8C5D6' }}>"{summaryData.summary}"</p>
                    : <p className="text-sm italic" style={{ color: '#5A7A9A' }}>Summary unavailable.</p>}
                </div>

                {(stage === 'analyzing' || stage === 'done') && (
                  <div className="rounded-xl p-5 text-center" style={{ background: biasData ? getBiasBg(biasData.bias_level) : '#112240', border: `1px solid ${biasData ? getBiasColor(biasData.bias_level) + '30' : '#1E3A5F'}` }}>
                    {biasData ? (
                      <>
                        <div className="text-5xl font-black mb-1" style={{ color: getBiasColor(biasData.bias_level) }}>{biasData.bias_score}%</div>
                        <span className={`inline-block px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest mb-3 ${getBiasBadge(biasData.bias_level)}`}>Bias Score</span>
                        <p className="text-xs leading-relaxed" style={{ color: '#B8C5D6' }}>{biasData.explanation}</p>
                      </>
                    ) : (
                      <div className="flex flex-col items-center py-4">
                        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3"/>
                        <p className="text-[10px] font-medium uppercase tracking-widest animate-pulse" style={{ color: '#17C3B2' }}>Analyzing…</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-xl p-4" style={{ background: '#112240', border: '1px solid #1E3A5F' }}>
                  <h4 className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: '#8BA3C1' }}>Bias Grading Scale</h4>
                  <div className="w-full h-2 rounded-full overflow-hidden flex mb-3">
                    <div className="bg-green-500 h-full w-1/2"/>
                    <div className="bg-yellow-400 h-full w-[20%]"/>
                    <div className="bg-red-500 h-full w-[30%]"/>
                  </div>
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex justify-between"><span className="text-green-400 font-bold">0% – 50%</span><span className="italic" style={{ color: '#8BA3C1' }}>Likely Factual</span></div>
                    <div className="flex justify-between"><span className="text-yellow-400 font-bold">51% – 70%</span><span className="italic" style={{ color: '#8BA3C1' }}>Likely Biased</span></div>
                    <div className="flex justify-between"><span className="text-red-400 font-bold">71% – 100%</span><span className="italic" style={{ color: '#8BA3C1' }}>Strongly Biased</span></div>
                  </div>
                </div>

                {biasData?.top_words?.length > 0 && biasData.bias_level !== 'Low' && (
                  <div className="rounded-xl p-4" style={{ background: '#112240', border: '1px solid #1E3A5F' }}>
                    <h4 className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: '#8BA3C1' }}>Key Biased Markers</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {biasData.top_words.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                          style={{ background: '#1A0808', border: '1px solid #7f1d1d' }}>
                          <span className="text-[11px] font-bold text-red-400">{item.word}</span>
                          <span className="text-[9px] text-red-600 font-mono">{item.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(savedUrl || isUrl(input.trim())) && (
                  <a href={savedUrl || input.trim()} target="_blank" rel="noopener noreferrer"
                    className="block w-full text-center text-xs font-black uppercase tracking-widest py-3 rounded-xl transition-colors"
                    style={{ background: '#17C3B2', color: '#0B1628' }}>
                    Visit Original Source
                  </a>
                )}
              </div>

              {/* Right panel */}
              <div className="flex-1 rounded-xl p-6 min-h-[400px]" style={{ background: '#112240', border: '1px solid #1E3A5F' }}>
                <h4 className="text-[9px] font-bold uppercase tracking-widest mb-5" style={{ color: '#8BA3C1' }}>Full Article Context</h4>
                {!biasData?.sentence_breakdown ? (
                  <div className="space-y-3">
                    {(summaryData?.full_content || '').split('\n').filter(Boolean).map((para, i) => (
                      <p key={i} className="text-sm leading-relaxed" style={{ color: '#5A7A9A' }}>{para}</p>
                    ))}
                    {stage === 'analyzing' && (
                      <div className="mt-6 rounded-xl p-6 text-center" style={{ border: '2px dashed #1E3A5F' }}>
                        <p className="text-sm italic" style={{ color: '#5A7A9A' }}>Bias highlighting will appear here after analysis…</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {biasData.sentence_breakdown.map((s, idx) => {
                      const biased = s.label === 'Biased';
                      return (
                        <span key={idx}
                          className="inline p-0.5 rounded-sm leading-[1.9] text-sm group relative cursor-help transition-colors"
                          style={{
                            color: '#E2EAF4',
                            background: biased ? 'rgba(244,67,54,0.15)' : 'rgba(76,175,80,0.1)',
                            borderBottom: biased ? '2px solid rgba(244,67,54,0.6)' : '2px solid rgba(76,175,80,0.4)',
                          }}
                          title={`${s.label}: ${s.score}%`}>
                          {s.text}{' '}
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-[10px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-48 text-center font-medium leading-normal whitespace-normal"
                            style={{ background: '#0B1628', color: '#E2EAF4', border: '1px solid #1E3A5F' }}>
                            {s.label}: {s.score}%
                            {s.reasoning && <span className="block mt-1 italic font-normal" style={{ color: '#8BA3C1' }}>"{s.reasoning}"</span>}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
