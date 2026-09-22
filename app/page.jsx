'use client';

import { useState, useEffect } from "react";
import Link from 'next/link';
import NewsCard from './components/NewsCard';
import CategoryFilter from './components/CategoryFilter';
import LoadingSkeleton from './components/LoadingSkeleton';
import BiasModal from './components/BiasModal';

export default function Home() {
  const [articles, setArticles]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [activeCategory, setActiveCategory] = useState('general');

  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [biasData, setBiasData]               = useState(null);
  const [biasLoading, setBiasLoading]         = useState(false);
  const [biasError, setBiasError]             = useState(null);
  const [loadingStage, setLoadingStage]       = useState('extracting');

  useEffect(() => { fetchNews(); }, [activeCategory]);

  const fetchNews = async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      params.append('category', activeCategory);
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

  return (
    <div className="min-h-screen" style={{ background: '#0B1628' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
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
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <CategoryFilter activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />

          <div className="ml-auto flex items-center gap-3">
            {/* Analyze button */}
            <Link href="/analyze"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
              style={{ background: '#17C3B2', color: '#0B1628' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
              Analyze Article
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 py-8">

        {error && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ background: '#2b0d0d' }}>
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Unable to load news</h3>
            <p className="text-sm mb-5" style={{ color: '#8BA3C1' }}>{error}</p>
            <button onClick={() => fetchNews()}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p className="text-sm" style={{ color: '#8BA3C1' }}>No articles found. Try a different category.</p>
          </div>
        )}
      </main>

      <BiasModal isOpen={isModalOpen} onClose={handleCloseModal} article={selectedArticle}
        biasData={biasData} isLoading={biasLoading} loadingStage={loadingStage}
        error={biasError} onRunBiasAnalysis={handleRunBiasAnalysis} />
    </div>
  );
}
