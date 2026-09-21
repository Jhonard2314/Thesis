'use client';

import { useState, useEffect } from "react";
import Link from 'next/link';
import NewsCard from './components/NewsCard';
import CategoryFilter from './components/CategoryFilter';
import LoadingSkeleton from './components/LoadingSkeleton';
import BiasModal from './components/BiasModal';

export default function Home() {
  const [articles, setArticles]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [activeCategory, setActiveCategory] = useState('general');
  const [searchQuery, setSearchQuery]   = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  // Bias Modal State
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [biasData, setBiasData]             = useState(null);
  const [biasLoading, setBiasLoading]       = useState(false);
  const [biasError, setBiasError]           = useState(null);
  const [loadingStage, setLoadingStage]     = useState('extracting');

  useEffect(() => { fetchNews(); }, [activeCategory]);

  const fetchNews = async (query = '') => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.append('query', query);
      else       params.append('category', activeCategory);

      const response = await fetch(`/api/news?${params}`);
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); }
      catch (e) { throw new Error(`Server error: ${text.substring(0, 200)}`); }
      if (!response.ok) throw new Error(data.error || 'Failed to fetch news');
      setArticles(data.articles || []);
      setSearchQuery(query);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch      = (query) => fetchNews(query);
  const handleCategoryChange = (category) => { setActiveCategory(category); setSearchQuery(''); };

  const handleArticleClick = async (article) => {
    setSelectedArticle(article);
    setIsModalOpen(true);
    setBiasLoading(true);
    setLoadingStage('extracting');
    setBiasError(null);
    setBiasData(null);
    try {
      const r1 = await fetch('/api/bias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url:             article.url,
          snippet:         article.description || '',
          scraped_content: article.scraped_content || null,
          action:          'get_summary',
        }),
      });
      if (!r1.ok) { const e = await r1.json(); throw new Error(e.error || 'Failed to get summary'); }
      const d1 = await r1.json();
      setBiasData(d1);
    } catch (err) {
      setBiasError(err.message);
    } finally {
      setBiasLoading(false);
    }
  };

  const handleRunBiasAnalysis = async () => {
    if (!selectedArticle) return;
    setBiasLoading(true);
    setLoadingStage('analyzing');
    setBiasError(null);
    try {
      const r2 = await fetch('/api/bias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url:             selectedArticle.url,
          content:         biasData?.full_content,
          snippet:         selectedArticle.description || '',
          scraped_content: selectedArticle.scraped_content || null,
          action:          'analyze_bias',
        }),
      });
      if (!r2.ok) { const e = await r2.json(); throw new Error(e.error || 'Failed to analyze bias'); }
      const d2 = await r2.json();
      setBiasData(prev => ({ ...prev, ...d2 }));
    } catch (err) {
      setBiasError(err.message);
    } finally {
      setBiasLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedArticle(null);
    setBiasData(null);
    setBiasError(null);
  };

  return (
    <div className="min-h-screen bg-white text-gray-800">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white shadow sticky top-0 z-50 border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">

          {/* Category filter — hides during search */}
          {!searchQuery ? (
            <CategoryFilter activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />
          ) : (
            <CategoryFilter activeCategory="" onCategoryChange={handleCategoryChange} />
          )}

          {/* Right side: search + analyze link */}
          <div className="ml-auto flex items-center gap-3">

            {/* Search bar */}
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!searchQuery.trim()) return;
              setSubmittedQuery(searchQuery.trim());
              setActiveCategory('');
              handleSearch(searchQuery);
            }} className="w-full max-w-md mb-0">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search news…"
                  className="w-full px-4 py-2 text-gray-800 bg-gray-50 border border-gray-200 rounded-lg pr-10"
                />
                <button type="submit"
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-800">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.6-5.65a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </button>
              </div>
            </form>

            {/* Analyze Article button → /analyze page */}
            <Link href="/analyze"
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
              Analyze Article
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Search label */}
        {submittedQuery && !loading && activeCategory === '' && (
          <div className="mb-6 text-center">
            <p className="text-gray-700">
              Showing results for <span className="font-bold">{submittedQuery}</span>
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-500 mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Unable to load news</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">{error}</p>
            <button onClick={() => fetchNews(searchQuery)}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Try Again
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && <LoadingSkeleton />}

        {/* Grid */}
        {!loading && articles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {articles.map((article, index) => (
              <NewsCard key={`${article.url}-${index}`} article={article} onArticleClick={handleArticleClick} />
            ))}
          </div>
        )}

        {/* No results */}
        {!loading && articles.length === 0 && !error && (
          <div className="text-center py-16">
            <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {submittedQuery ? (
              <>
                <h3 className="text-base font-semibold text-gray-800 mb-1">
                  No results for <span className="text-blue-600">"{submittedQuery}"</span>
                </h3>
                <p className="text-sm text-gray-500 mb-5">No scannable articles matched your search.</p>
                <button onClick={() => { setSubmittedQuery(''); setSearchQuery(''); setActiveCategory('general'); }}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  Back to General News
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-500">No articles found. Try a different category.</p>
            )}
          </div>
        )}
      </main>

      {/* Bias Modal */}
      <BiasModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        article={selectedArticle}
        biasData={biasData}
        isLoading={biasLoading}
        loadingStage={loadingStage}
        error={biasError}
        onRunBiasAnalysis={handleRunBiasAnalysis}
      />
    </div>
  );
}
