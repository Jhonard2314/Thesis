'use client';

import { useState, useEffect } from "react";
import Link from 'next/link';
import NewsCard from './components/NewsCard';
import CategoryFilter from './components/CategoryFilter';
import LoadingSkeleton from './components/LoadingSkeleton';
import BiasModal from './components/BiasModal';

export default function Home() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  // Bias Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [biasData, setBiasData] = useState(null);
  const [biasLoading, setBiasLoading] = useState(false);
  const [biasError, setBiasError] = useState(null);
  const [loadingStage, setLoadingStage] = useState('extracting'); // 'extracting' or 'analyzing'

  useEffect(() => {
    fetchNews();
  }, [activeCategory]);

  const fetchNews = async (query = '') => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (query) {
        params.append('query', query);
      } else {
        params.append('category', activeCategory);
      }

      const response = await fetch(`/api/news?${params}`);
      
      let data;
      try {
        data = await response.json();
      } catch (e) {
        const text = await response.text();
        throw new Error(`Server returned non-JSON: ${text.substring(0, 100)}...`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch news');
      }

      setArticles(data.articles || []);
      setSearchQuery(query);
    } catch (err) {
      console.error('Fetch error:', err);
      // Clean up the error message for display
      let displayError = err.message;
      if (displayError.includes('Unexpected token')) {
        displayError = 'Server returned an invalid response. This usually means a Python dependency is missing on Vercel.';
      }
      setError(displayError);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query) => {
    fetchNews(query);
  };

  const handleCategoryChange = (category) => {
    setActiveCategory(category);
    setSearchQuery('');
  };

  const handleArticleClick = async (article) => {
    // Open modal with loading state for summary
    setSelectedArticle(article);
    setIsModalOpen(true);
    setBiasLoading(true);
    setLoadingStage('extracting');
    setBiasError(null);
    setBiasData(null);

    try {
      const response = await fetch('/api/bias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: article.url,
          action: 'get_summary'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get summary');
      }

      const result = await response.json();
      setBiasData(result);
    } catch (err) {
      console.error('Summary error:', err);
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
      const response = await fetch('/api/bias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: selectedArticle.url,
          action: 'analyze_bias'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze bias');
      }

      const result = await response.json();
      // Merge bias results with existing summary data
      setBiasData(prev => ({
        ...prev,
        ...result
      }));
    } catch (err) {
      console.error('Bias analysis error:', err);
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
      {/* Header */}
      <header className="bg-white shadow sticky top-0 z-50 border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">


          {/* Category Filter */}
          {!searchQuery && (
            <CategoryFilter
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
            />
          ) || (
              <CategoryFilter
                activeCategory={''}
                onCategoryChange={handleCategoryChange}
              />
            )}

          {/* Search Bar*/}
          <div className="ml-auto">
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
                  placeholder="Search for..."
                  className="w-full px-4 py-2 text-gray-800 bg-gray-50 border border-gray-200"
                />

                <button
                  type="submit"
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-800"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-4.35-4.35m1.6-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Search Query Display */}
        {submittedQuery && !loading && activeCategory === '' && (
          <div className="mb-6 text-center">
            <p className="text-gray-700">
              Showing results for <span className="font-bold">{submittedQuery}</span>
            </p>
          </div>

        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-500 mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Unable to load news</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">{error}</p>
            <button
              onClick={() => fetchNews(searchQuery)}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && <LoadingSkeleton />}

        {/* News Grid */}
        {!loading && articles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {articles.map((article, index) => (
              <NewsCard
                key={`${article.url}-${index}`}
                article={article}
                onArticleClick={handleArticleClick}
              />
            ))}
          </div>
        )}

        {/* No Results */}
        {!loading && articles.length === 0 && !error && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No articles found</h3>
            <p className="mt-1 text-sm text-gray-500">Try searching for something else or choose a different category.</p>
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

      {/* Footer */}
      <footer className="bg-[#1b1b1b] mt-16 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-300">
          <div>
            <span>
              &copy; {new Date().getFullYear()} NewsApex. All rights reserved.
            </span>
            <span className='text-blue-200 font-bold'> NEXTER </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
