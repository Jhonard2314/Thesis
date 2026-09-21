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
      className="rounded-xl overflow-hidden cursor-pointer flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-teal-900/30 group"
      style={{ background: '#112240', border: '1px solid #1E3A5F' }}
    >
      {/* Image */}
      <div className="relative w-full h-44 shrink-0" style={{ background: '#0F1E38' }}>
        {isValidImage ? (
          <img src={urlToImage} alt={title || 'News'} className="w-full h-full object-cover"
            onError={() => setImgError(true)} loading="lazy"/>
        ) : (
          <div className="flex items-center justify-center h-full opacity-20">
            <svg className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/>
            </svg>
          </div>
        )}
        {/* Teal accent line at bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: '#17C3B2', opacity: 0 }}
          ref={(el) => { if (el) el.parentElement?.parentElement?.classList.contains('group') && el.style.setProperty('opacity', '1'); }}
        />
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold truncate max-w-[60%]" style={{ color: '#17C3B2' }}>
            {source?.name || 'Unknown Source'}
          </span>
          <time className="text-[10px]" style={{ color: '#8BA3C1' }}>
            {formatDate(publishedAt)}
          </time>
        </div>

        <h2 className="text-sm font-bold leading-snug line-clamp-2 group-hover:text-teal-400 transition-colors"
          style={{ color: '#FFFFFF' }}>
          {title}
        </h2>

        {description && (
          <p className="text-xs leading-relaxed line-clamp-3" style={{ color: '#8BA3C1' }}>
            {description}
          </p>
        )}

        {author && (
          <p className="text-[10px] mt-auto" style={{ color: '#5A7A9A' }}>By {author}</p>
        )}
      </div>
    </article>
  );
}
