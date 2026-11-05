'use client';

import { useState, useRef } from "react";
import Link from 'next/link';
import BiasModal from '../components/BiasModal';

const isUrl = (str) => {
  try { new URL(str); return str.startsWith('http'); } catch { return false; }
};

const MODEL_INFO = {
  v2: { label: 'BERT-BABE v2', detail: '96% acc, 10-epoch', color: '#0FA89A' },
  v1: { label: 'BERT-BABE v1', detail: '83% acc',           color: '#6366f1' },
};

export default function AnalyzePage() {
  const [input, setInput]           = useState('');
  const [pastedText, setPastedText] = useState('');
  const [savedUrl, setSavedUrl]     = useState('');
  const [stage, setStage]           = useState('idle');   // idle | extracting | needs_text | analyzing | error
  const [summaryData, setSummaryData] = useState(null);
  const [biasData, setBiasData]     = useState(null);
  const [errorMsg, setErrorMsg]     = useState('');
  const [modalOpen, setModalOpen]   = useState(false);
  const [loadingStage, setLoadingStage] = useState('');   // 'extracting' | 'analyzing'

  const inputRef = useRef(null);
  const pasteRef = useRef(null);

  const reset = () => {
    setInput(''); setPastedText(''); setSavedUrl('');
    setStage('idle'); setSummaryData(null); setBiasData(null);
    setErrorMsg(''); setModalOpen(false); setLoadingStage('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Build a minimal "article" object for BiasModal from whatever we have
  const buildArticle = (url, text) => ({
    title: url ? url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : 'Pasted Article',
    url:   url || null,
    source: { name: url ? new URL(url).hostname.replace('www.', '') : 'Direct Input' },
    description: text?.slice(0, 200) || '',
  });

  const runAnalysis = async (content, url = null) => {
    const article = buildArticle(url, content);
    setStage('analyzing'); setLoadingStage('analyzing');
    setSummaryData(null); setBiasData(null);
    setModalOpen(true);   // open modal immediately with loading state

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
      setBiasData({ ...d2, summary: d1.summary, full_content: d1.full_content });
      setStage('done'); setLoadingStage('');
    } catch (e) {
      setErrorMsg(e.message || 'Network error');
      setStage('error');
    }
  };

  const analyze = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!isUrl(trimmed)) { await runAnalysis(trimmed); return; }

    setStage('extracting'); setLoadingStage('extracting');
    setSummaryData(null); setBiasData(null); setErrorMsg('');
    setModalOpen(true);  // open modal with extracting state

    try {
      const r = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, action: 'get_summary' }),
      });
      const d = await r.json();
      if (d.error) {
        if (d.blocked) { setErrorMsg(d.error); setStage('error'); return; }
        // Site blocks scraping — close modal, ask user to paste
        setModalOpen(false);
        setSavedUrl(trimmed); setStage('needs_text');
        setTimeout(() => pasteRef.current?.focus(), 100);
        return;
      }
      setSummaryData(d); setStage('analyzing'); setLoadingStage('analyzing');

      const r2 = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, content: d.full_content, action: 'analyze_bias' }),
      });
      const d2 = await r2.json();
      if (d2.error) { setErrorMsg(d2.error); setStage('error'); return; }
      setBiasData({ ...d2, summary: d.summary, full_content: d.full_content });
      setStage('done'); setLoadingStage('');
    } catch (e) {
      setErrorMsg(e.message || 'Network error');
      setStage('error');
    }
  };

  const submitPasted = async () => {
    const t = pastedText.trim();
    if (!t) return;
    await runAnalysis(t, savedUrl || null);
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); analyze(); } };
  const loading   = stage === 'extracting' || stage === 'analyzing';

  // Article object for modal — derived from current state
  const modalArticle = buildArticle(
    savedUrl || (isUrl(input.trim()) ? input.trim() : null),
    pastedText || input
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>

      {/* Nav */}
      <header className="sticky top-0 z-40 px-6 py-3 flex items-center justify-between"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/" className="flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          Back to News
        </Link>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
          Fine-Tuned Transformer-Based System
        </span>
      </header>

      {/* Hero + input — always centred */}
      <div className="flex flex-col items-center justify-center flex-1 px-4 py-16">
        <div className="mb-10 text-center select-none">
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--accent)' }}>
            Fine-Tuned Transformer-Based System
          </h1>
          <p className="text-xs uppercase tracking-widest mt-2" style={{ color: 'var(--text-muted)' }}>
            Bias Assessment and Summarization of English News Articles · Powered by BERT-BABE
          </p>
        </div>

        <div className="w-full max-w-2xl space-y-4">

          {/* Input bar */}
          <div className="flex items-start gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {isUrl(input) ? (
              <svg className="w-5 h-5 mt-1 shrink-0" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
              </svg>
            ) : (
              <svg className="w-5 h-5 mt-1 shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            )}
            <textarea
              ref={inputRef} value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={input.length > 120 ? 4 : 1}
              placeholder="Paste a URL or article text to analyze…"
              disabled={loading || stage === 'needs_text'}
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none disabled:opacity-50"
              style={{ color: 'var(--text-primary)', caretColor: 'var(--accent)' }}
            />
            {input && stage !== 'needs_text' && (
              <button onClick={reset} className="mt-1 shrink-0 transition-colors"
                style={{ color: 'var(--text-subtle)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* Analyze button */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={analyze}
              disabled={!input.trim() || loading || stage === 'needs_text'}
              className="px-8 py-2.5 text-sm font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent)', color: '#ffffff' }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--accent-hover)'; }}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}>
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
            {stage !== 'idle' && !loading && (
              <button onClick={reset}
                className="px-6 py-2.5 text-sm font-medium rounded-xl transition-colors"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'transparent' }}>
                Clear
              </button>
            )}
          </div>

          <p className="text-center text-xs" style={{ color: 'var(--text-subtle)' }}>
            Paste a news article URL <span className="mx-1 opacity-40">·</span> or paste the full article text
          </p>
        </div>

        {/* needs_text — site blocked scraping, ask user to paste */}
        {stage === 'needs_text' && (
          <div className="w-full max-w-2xl mt-8 rounded-2xl p-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Couldn't access this article automatically
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Open the article, select all text, copy and paste below.
                </p>
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

            <textarea
              ref={pasteRef} value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) submitPasted(); }}
              rows={8} placeholder="Paste the full article text here…"
              className="w-full rounded-xl text-sm leading-relaxed p-4 outline-none resize-none"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', caretColor: 'var(--accent)' }}
            />
            {pastedText.trim() && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)' }}>
                {pastedText.trim().split(/\s+/).length} words
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={submitPasted}
                disabled={pastedText.trim().split(/\s+/).length < 30}
                className="flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--accent)', color: '#ffffff' }}>
                Analyze Pasted Text
              </button>
              <button onClick={reset}
                className="px-5 py-2.5 text-sm font-medium rounded-xl transition-colors"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'transparent' }}>
                Cancel
              </button>
            </div>
            {pastedText.trim().split(/\s+/).length < 30 && pastedText.trim().length > 0 && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-subtle)' }}>
                Need at least 30 words.
              </p>
            )}
          </div>
        )}

        {/* Error (outside modal — for hard blocks) */}
        {stage === 'error' && !modalOpen && (
          <div className="w-full max-w-lg mt-8 rounded-2xl p-6 text-center"
            style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)' }}>
            <p className="font-bold mb-1 text-red-500">Analysis Failed</p>
            <p className="text-sm mb-4 text-red-400">{errorMsg}</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={reset} className="px-5 py-2 rounded-lg text-sm font-medium"
                style={{ background: '#ef4444', color: '#fff' }}>Try Again</button>
              {isUrl(input.trim()) && (
                <button
                  onClick={() => { setSavedUrl(input.trim()); setStage('needs_text'); setTimeout(() => pasteRef.current?.focus(), 100); }}
                  className="px-5 py-2 rounded-lg text-sm font-medium"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'transparent' }}>
                  Paste Article Text Instead
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BiasModal — opens when analysis starts, shows live loading then results */}
      <BiasModal
        isOpen={modalOpen}
        onClose={reset}
        article={modalArticle}
        biasData={biasData}
        isLoading={loading}
        loadingStage={loadingStage}
        error={stage === 'error' ? errorMsg : null}
        onRunBiasAnalysis={() => {}}
        modelVersion="v2"
        modelInfo={MODEL_INFO}
      />
    </div>
  );
}
