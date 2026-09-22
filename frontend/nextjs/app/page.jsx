'use client';

import { useState, useEffect, useRef } from "react";
import NewsCard from './components/NewsCard';
import CategoryFilter from './components/CategoryFilter';
import LoadingSkeleton from './components/LoadingSkeleton';
import BiasModal from './components/BiasModal';

/* ── Analyze helpers ─────────────────────── */
const isUrl       = (s) => { try { new URL(s); return s.startsWith('http'); } catch { return false; } };
const getBiasColor = (l) => ({ Low: '#4CAF50', Medium: '#FFC107', High: '#F44336' }[l] ?? '#8BA3C1');
const getBiasBg    = (l) => ({ Low: '#0d2b0d', Medium: '#2b2200', High: '#2b0d0d' }[l] ?? '#0F1E38');
const getBiasBadge = (l) => ({ Low: 'bg-green-900 text-green-300', Medium: 'bg-yellow-900 text-yellow-300', High: 'bg-red-900 text-red-300' }[l] ?? 'bg-slate-700 text-slate-300');

export default function Home() {
  /* ── News feed state ──────────────────────────────────────────────────── */
  const [articles, setArticles]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [activeCategory, setActiveCategory] = useState('general');

  /* ── Search state ─────────────────────────────────────────────────────── */
  const [searchQuery, setSearchQuery]       = useState('');
  const [activeQuery, setActiveQuery]       = useState('');

  /* ── Bias modal state (news cards) ────────────────────────────────────── */
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [biasData, setBiasData]               = useState(null);
  const [biasLoading, setBiasLoading]         = useState(false);
  const [biasError, setBiasError]             = useState(null);
  const [loadingStage, setLoadingStage]       = useState('extracting');

  /* ── Inline analyze state ─────────────────────────────────────────────── */
  const [analyzeInput, setAnalyzeInput]       = useState('');
  const [analyzePastedText, setAnalyzePastedText] = useState('');
  const [analyzeSavedUrl, setAnalyzeSavedUrl] = useState('');
  const [analyzeStage, setAnalyzeStage]       = useState('idle');
  const [analyzeSummary, setAnalyzeSummary]   = useState(null);
  const [analyzeBias, setAnalyzeBias]         = useState(null);
  const [analyzeError, setAnalyzeError]       = useState('');

  const analyzeInputRef  = useRef(null);
  const analyzePasteRef  = useRef(null);
  const analyzeResultRef = useRef(null);

  /* ── Effects ──────────────────────────────────────────────────────────── */
  useEffect(() => { fetchNews(); }, [activeCategory, activeQuery]);

  /* ── News feed ────────────────────────────────────────────────────────── */
  const fetchNews = async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      params.append('category', activeCategory);
      if (activeQuery) params.append('query', activeQuery);
      const r = await fetch(`/api/news?${params}`);
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(`Server error: ${text.substring(0, 200)}`); }
      if (!r.ok) throw new Error(data.error || 'Failed to fetch news');
      setArticles(data.articles || []);
    } catch (err) { setError(err.message); setArticles([]); }
    finally { setLoading(false); }
  };

  const handleCategoryChange = (cat) => { setActiveCategory(cat); };

  const submitSearch = () => {
    const q = searchQuery.trim();
    setActiveQuery(q);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setActiveQuery('');
  };

  /* ── Bias modal (news cards) ──────────────────────────────────────────── */
  const handleArticleClick = async (article) => {
    setSelectedArticle(article); setIsModalOpen(true);
    setBiasLoading(true); setLoadingStage('extracting');
    setBiasError(null); setBiasData(null);
    try {
      const r1 = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: article.url, snippet: article.description || '', scraped_content: article.scraped_content || null, action: 'get_summary' }),
      });
      const d1 = await r1.json();
      if (d1.error) { setBiasError(d1.error); return; }
      setBiasData(d1);
    } catch (err) { setBiasError(err.message); }
    finally { setBiasLoading(false); }
  };

  const handleRunBiasAnalysis = async () => {
    if (!selectedArticle) return;
    setBiasLoading(true); setLoadingStage('analyzing'); setBiasError(null);
    try {
      const r2 = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: selectedArticle.url, content: biasData?.full_content, snippet: selectedArticle.description || '', scraped_content: selectedArticle.scraped_content || null, action: 'analyze_bias' }),
      });
      const d2 = await r2.json();
      if (d2.error) { setBiasError(d2.error); return; }
      setBiasData(prev => ({ ...prev, ...d2 }));
    } catch (err) { setBiasError(err.message); }
    finally { setBiasLoading(false); }
  };

  const handleCloseModal = () => { setIsModalOpen(false); setSelectedArticle(null); setBiasData(null); setBiasError(null); };

  /* ── Inline analyzer ──────────────────────────────────────────────────── */
  const analyzeReset = () => {
    setAnalyzeInput(''); setAnalyzePastedText(''); setAnalyzeSavedUrl('');
    setAnalyzeStage('idle'); setAnalyzeSummary(null); setAnalyzeBias(null); setAnalyzeError('');
    setTimeout(() => analyzeInputRef.current?.focus(), 50);
  };

  const analyzeRunFull = async (content, url = null) => {
    setAnalyzeStage('analyzing'); setAnalyzeSummary(null); setAnalyzeBias(null);
    setTimeout(() => analyzeResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    try {
      const r1 = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, action: 'get_summary', ...(url ? { url } : {}) }),
      });
      const d1 = await r1.json();
      if (d1.error) { setAnalyzeError(d1.error); setAnalyzeStage('error'); return; }
      setAnalyzeSummary(d1);

      const r2 = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: d1.full_content || content, action: 'analyze_bias', ...(url ? { url } : {}) }),
      });
      const d2 = await r2.json();
      if (d2.error) { setAnalyzeError(d2.error); setAnalyzeStage('error'); return; }
      setAnalyzeBias(d2); setAnalyzeStage('done');
      setTimeout(() => analyzeResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) { setAnalyzeError(e.message || 'Network error'); setAnalyzeStage('error'); }
  };

  const analyzeSubmit = async () => {
    const trimmed = analyzeInput.trim();
    if (!trimmed) return;
    if (!isUrl(trimmed)) { await analyzeRunFull(trimmed); return; }

    setAnalyzeStage('extracting'); setAnalyzeSummary(null); setAnalyzeBias(null); setAnalyzeError('');
    try {
      const r = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, action: 'get_summary' }),
      });
      const d = await r.json();
      if (d.error) {
        setAnalyzeSavedUrl(trimmed); setAnalyzeStage('needs_text');
        setTimeout(() => analyzePasteRef.current?.focus(), 100); return;
      }
      setAnalyzeSummary(d); setAnalyzeStage('analyzing');
      setTimeout(() => analyzeResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

      const r2 = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, content: d.full_content, action: 'analyze_bias' }),
      });
      const d2 = await r2.json();
      if (d2.error) { setAnalyzeError(d2.error); setAnalyzeStage('error'); return; }
      setAnalyzeBias(d2); setAnalyzeStage('done');
      setTimeout(() => analyzeResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) { setAnalyzeError(e.message || 'Network error'); setAnalyzeStage('error'); }
  };

  const analyzeSubmitPasted = async () => {
    const t = analyzePastedText.trim();
    if (!t) return;
    await analyzeRunFull(t, analyzeSavedUrl || null);
  };

  const analyzeLoading = analyzeStage === 'extracting' || analyzeStage === 'analyzing';

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen" style={{ background: '#0B1628' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50" style={{ background: '#0D1B2E', borderBottom: '1px solid #1E3A5F' }}>
        {/* Title bar */}
        <div className="max-w-7xl mx-auto px-4 py-3 text-center" style={{ borderBottom: '1px solid #1E3A5F' }}>
          <h1 className="text-lg font-black uppercase tracking-widest" style={{ color: '#17C3B2' }}>
            Fine-Tuned Transformer-Based System
          </h1>
          <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: '#8BA3C1' }}>
            Bias Assessment and Summarization of English News Articles
          </p>
        </div>

        {/* Nav bar */}
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <CategoryFilter activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />

          {/* Search bar */}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm"
              style={{ background: '#112240', border: '1px solid #1E3A5F', minWidth: '220px' }}>
              <svg className="w-3.5 h-3.5 shrink-0" style={{ color: '#8BA3C1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
                placeholder="Search articles…"
                className="flex-1 bg-transparent text-xs outline-none"
                style={{ color: '#E2EAF4', caretColor: '#17C3B2' }}
              />
              {searchQuery && (
                <button onClick={clearSearch} style={{ color: '#5A7A9A' }} className="hover:text-white transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={submitSearch}
              className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
              style={{ background: '#17C3B2', color: '#0B1628' }}>
              Search
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {/* ── Inline Analyze Panel ──────────────────────────────────────── */}
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#8BA3C1' }}>
            Analyze an Article
          </h2>

          {/* Input bar */}
            <div className={`flex gap-3 rounded-2xl px-4 py-3 ${analyzeInput.length > 120 ? 'items-start' : 'items-center'}`}
            style={{ background: '#112240', border: '1px solid #1E3A5F' }}>
            {isUrl(analyzeInput) ? (
              <svg className="w-5 h-5 shrink-0" style={{ color: '#17C3B2' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
              </svg>
            ) : (
              <svg className="w-5 h-5 shrink-0" style={{ color: '#8BA3C1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            )}
            <textarea
              ref={analyzeInputRef}
              value={analyzeInput}
              onChange={(e) => setAnalyzeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); analyzeSubmit(); } }}
              rows={analyzeInput.length > 120 ? 3 : 1}
              placeholder="Paste a URL or article text to analyze…"
              disabled={analyzeLoading || analyzeStage === 'needs_text'}
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none disabled:opacity-50 py-1"
              style={{ color: '#E2EAF4', caretColor: '#17C3B2', verticalAlign: 'middle' }}
            />
            {analyzeInput && !analyzeLoading && analyzeStage !== 'needs_text' && (
              <button onClick={analyzeReset} style={{ color: '#5A7A9A' }} className="shrink-0 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
            <button
              onClick={analyzeSubmit}
              disabled={!analyzeInput.trim() || analyzeLoading || analyzeStage === 'needs_text'}
              className="shrink-0 px-5 py-1.5 text-sm font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#17C3B2', color: '#0B1628' }}>
              {analyzeLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  {analyzeStage === 'extracting' ? 'Fetching…' : 'Analyzing…'}
                </span>
              ) : 'Analyze'}
            </button>
            {analyzeStage !== 'idle' && !analyzeLoading && (
              <button onClick={analyzeReset}
                className="shrink-0 px-4 py-1.5 text-sm font-medium rounded-xl transition-colors"
                style={{ background: 'transparent', border: '1px solid #1E3A5F', color: '#8BA3C1' }}>
                Clear
              </button>
            )}
          </div>

          {/* needs_text fallback */}
          {analyzeStage === 'needs_text' && (
            <div className="rounded-2xl p-5 mt-4" style={{ background: '#112240', border: '1px solid #1E3A5F' }}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: '#2b2200' }}>
                  <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-sm text-white">Couldn't access this article automatically</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8BA3C1' }}>Open the article, select all text, copy and paste below.</p>
                </div>
              </div>
              {analyzeSavedUrl && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: '#0D1B2E', border: '1px solid #1E3A5F' }}>
                  <span className="truncate" style={{ color: '#8BA3C1' }}>{analyzeSavedUrl}</span>
                  <a href={analyzeSavedUrl} target="_blank" rel="noopener noreferrer"
                    className="ml-auto font-medium shrink-0" style={{ color: '#17C3B2' }}>Open ↗</a>
                </div>
              )}
              <textarea
                ref={analyzePasteRef}
                value={analyzePastedText}
                onChange={(e) => setAnalyzePastedText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) analyzeSubmitPasted(); }}
                rows={7}
                placeholder="Paste the full article text here…"
                className="w-full rounded-xl text-sm leading-relaxed p-4 outline-none resize-none"
                style={{ background: '#0D1B2E', border: '1px solid #1E3A5F', color: '#E2EAF4', caretColor: '#17C3B2' }}
              />
              {analyzePastedText.trim() && (
                <p className="text-xs mt-1" style={{ color: '#5A7A9A' }}>{analyzePastedText.trim().split(/\s+/).length} words</p>
              )}
              <div className="flex gap-3 mt-3">
                <button onClick={analyzeSubmitPasted}
                  disabled={analyzePastedText.trim().split(/\s+/).length < 30}
                  className="flex-1 py-2 text-sm font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#17C3B2', color: '#0B1628' }}>
                  Analyze Pasted Text
                </button>
                <button onClick={analyzeReset}
                  className="px-5 py-2 text-sm font-medium rounded-xl transition-colors"
                  style={{ background: 'transparent', border: '1px solid #1E3A5F', color: '#8BA3C1' }}>
                  Cancel
                </button>
              </div>
              {analyzePastedText.trim().split(/\s+/).length < 30 && analyzePastedText.trim().length > 0 && (
                <p className="text-xs text-center mt-2" style={{ color: '#5A7A9A' }}>Need at least 30 words.</p>
              )}
            </div>
          )}

          {/* Error */}
          {analyzeStage === 'error' && (
            <div className="rounded-2xl p-5 mt-4 text-center max-w-lg" style={{ background: '#2b0d0d', border: '1px solid #7f1d1d' }}>
              <p className="text-red-400 font-bold mb-1">Analysis Failed</p>
              <p className="text-red-500 text-sm mb-3">{analyzeError}</p>
              <button onClick={analyzeReset} className="px-5 py-2 rounded-lg text-sm font-medium" style={{ background: '#F44336', color: '#fff' }}>Try Again</button>
            </div>
          )}

          {/* Loading spinner (before summary arrives) */}
          {analyzeLoading && !analyzeSummary && (
            <div className="flex items-center gap-3 mt-4 px-2" style={{ color: '#8BA3C1' }}>
              <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin shrink-0"/>
              <p className="text-sm">{analyzeStage === 'extracting' ? 'Fetching article content…' : 'Running analysis…'}</p>
            </div>
          )}

          {/* Results */}
          {analyzeSummary && (
            <div ref={analyzeResultRef} className="flex gap-5 mt-5">
              {/* Left panel */}
              <div className="w-64 shrink-0 space-y-4">
                <div className="rounded-xl p-4" style={{ background: '#112240', border: '1px solid #1E3A5F' }}>
                  <h4 className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#8BA3C1' }}>Executive Summary</h4>
                  {analyzeSummary.summary
                    ? <p className="text-sm leading-relaxed italic" style={{ color: '#B8C5D6' }}>"{analyzeSummary.summary}"</p>
                    : <p className="text-sm italic" style={{ color: '#5A7A9A' }}>Summary unavailable.</p>}
                </div>

                {(analyzeStage === 'analyzing' || analyzeStage === 'done') && (
                  <div className="rounded-xl p-4 text-center" style={{ background: analyzeBias ? getBiasBg(analyzeBias.bias_level) : '#112240', border: `1px solid ${analyzeBias ? getBiasColor(analyzeBias.bias_level) + '30' : '#1E3A5F'}` }}>
                    {analyzeBias ? (
                      <>
                        <div className="text-5xl font-black mb-1" style={{ color: getBiasColor(analyzeBias.bias_level) }}>{analyzeBias.bias_score}%</div>
                        <span className={`inline-block px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest mb-3 ${getBiasBadge(analyzeBias.bias_level)}`}>Bias Score</span>
                        <p className="text-xs leading-relaxed" style={{ color: '#B8C5D6' }}>{analyzeBias.explanation}</p>
                      </>
                    ) : (
                      <div className="flex flex-col items-center py-3">
                        <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-2"/>
                        <p className="text-[10px] font-medium uppercase tracking-widest animate-pulse" style={{ color: '#17C3B2' }}>Analyzing…</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Grading scale */}
                <div className="rounded-xl p-4" style={{ background: '#112240', border: '1px solid #1E3A5F' }}>
                  <h4 className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#8BA3C1' }}>Bias Grading Scale</h4>
                  <div className="w-full h-2 rounded-full overflow-hidden flex mb-2">
                    <div className="bg-green-500 h-full w-1/2"/>
                    <div className="bg-yellow-400 h-full w-[20%]"/>
                    <div className="bg-red-500 h-full w-[30%]"/>
                  </div>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between"><span className="text-green-400 font-bold">0%–50%</span><span className="italic" style={{ color: '#8BA3C1' }}>Likely Factual</span></div>
                    <div className="flex justify-between"><span className="text-yellow-400 font-bold">51%–70%</span><span className="italic" style={{ color: '#8BA3C1' }}>Likely Biased</span></div>
                    <div className="flex justify-between"><span className="text-red-400 font-bold">71%–100%</span><span className="italic" style={{ color: '#8BA3C1' }}>Strongly Biased</span></div>
                  </div>
                </div>

                {/* Top biased words */}
                {analyzeBias?.top_words?.length > 0 && analyzeBias.bias_level !== 'Low' && (
                  <div className="rounded-xl p-4" style={{ background: '#112240', border: '1px solid #1E3A5F' }}>
                    <h4 className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#8BA3C1' }}>Key Biased Markers</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {analyzeBias.top_words.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: '#1A0808', border: '1px solid #7f1d1d' }}>
                          <span className="text-[11px] font-bold text-red-400">{item.word}</span>
                          <span className="text-[9px] text-red-600 font-mono">{item.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Visit source */}
                {(analyzeSavedUrl || isUrl(analyzeInput.trim())) && (
                  <a href={analyzeSavedUrl || analyzeInput.trim()} target="_blank" rel="noopener noreferrer"
                    className="block w-full text-center text-xs font-black uppercase tracking-widest py-2.5 rounded-xl transition-colors"
                    style={{ background: '#17C3B2', color: '#0B1628' }}>
                    Visit Original Source
                  </a>
                )}
              </div>

              {/* Right panel — article with sentence highlighting */}
              <div className="flex-1 rounded-xl p-6 min-h-[300px]" style={{ background: '#112240', border: '1px solid #1E3A5F' }}>
                <h4 className="text-[9px] font-bold uppercase tracking-widest mb-4" style={{ color: '#8BA3C1' }}>Full Article Context</h4>
                {!analyzeBias?.sentence_breakdown ? (
                  <div className="space-y-3">
                    {(analyzeSummary?.full_content || '').split('\n').filter(Boolean).map((para, i) => (
                      <p key={i} className="text-sm leading-relaxed" style={{ color: '#5A7A9A' }}>{para}</p>
                    ))}
                    {analyzeStage === 'analyzing' && (
                      <div className="mt-4 rounded-xl p-5 text-center" style={{ border: '2px dashed #1E3A5F' }}>
                        <p className="text-sm italic" style={{ color: '#5A7A9A' }}>Bias highlighting will appear here after analysis…</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {analyzeBias.sentence_breakdown.map((s, idx) => {
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
        </section>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid #1E3A5F' }}/>

        {/* ── News feed ─────────────────────────────────────────────────── */}
        <section>
          {activeQuery && (
            <div className="flex items-center gap-2 mb-4">
              <p className="text-sm" style={{ color: '#8BA3C1' }}>
                Results for <span className="font-bold" style={{ color: '#17C3B2' }}>"{activeQuery}"</span>
              </p>
              <button onClick={clearSearch} className="text-xs px-2 py-0.5 rounded-full transition-colors"
                style={{ background: '#112240', border: '1px solid #1E3A5F', color: '#8BA3C1' }}>
                Clear ×
              </button>
            </div>
          )}

          {error && (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ background: '#2b0d0d' }}>
                <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Unable to load news</h3>
              <p className="text-sm mb-5" style={{ color: '#8BA3C1' }}>{error}</p>
              <button onClick={fetchNews}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: '#17C3B2', color: '#0B1628' }}>Try Again</button>
            </div>
          )}

          {loading && <LoadingSkeleton />}

          {!loading && articles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {articles.map((article, i) => (
                <NewsCard key={`${article.url}-${i}`} article={article} onArticleClick={handleArticleClick} />
              ))}
            </div>
          )}

          {!loading && articles.length === 0 && !error && (
            <div className="text-center py-20">
              <svg className="mx-auto h-12 w-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#17C3B2' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
              </svg>
              {activeQuery ? (
                <>
                  <p className="text-sm font-semibold text-white mb-1">No results for "{activeQuery}"</p>
                  <p className="text-xs mb-4" style={{ color: '#8BA3C1' }}>Try a different search term or browse by category.</p>
                  <button onClick={clearSearch}
                    className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                    style={{ background: '#112240', border: '1px solid #1E3A5F', color: '#17C3B2' }}>
                    Clear search
                  </button>
                </>
              ) : (
                <p className="text-sm" style={{ color: '#8BA3C1' }}>No articles found. Try a different category.</p>
              )}
            </div>
          )}
        </section>
      </main>

      <BiasModal isOpen={isModalOpen} onClose={handleCloseModal} article={selectedArticle}
        biasData={biasData} isLoading={biasLoading} loadingStage={loadingStage}
        error={biasError} onRunBiasAnalysis={handleRunBiasAnalysis} />
    </div>
  );
}
