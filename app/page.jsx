'use client';

import { useState, useRef, useEffect } from "react";

// ── helpers ───────────────────────────────────────────────────────────────────
const isUrl = (str) => {
  try { new URL(str); return str.startsWith('http'); } catch { return false; }
};
const getBiasColor  = (l) => ({ Low:'text-green-600', Medium:'text-yellow-600', High:'text-red-600' }[l] ?? 'text-gray-600');
const getBiasBg     = (l) => ({ Low:'bg-green-50',    Medium:'bg-yellow-50',    High:'bg-red-50'    }[l] ?? 'bg-gray-50');
const getBiasBadge  = (l) => ({ Low:'bg-green-100 text-green-800', Medium:'bg-yellow-100 text-yellow-800', High:'bg-red-100 text-red-800' }[l] ?? 'bg-gray-100 text-gray-800');

// ── main component ────────────────────────────────────────────────────────────
export default function Home() {
  // input state
  const [input, setInput]           = useState('');       // URL or text in main bar
  const [pastedText, setPastedText] = useState('');       // article text when URL fails
  const [savedUrl, setSavedUrl]     = useState('');       // remember the URL that failed

  // flow stages: idle | extracting | needs_text | analyzing | done | error
  const [stage, setStage]           = useState('idle');
  const [summaryData, setSummaryData] = useState(null);
  const [biasData, setBiasData]     = useState(null);
  const [errorMsg, setErrorMsg]     = useState('');

  // dark mode
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const inputRef      = useRef(null);
  const pasteRef      = useRef(null);
  const resultsRef    = useRef(null);

  // ── reset everything ──────────────────────────────────────────────────────
  const reset = () => {
    setInput(''); setPastedText(''); setSavedUrl('');
    setStage('idle');
    setSummaryData(null); setBiasData(null); setErrorMsg('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ── run summarise + bias on already-retrieved content ────────────────────
  const runAnalysis = async (content, url = null) => {
    setStage('analyzing');
    setSummaryData(null); setBiasData(null);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

    try {
      // Step 1 — summarise
      const body1 = { content, action: 'get_summary', ...(url ? { url } : {}) };
      const r1 = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body1),
      });
      const d1 = await r1.json();
      if (d1.error) { setErrorMsg(d1.error); setStage('error'); return; }
      setSummaryData(d1);

      // Step 2 — bias
      const body2 = { content: d1.full_content || content, action: 'analyze_bias', ...(url ? { url } : {}) };
      const r2 = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body2),
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

  // ── main analyze — handles URL vs plain text ──────────────────────────────
  const analyze = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Plain text paste — skip scraping entirely
    if (!isUrl(trimmed)) {
      await runAnalysis(trimmed);
      return;
    }

    // URL path — try to scrape first
    setStage('extracting');
    setSummaryData(null); setBiasData(null); setErrorMsg('');

    try {
      const r = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, action: 'get_summary' }),
      });
      const d = await r.json();

      if (d.error) {
        // Scraping failed → switch to paste-text prompt
        setSavedUrl(trimmed);
        setStage('needs_text');
        setTimeout(() => pasteRef.current?.focus(), 100);
        return;
      }

      // Scraping succeeded — continue with bias
      setSummaryData(d);
      setStage('analyzing');
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

      const r2 = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, content: d.full_content, action: 'analyze_bias' }),
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

  // ── submit pasted article text ────────────────────────────────────────────
  const submitPasted = async () => {
    const trimmed = pastedText.trim();
    if (!trimmed) return;
    await runAnalysis(trimmed, savedUrl || null);
  };

  const handleKey     = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); analyze(); } };
  const loading       = stage === 'extracting' || stage === 'analyzing';

  // ── theme classes ─────────────────────────────────────────────────────────
  const bg        = dark ? 'bg-gray-950 text-gray-100'  : 'bg-white text-gray-800';
  const card      = dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200';
  const inputCls  = dark
    ? 'border-gray-600 bg-gray-900 hover:border-gray-500 focus-within:border-blue-400'
    : 'border-gray-300 bg-white hover:shadow-md focus-within:border-blue-400';
  const mutedText = dark ? 'text-gray-400' : 'text-gray-500';
  const btnBase   = dark
    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-600'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200';

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${bg}`}>

      {/* ── Dark mode toggle ──────────────────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setDark(d => !d)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${btnBase}`}
          title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {dark ? (
            <><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd"/></svg>Light</>
          ) : (
            <><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>Dark</>
          )}
        </button>
      </div>

      {/* ── Logo + input area ────────────────────────────────────────────── */}
      <div className={`flex flex-col items-center justify-center transition-all duration-500 ${stage === 'idle' ? 'flex-1' : 'pt-10 pb-6'}`}>

        {/* Logo */}
        <div className="mb-6 text-center select-none">
          <h1 className="text-5xl font-black tracking-tight">
            <span className="text-blue-600">N</span><span className="text-red-500">e</span>
            <span className="text-yellow-500">w</span><span className="text-blue-600">s</span>
            <span className="text-green-500">A</span><span className="text-red-500">p</span>
            <span className="text-blue-600">e</span><span className="text-yellow-500">x</span>
          </h1>
          <p className={`text-sm mt-1 font-medium ${mutedText}`}>Media Bias Analyzer · Powered by BERT-BABE</p>
        </div>

        {/* ── URL / text input bar ─────────────────────────────────────── */}
        <div className="w-full max-w-2xl px-4">
          <div className={`flex items-start gap-2 border rounded-2xl shadow-sm transition-all px-4 py-3 ${inputCls}`}>
            {/* icon: link or text depending on input */}
            {isUrl(input) ? (
              <svg className={`w-5 h-5 mt-1 shrink-0 ${mutedText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
              </svg>
            ) : (
              <svg className={`w-5 h-5 mt-1 shrink-0 ${mutedText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            )}

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={input.length > 120 ? 4 : 1}
              placeholder="Paste a URL or article text to analyze…"
              disabled={loading || stage === 'needs_text'}
              className={`flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder-gray-400 disabled:opacity-50 ${dark ? 'text-gray-100' : 'text-gray-800'}`}
            />

            {input && !loading && stage !== 'needs_text' && (
              <button onClick={reset} className={`mt-1 shrink-0 ${mutedText} hover:text-gray-600`} title="Clear">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={analyze}
              disabled={!input.trim() || loading || stage === 'needs_text'}
              className={`px-6 py-2.5 text-sm font-medium rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${btnBase}`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  {stage === 'extracting' ? 'Fetching article…' : 'Analyzing…'}
                </span>
              ) : 'Analyze Article'}
            </button>
            {stage !== 'idle' && (
              <button onClick={reset} className={`px-6 py-2.5 text-sm font-medium rounded-lg border transition-colors ${btnBase}`}>
                New Analysis
              </button>
            )}
          </div>

          {stage === 'idle' && (
            <p className={`text-center text-xs mt-4 ${mutedText}`}>
              Paste a news article URL <span className="mx-1 opacity-40">·</span> or paste the article text directly
            </p>
          )}
        </div>
      </div>

      {/* ── Results / Paste-text area ────────────────────────────────────── */}
      {stage !== 'idle' && (
        <div ref={resultsRef} className="w-full max-w-6xl mx-auto px-4 pb-16">

          {/* ── needs_text: scraping failed, ask user to paste ─────────── */}
          {stage === 'needs_text' && (
            <div className={`rounded-2xl border shadow-sm p-6 max-w-2xl mx-auto ${card}`}>
              {/* Header */}
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-sm">Couldn't access this article automatically</p>
                  <p className={`text-xs mt-0.5 ${mutedText}`}>
                    This site restricts automated access.
                    Open the article, select all text, copy it, and paste it below.
                  </p>
                </div>
              </div>

              {/* Original URL pill */}
              {savedUrl && (
                <div className={`flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-xs border ${dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                  <svg className={`w-3.5 h-3.5 shrink-0 ${mutedText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                  </svg>
                  <span className={`truncate ${mutedText}`}>{savedUrl}</span>
                  <a href={savedUrl} target="_blank" rel="noopener noreferrer"
                    className="ml-auto text-blue-500 hover:text-blue-600 shrink-0 font-medium">
                    Open ↗
                  </a>
                </div>
              )}

              {/* Paste area */}
              <textarea
                ref={pasteRef}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) submitPasted(); }}
                rows={8}
                placeholder="Paste the full article text here…"
                className={`w-full rounded-xl border text-sm leading-relaxed p-4 outline-none resize-none transition-colors
                  ${dark
                    ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500 focus:border-blue-400'
                    : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:bg-white'}`}
              />

              {/* Word count */}
              {pastedText.trim() && (
                <p className={`text-xs mt-1.5 ${mutedText}`}>
                  {pastedText.trim().split(/\s+/).length} words
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={submitPasted}
                  disabled={pastedText.trim().split(/\s+/).length < 30}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Analyze Pasted Text
                </button>
                <button onClick={reset}
                  className={`px-5 py-2.5 text-sm font-medium rounded-xl border transition-colors ${btnBase}`}>
                  Cancel
                </button>
              </div>

              {pastedText.trim().split(/\s+/).length < 30 && pastedText.trim().length > 0 && (
                <p className={`text-xs text-center mt-2 ${mutedText}`}>Need at least 30 words for a meaningful analysis.</p>
              )}
            </div>
          )}

          {/* ── error ─────────────────────────────────────────────────── */}
          {stage === 'error' && (
            <div className={`rounded-2xl border p-6 text-center max-w-lg mx-auto ${dark ? 'bg-red-950 border-red-800' : 'bg-red-50 border-red-200'}`}>
              <p className="text-red-500 font-bold mb-1">Analysis Failed</p>
              <p className="text-red-400 text-sm mb-4">{errorMsg}</p>
              <div className="flex gap-3 justify-center">
                <button onClick={reset}
                  className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* ── loading (extracting / analyzing before summary arrives) ── */}
          {loading && !summaryData && stage !== 'needs_text' && (
            <div className={`flex flex-col items-center py-16 ${mutedText}`}>
              <div className="w-10 h-10 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mb-4"/>
              <p className="text-sm font-medium">
                {stage === 'extracting' ? 'Fetching article content…' : 'Running analysis…'}
              </p>
            </div>
          )}

          {/* ── results ───────────────────────────────────────────────── */}
          {summaryData && (
            <div className="flex gap-6 mt-2">

              {/* Left panel */}
              <div className="w-72 shrink-0 space-y-4">

                <div className={`rounded-xl border shadow-sm p-5 ${card}`}>
                  <h4 className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${mutedText}`}>Executive Summary</h4>
                  {summaryData.summary
                    ? <p className={`text-sm leading-relaxed italic ${dark ? 'text-gray-300' : 'text-gray-700'}`}>"{summaryData.summary}"</p>
                    : <p className={`text-sm italic ${mutedText}`}>Summary unavailable.</p>}
                </div>

                {(stage === 'analyzing' || stage === 'done') && (
                  <div className={`rounded-xl border shadow-sm p-5 text-center ${biasData ? getBiasBg(biasData.bias_level) : (dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}`}>
                    {biasData ? (
                      <>
                        <div className={`text-5xl font-black mb-1 ${getBiasColor(biasData.bias_level)}`}>{biasData.bias_score}%</div>
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 ${getBiasBadge(biasData.bias_level)}`}>Bias Score</span>
                        <p className={`text-xs leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{biasData.explanation}</p>
                      </>
                    ) : (
                      <div className="flex flex-col items-center py-4">
                        <div className="w-8 h-8 border-4 border-gray-300 border-t-red-500 rounded-full animate-spin mb-3"/>
                        <p className={`text-xs font-medium uppercase tracking-widest animate-pulse ${mutedText}`}>Analyzing…</p>
                      </div>
                    )}
                  </div>
                )}

                <div className={`rounded-xl border shadow-sm p-4 ${card}`}>
                  <h4 className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${mutedText}`}>Bias Grading Scale</h4>
                  <div className="w-full h-2 rounded-full overflow-hidden flex mb-3">
                    <div className="bg-green-400 h-full w-1/2"/>
                    <div className="bg-yellow-400 h-full w-[20%]"/>
                    <div className="bg-red-500 h-full w-[30%]"/>
                  </div>
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex justify-between"><span className="text-green-600 font-bold">0% – 50%</span><span className={`italic ${mutedText}`}>Likely Factual</span></div>
                    <div className="flex justify-between"><span className="text-yellow-600 font-bold">51% – 70%</span><span className={`italic ${mutedText}`}>Likely Biased</span></div>
                    <div className="flex justify-between"><span className="text-red-600 font-bold">71% – 100%</span><span className={`italic ${mutedText}`}>Strongly Biased</span></div>
                  </div>
                </div>

                {biasData?.top_words?.length > 0 && biasData.bias_level !== 'Low' && (
                  <div className={`rounded-xl border shadow-sm p-4 ${card}`}>
                    <h4 className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${mutedText}`}>Key Biased Markers</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {biasData.top_words.map((item, idx) => (
                        <div key={idx} className={`border rounded-lg px-2.5 py-1.5 flex items-center gap-2 shadow-sm ${dark ? 'bg-gray-800 border-red-900' : 'bg-white border-red-100'}`}>
                          <span className="text-xs font-bold text-red-500">{item.word}</span>
                          <span className="text-[9px] bg-red-50 text-red-500 px-1 rounded font-mono font-bold">{item.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(savedUrl || isUrl(input.trim())) && (
                  <a href={savedUrl || input.trim()} target="_blank" rel="noopener noreferrer"
                    className={`block w-full text-center text-xs font-black uppercase tracking-widest py-3 rounded-xl transition-colors ${dark ? 'bg-gray-100 text-gray-900 hover:bg-white' : 'bg-gray-900 text-white hover:bg-black'}`}>
                    Visit Original Source
                  </a>
                )}
              </div>

              {/* Right panel */}
              <div className={`flex-1 rounded-xl border shadow-sm p-6 min-h-[400px] ${card}`}>
                <h4 className={`text-[10px] font-bold uppercase tracking-widest mb-5 ${mutedText}`}>Full Article Context</h4>

                {!biasData?.sentence_breakdown ? (
                  <div className="space-y-3">
                    {(summaryData?.full_content || '').split('\n').filter(Boolean).map((para, i) => (
                      <p key={i} className={`text-sm leading-relaxed ${mutedText}`}>{para}</p>
                    ))}
                    {stage === 'analyzing' && (
                      <div className={`mt-6 rounded-xl p-6 text-center border-2 border-dashed ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
                        <p className={`text-sm italic ${mutedText}`}>Bias highlighting will appear here after analysis…</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {biasData.sentence_breakdown.map((s, idx) => {
                      const biased = s.label === 'Biased';
                      return (
                        <span key={idx}
                          className={`inline p-0.5 rounded-sm leading-[1.9] text-sm group relative cursor-help transition-colors
                            ${biased
                              ? 'bg-red-100/80 border-b-2 border-red-300 hover:bg-red-200 text-gray-900'
                              : 'bg-green-100/60 border-b-2 border-green-200 hover:bg-green-200 text-gray-900'}`}
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
