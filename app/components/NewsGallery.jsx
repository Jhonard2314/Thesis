'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import NewsCard from './NewsCard';
import CategoryFilter from './CategoryFilter';
import LoadingSkeleton from './LoadingSkeleton';
import BiasModal from './BiasModal';

export default function NewsGallery({ dark, btnBase, muted }) {
  const [articles, setArticles]             = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryError, setGalleryError]     = useState(null);
  const [activeCategory, setActiveCategory] = useState('general');
  const [searchInput, setSearchInput]       = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  // modal
  const [modalOpen, setModalOpen]           = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [modalBiasData, setModalBiasData]   = useState(null);
  const [modalLoading, setModalLoading]     = useState(false);
  const [modalStage, setModalStage]         = useState('extracting');
  const [modalError, setModalError]         = useState(null);

  const galleryRef = useRef(null);

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchGallery = useCallback(async (query = '') => {
    setGalleryLoading(true);
    setGalleryError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.append('query', query);
      else       params.append('category', activeCategory);
      const r    = await fetch(`/api/news?${params}`);
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(`Server error: ${text.substring(0, 200)}`); }
      if (!r.ok) throw new Error(data.error || 'Failed to fetch news');
      setArticles(data.articles || []);
    } catch (err) {
      setGalleryError(err.message);
      setArticles([]);
    } finally {
      setGalleryLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => { fetchGallery(); }, [activeCategory]);

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    setSearchInput('');
    setSubmittedQuery('');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSubmittedQuery(q);
    setActiveCategory('');
    fetchGallery(q);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSubmittedQuery('');
    setActiveCategory('general');
    fetchGallery('');
  };

  // ── card click → auto-run summary + bias ──────────────────────────────────
  const handleCardClick = async (article) => {
    setSelectedArticle(article);
    setModalOpen(true);
    setModalLoading(true);
    setModalStage('extracting');
    setModalError(null);
    setModalBiasData(null);

    try {
      const r1 = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url:     article.url,
          content: article.scraped_content || undefined,
          snippet: article.description || '',
          action:  'get_summary',
        }),
      });
      const d1 = await r1.json();
      if (d1.error) { setModalError(d1.error); setModalLoading(false); return; }
      setModalBiasData(d1);

      setModalStage('analyzing');
      const r2 = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url:     article.url,
          content: d1.full_content || article.scraped_content || undefined,
          snippet: article.description || '',
          action:  'analyze_bias',
        }),
      });
      const d2 = await r2.json();
      if (d2.error) { setModalError(d2.error); setModalLoading(false); return; }
      setModalBiasData(prev => ({ ...prev, ...d2 }));
    } catch (e) {
      setModalError(e.message || 'Network error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleRunBiasAnalysis = async () => {
    if (!selectedArticle) return;
    setModalLoading(true);
    setModalStage('analyzing');
    setModalError(null);
    try {
      const r = await fetch('/api/bias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url:     selectedArticle.url,
          content: modalBiasData?.full_content || selectedArticle.scraped_content || undefined,
          snippet: selectedArticle.description || '',
          action:  'analyze_bias',
        }),
      });
      const d = await r.json();
      if (d.error) { setModalError(d.error); return; }
      setModalBiasData(prev => ({ ...prev, ...d }));
    } catch (e) {
      setModalError(e.message);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedArticle(null);
    setModalBiasData(null);
    setModalError(null);
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div ref={galleryRef} className="flex-1 max-w-7xl mx-auto w-full px-4 pb-12">

      {/* sticky header */}
      <div className={`sticky top-0 z-10 py-4 flex items-center justify-between gap-4 border-b mb-6 ${dark ? 'bg-gray-950 border-gray-700' : 'bg-white border-gray-200'}`}>
        <CategoryFilter
          activeCategory={submittedQuery ? '' : activeCategory}
          onCategoryChange={handleCategoryChange}
        />

        <form onSubmit={handleSearch} className="flex items-center gap-2 ml-auto">
          <div className={`flex items-center border rounded-lg px-3 py-1.5 text-sm transition-colors ${dark ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search news…"
              className={`outline-none bg-transparent w-44 text-sm ${dark ? 'text-gray-100 placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'}`}
            />
            <button type="submit" className={muted}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.6-5.65a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </button>
          </div>
          {submittedQuery && (
            <button type="button" onClick={clearSearch}
              className={`text-xs px-2 py-1.5 rounded-lg border transition-colors ${btnBase}`}>
              ✕ Clear
            </button>
          )}
        </form>
      </div>

      {/* search label */}
      {submittedQuery && !galleryLoading && (
        <p className={`text-sm mb-4 ${muted}`}>
          Results for <span className={`font-semibold ${dark ? 'text-gray-100' : 'text-gray-900'}`}>"{submittedQuery}"</span>
        </p>
      )}

      {/* error */}
      {galleryError && (
        <div className="text-center py-12">
          <p className="text-red-500 font-semibold mb-2">Unable to load news</p>
          <p className={`text-sm mb-4 ${muted}`}>{galleryError}</p>
          <button onClick={() => fetchGallery(submittedQuery)}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            Try Again
          </button>
        </div>
      )}

      {/* skeleton */}
      {galleryLoading && <LoadingSkeleton />}

      {/* cards */}
      {!galleryLoading && articles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {articles.map((article, i) => (
            <NewsCard key={`${article.url}-${i}`} article={article} onArticleClick={handleCardClick} />
          ))}
        </div>
      )}

      {/* no results */}
      {!galleryLoading && articles.length === 0 && !galleryError && (
        <div className="text-center py-16">
          <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {submittedQuery ? (
            <>
              <h3 className={`text-base font-semibold mb-1 ${dark ? 'text-gray-100' : 'text-gray-800'}`}>
                No results for <span className="text-blue-500">"{submittedQuery}"</span>
              </h3>
              <p className={`text-sm mb-5 ${muted}`}>No scannable articles matched your search. Try different keywords.</p>
              <button onClick={clearSearch}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                Back to General News
              </button>
            </>
          ) : (
            <p className={`text-sm ${muted}`}>No articles found. Try a different category.</p>
          )}
        </div>
      )}

      {/* modal */}
      <BiasModal
        isOpen={modalOpen}
        onClose={closeModal}
        article={selectedArticle}
        biasData={modalBiasData}
        isLoading={modalLoading}
        loadingStage={modalStage}
        error={modalError}
        onRunBiasAnalysis={handleRunBiasAnalysis}
      />
    </div>
  );
}
