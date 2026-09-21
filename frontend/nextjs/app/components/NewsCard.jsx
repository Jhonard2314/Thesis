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
  } = article;

  const [imgError, setImgError] = useState(false);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isValidImage =
    urlToImage &&
    typeof urlToImage === 'string' &&
    urlToImage.startsWith('http') &&
    !imgError;

  const handleClick = (e) => {
    e.preventDefault();
    if (onArticleClick) onArticleClick(article);
  };

  return (
    <article className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer h-full flex flex-col hover:-translate-y-0.5">
      <button
        onClick={handleClick}
        className="block w-full text-left h-full flex flex-col"
        style={{ border: 'none', background: 'none', padding: 0 }}
      >
        {/* Image */}
        <div className="relative w-full h-48 bg-gray-100 shrink-0">
          {isValidImage ? (
            <img
              src={urlToImage}
              alt={title || 'News image'}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-300 bg-gray-50 border-b border-gray-100">
              <span className="text-2xl opacity-50">📰</span>
            </div>
          )}

          {/* Guaranteed full-scan badge — all gallery articles have cached content */}
          <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-green-100 text-green-700 border-green-200">
            ✓ Scannable
          </span>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-600 truncate max-w-[60%]">
              {source?.name || 'Unknown Source'}
            </span>
            <time className="text-[10px] text-gray-400 shrink-0">
              {formatDate(publishedAt)}
            </time>
          </div>

          <h2 className="text-sm font-bold text-gray-900 mb-2 line-clamp-2 hover:text-blue-600 transition-colors leading-snug">
            {title}
          </h2>

          {description && (
            <p className="text-gray-500 text-xs line-clamp-3 leading-relaxed">
              {description}
            </p>
          )}

          {author && (
            <p className="text-[10px] text-gray-400 mt-auto pt-2">
              By {author}
            </p>
          )}
        </div>
      </button>
    </article>
  );
}
