'use client';

import { useState, useRef } from "react";

// ── helpers ──────────────────────────────────────────────────────────────────
const isUrl = (str) => {
  try { new URL(str); return str.startsWith('http'); } catch { return false; }
};

const getBiasColor  = (l) => ({ Low:'text-green-600', Medium:'text-yellow-600', High:'text-red-600' }[l] ?? 'text-gray-600');
const getBiasBg     = (l) => ({ Low:'bg-green-50',    Medium:'bg-yellow-50',    High:'bg-red-50'    }[l] ?? 'bg-gray-50');
const getBiasBadge  = (l) => ({ Low:'bg-green-100 text-green-800', Medium:'bg-yellow-100 text-yellow-800', High:'bg-red-100 text-red-800' }[l] ?? 'bg-gray-100 text-gray-800');

// ── main component ────────────────────────────────────────────────────────────
export default function Home() {
  const [input, setInput]           = useState('');
  const [stage, setStage]           = useState('idle');   // idle | extracting | analyzing | done | error
  const [summaryData, setSummaryData] = useState(null);
  const [biasData, setBiasData]     = useState(null);
  const [errorMsg, setErrorMsg]     = useState('');
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  const reset = () => {
    setInput(''); setStage('idle');
    setSummaryData(null); setBiasData(null); setErrorMsg('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const analyze = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setStage('extracting');
    setSummaryData(null); setBiasData(null); setErrorMsg('');

    const body = isUrl(trimmed)
      ? { url: trimmed, action: 'get_summary' }
      : { content: trimmed, action: 'get_summary' };

    try {
      // Step 1 — extract + summarise
      const r1 = await fetch('/api/bias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d1 = await r1.json();
      if (d1.error) { setErrorMsg(d1.error); setStage('error'); return; }
      setSummaryData(d1);

      // Step 2 — bias analysis
      setStage('analyzing');
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

      const r2 = await fetch('/api/bias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isUrl(trimmed) ? { url: trimmed } : {}),
          content: d1.full_content || trimmed,
          action: 'analyze_bias',
        }),
      });
      const d2 = await r2.json();
      if (d2.error) { setErrorMsg(d2.error); setStage('error'); return; }
      setBiasData(d2);
      setStage('done');
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) {
      setErrorMsg(e.message || 'Network error'); setStage('error');
    }
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); analyze(); } };
  const loading = stage === 'extracting' || stage === 'analyzing';

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── Landing / Search area ── */}
      <div className={`flex flex-col items-center justify-center transition-all duration-500 ${stage === 'idle' ? 'flex-1' : 'pt-10 pb-6'}`}>

        {/* Logo */}
        <div className="mb-6 text-center select-none">
          <h1 className="text-5xl font-black tracking-tight">
            <span className="text-blue-600">N</span>
            <span className="text-red-500">e</span>
            <span className="text-yellow-500">w</span>
            <span className="text-blue-600">s</span>
            <span className="text-green-500">A</span>
            <span className="text-red-500">p</span>
            <span className="text-blue-600">e</span>
            <span className="text-yellow-500">x</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Media Bias Analyzer · Powered by BERT-BABE</p>
        </div>

        {/* Input bar */}
        <div className="w-full max-w-2xl px-4">
          <div className="flex items-start gap-2 border border-gray-300 rounded-2xl shadow-sm hover:shadow-md focus-within:shadow-md focus-within:border-blue-400 transition-all bg-white px-4 py-3">
            {/* Icon */}
            <svg className="w-5 h-5 text-gray-400 mt-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={input.length > 120 ? 4 : 1}
              placeholder="Paste a URL or article text to analyze…"
              disabled={loading}
              className="flex-1 resize-none bg-transparent text-gray-800 text-sm leading-relaxed outline-none placeholder-gray-400 disabled:opacity-50"
            />

            {input && !loading && (
              <button onClick={reset} className="text-gray-400 hover:text-gray-600 mt-1 shrink-0" title="Clear">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* Buttons row */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={analyze}
              disabled={!input.trim() || loading}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  {stage === 'extracting' ? 'Extracting…' : 'Analyzing…'}
                </span>
              ) : 'Analyze Article'}
            </button>
            {(stage !== 'idle') && (
              <button onClick={reset} className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg border border-gray-200 transition-colors">
                New Analysis
              </button>
            )}
          </div>

          {/* Hint */}
          {stage === 'idle' && (
            <p className="text-center text-xs text-gray-400 mt-4">
              Paste a news article URL <span className="mx-1 text-gray-300">·</span> or paste the article text directly
            </p>
          )}
        </div>
      </div>

      {/* ── Results area ── */}
      {stage !== 'idle' && (
        <div ref={resultsRef} className="w-full max-w-6xl mx-auto px-4 pb-16">

          {/* Error */}
          {stage === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-lg mx-auto">
              <p className="text-red-700 font-bold mb-1">Analysis Failed</p>
              <p className="text-red-600 text-sm">{errorMsg}</p>
              <button onClick={reset} className="mt-4 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
                Try Again
              </button>
            </div>
          )}

          {/* Loading state */}
          {loading && !summaryData && (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-4"/>
              <p className="text-sm font-medium">
                {stage === 'extracting' ? 'Extracting article content…' : 'Running bias analysis…'}
              </p>
            </div>
          )}

          {/* Results */}
          {summaryData && (
            <div className="flex gap-6 mt-2">

              {/* ── Left panel: metrics ── */}
              <div className="w-72 shrink-0 space-y-4">

                {/* Summary */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Executive Summary</h4>
                  {summaryData.summary ? (
                    <p className="text-sm text-gray-700 leading-relaxed italic">"{summaryData.summary}"</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Summary unavailable.</p>
                  )}
                </div>

                {/* Bias score — show when done, spinner when still analyzing */}
                {(stage === 'analyzing' || stage === 'done') && (
                  <div className={`rounded-xl border shadow-sm p-5 text-center ${biasData ? getBiasBg(biasData.bias_level) : 'bg-gray-50'}`}>
                    {biasData ? (
                      <>
                        <div className={`text-5xl font-black mb-1 ${getBiasColor(biasData.bias_level)}`}>
                          {biasData.bias_score}%
                        </div>
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 ${getBiasBadge(biasData.bias_level)}`}>
                          Bias Score
                        </span>
                        <p className="text-xs text-gray-700 leading-relaxed">{biasData.explanation}</p>
                      </>
                    ) : (
                      <div className="flex flex-col items-center py-4">
                        <div className="w-8 h-8 border-4 border-gray-200 border-t-red-500 rounded-full animate-spin mb-3"/>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-widest animate-pulse">Analyzing…</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Bias grading scale */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Bias Grading Scale</h4>
                  <div className="w-full h-2 rounded-full overflow-hidden flex mb-3">
                    <div className="bg-green-400 h-full w-1/2"/>
                    <div className="bg-yellow-400 h-full w-[20%]"/>
                    <div className="bg-red-500 h-full w-[30%]"/>
                  </div>
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex justify-between"><span className="text-green-600 font-bold">0% – 50%</span><span className="text-gray-500 italic">Likely Factual</span></div>
                    <div className="flex justify-between"><span className="text-yellow-600 font-bold">51% – 70%</span><span className="text-gray-500 italic">Likely Biased</span></div>
                    <div className="flex justify-between"><span className="text-red-600 font-bold">71% – 100%</span><span className="text-gray-500 italic">Strongly Biased</span></div>
                  </div>
                </div>

                {/* Top biased words */}
                {biasData?.top_words?.length > 0 && biasData.bias_level !== 'Low' && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Key Biased Markers</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {biasData.top_words.map((item, idx) => (
                        <div key={idx} className="bg-white border border-red-100 rounded-lg px-2.5 py-1.5 flex items-center gap-2 shadow-sm">
                          <span className="text-xs font-bold text-red-700">{item.word}</span>
                          <span className="text-[9px] bg-red-50 text-red-500 px-1 rounded font-mono font-bold">{item.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Visit source */}
                {isUrl(input.trim()) && (
                  <a href={input.trim()} target="_blank" rel="noopener noreferrer"
                    className="block w-full text-center bg-gray-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl transition-colors">
                    Visit Original Source
                  </a>
                )}
              </div>

              {/* ── Right panel: full article with highlighting ── */}
              <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-6 min-h-[400px]">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-5">Full Article Context</h4>

                {!biasData?.sentence_breakdown ? (
                  <div className="space-y-3">
                    {(summaryData?.full_content || '').split('\n').filter(Boolean).map((para, i) => (
                      <p key={i} className="text-gray-400 text-sm leading-relaxed">{para}</p>
                    ))}
                    {stage === 'analyzing' && (
                      <div className="mt-6 bg-gray-50 rounded-xl p-6 text-center border-2 border-dashed border-gray-200">
                        <p className="text-gray-400 text-sm italic">Bias highlighting will appear here after analysis…</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {biasData.sentence_breakdown.map((s, idx) => {
                      const biased = s.label === 'Biased';
                      return (
                        <span
                          key={idx}
                          className={`inline p-0.5 rounded-sm text-gray-900 leading-[1.9] text-sm group relative cursor-help
                            ${biased
                              ? 'bg-red-100/80 border-b-2 border-red-300 hover:bg-red-200'
                              : 'bg-green-100/60 border-b-2 border-green-200 hover:bg-green-200'
                            } transition-colors`}
                          title={`${s.label}: ${s.score}%`}
                        >
                          {s.text}{' '}
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-48 text-center font-medium leading-normal whitespace-normal">
                            {s.label}: {s.score}%
                            {s.reasoning && <span className="block mt-1 text-gray-400 italic font-normal">"{s.reasoning}"</span>}
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
