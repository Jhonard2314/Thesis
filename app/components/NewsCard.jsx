'use client';

import { useState } from 'react';

export default function NewsCard({ article, onArticleClick }) {
  const {
    title,
    description,
    url,
    urlToImage,
    publishedAt,
    source,
    author,
    content,
    scrapable,
    snippet_only,
  } = article;

  const [imgError, setImgError] = useState(false);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isValidImage =
    urlToImage &&
    typeof urlToImage === "string" &&
    urlToImage.startsWith("http") &&
    !imgError;

  // Determine scan badge
  const scanBadge = scrapable
    ? snippet_only
      ? { label: '◑ Snippet Scan', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' }
      : { label: '✓ Full Scan', color: 'bg-green-100 text-green-700 border-green-200' }
    : null;

  const handleClick = (e) => {
    e.preventDefault();
    if (onArticleClick) {
      onArticleClick(article);
    }
  };

  return (
    <article className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer h-full flex flex-col">
      <button
        onClick={handleClick}
        className="block w-full text-left hover:opacity-95 transition-opacity h-full flex flex-col"
        style={{ border: 'none', background: 'none', padding: 0 }}
      >
        <div className="relative w-full h-48 bg-gray-100 shrink-0">
          {isValidImage ? (
            <img
              src={urlToImage}
              alt={title || 'News image'}
              className="w-full h-full object-cover"
              onError={() => {
                setImgError(true);
              }}
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-300 bg-gray-50 border-b border-gray-100">
              <span className="text-2xl opacity-50">📰</span>
            </div>
          )}

          {/* Scan badge — top-right corner of image */}
          {scanBadge && (
            <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full border ${scanBadge.color}`}>
              {scanBadge.label}
            </span>
          )}
        </div>

        <div className="p-5 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-blue-600">
              {source?.name || 'Unknown Source'}
            </span>
            <time className="text-xs text-gray-500">
              {formatDate(publishedAt)}
            </time>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2 hover:text-blue-600 transition-colors">
            {title}
          </h2>

          {description && (
            <p className="text-gray-600 text-sm line-clamp-3 mb-3">
              {description}
            </p>
          )}

          {author && (
            <p className="text-xs text-gray-500">
              By {author}
            </p>
          )}
        </div>
      </button>
    </article>
  );
}
