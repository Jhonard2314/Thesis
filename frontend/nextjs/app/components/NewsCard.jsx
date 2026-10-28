'use client';

import { useState } from 'react';

export default function NewsCard({ article, onArticleClick }) {
  const { title, description, url, urlToImage, publishedAt, source, author } = article;
  const [imgError, setImgError] = useState(false);

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isValidImage = urlToImage && typeof urlToImage === 'string' && urlToImage.startsWith('http') && !imgError;

  return (
    <article
      onClick={() => onArticleClick?.(article)}
      className="rounded-xl overflow-hidden cursor-pointer flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-lg group"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 1px 4px var(--shadow)' }}
    >
      {/* Image */}
      <div className="relative w-full h-44 shrink-0" style={{ background: 'var(--bg-card-alt)' }}>
        {isValidImage ? (
          <img src={urlToImage} alt={title || 'News'} className="w-full h-full object-cover"
            onError={() => setImgError(true)} loading="lazy"/>
        ) : (
          <div className="flex items-center justify-center h-full opacity-20">
            <svg className="w-12 h-12" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/>
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold truncate max-w-[60%]" style={{ color: 'var(--accent)' }}>
            {source?.name || 'Unknown Source'}
          </span>
          <time className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>
            {formatDate(publishedAt)}
          </time>
        </div>

        <h2 className="text-sm font-bold leading-snug line-clamp-2 transition-colors"
          style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>

        {description && (
          <p className="text-xs leading-relaxed line-clamp-3" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        )}

        {author && (
          <p className="text-[10px] mt-auto" style={{ color: 'var(--text-subtle)' }}>By {author}</p>
        )}
      </div>
    </article>
  );
}
