'use client';

import { useState } from 'react';

// Exact copy of BiasModal's left + right panel rendering.
// Used by the /analyze page so it looks identical to the modal.

const getBiasColor  = (l) => ({ Low: '#10b981', Medium: '#f59e0b', High: '#ef4444' }[l] ?? 'var(--text-muted)');
const getBiasBg     = (l) => ({ Low: 'rgba(16,185,129,0.08)', Medium: 'rgba(245,158,11,0.08)', High: 'rgba(239,68,68,0.08)' }[l] ?? 'var(--bg-card-alt)');
const getBiasBorder = (l) => ({ Low: 'rgba(16,185,129,0.25)', Medium: 'rgba(245,158,11,0.25)', High: 'rgba(239,68,68,0.25)' }[l] ?? 'var(--border)');
const getBiasBadge  = (l) => ({ Low: 'bg-emerald-100 text-emerald-700', Medium: 'bg-amber-100 text-amber-700', High: 'bg-red-100 text-red-700' }[l] ?? 'bg-slate-100 text-slate-600');

export default function BiasResultsPanel({
  biasData,
  summaryData,
  isLoading = false,
  loadingStage = null,
  articleUrl = null,
  showArticleText = true,
}) {
  const [hoveredWord, setHoveredWord] = useState(null);

  // While bias is still loading but we already have summary
  const showLoadingScore = isLoading && !biasData;

  return (
    <div className="flex gap-0 mt-2 rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--border)', minHeight: 500 }}>

      {/* ── LEFT PANEL — exact clone of BiasModal left panel ── */}
      <div className="w-72 shrink-0 overflow-y-auto p-5 space-y-4"
        style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-primary)' }}>

        {/* Summary */}
        <div>
          <h4 className="text-[9px] font-bold uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-muted)' }}>Executive Summary</h4>
          {summaryData?.summary ? (
            <div className="rounded-lg p-3"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-xs leading-relaxed italic"
                style={{ color: 'var(--text-primary)' }}>"{summaryData.summary}"</p>
            </div>
          ) : (
            <div className="rounded-lg p-3"
              style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}>
              <p className="text-xs italic"
                style={{ color: 'var(--text-subtle)' }}>Summary unavailable. Analysis can still proceed.</p>
            </div>
          )}
        </div>

        {/* Loading spinner */}
        {showLoadingScore && (
          <div className="flex flex-col items-center py-8 rounded-xl"
            style={{ background: 'var(--bg-card)' }}>
            <div className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin mb-3"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}/>
            <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse"
              style={{ color: 'var(--accent)' }}>
              {loadingStage === 'extracting' ? 'Extracting…' : 'Analyzing…'}
            </p>
          </div>
        )}

        {/* Results */}
        {biasData?.bias_level && (
          <div className="space-y-4">

            {/* Score card */}
            <div className="rounded-xl p-4 text-center"
              style={{ background: getBiasBg(biasData.bias_level), border: `1px solid ${getBiasBorder(biasData.bias_level)}` }}>
              <div className="text-4xl font-black mb-1"
                style={{ color: getBiasColor(biasData.bias_level) }}>
                {biasData.bias_score}%
              </div>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest mb-1 ${getBiasBadge(biasData.bias_level)}`}>
                Bias Score
              </span>
              <p className="text-xs leading-relaxed mt-2"
                style={{ color: 'var(--text-muted)' }}>{biasData.explanation}</p>

              {biasData.interpretation && (
                <div className="rounded-lg p-3 mt-3 text-left"
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                  <h5 className="text-[9px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: 'var(--text-muted)' }}>Why This Score?</h5>
                  <p className="text-xs leading-relaxed"
                    style={{ color: 'var(--text-primary)' }}>{biasData.interpretation}</p>
                </div>
              )}

              {biasData.bias_indicators?.length > 0 && (
                <div className="text-left mt-3">
                  <h5 className="text-[9px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: 'var(--text-muted)' }}>Detected Patterns</h5>
                  <div className="space-y-1.5">
                    {biasData.bias_indicators.map((ind, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs"
                        style={{ color: 'var(--text-muted)' }}>
                        <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0"
                          style={{ background: getBiasColor(biasData.bias_level) }}/>
                        <span>{ind}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Key Biased Markers — exact BiasModal rendering */}
            {biasData.top_words?.length > 0 && (
              <div>
                <h4 className="text-[9px] font-bold uppercase tracking-widest mb-3"
                  style={{ color: 'var(--text-muted)' }}>
                  {biasData.bias_level === 'Low' ? 'Biased Language Detected' : 'Key Biased Markers'}
                </h4>
                <div className="space-y-3">
                  {biasData.top_words.map((item, idx) => {
                    const isLow = biasData.bias_level === 'Low';
                    const isMed = biasData.bias_level === 'Medium';
                    const bgColor       = isLow ? 'rgba(34,197,94,0.06)'  : isMed ? 'rgba(245,158,11,0.06)'  : 'rgba(220,38,38,0.06)';
                    const borderColor   = isLow ? 'rgba(34,197,94,0.2)'   : isMed ? 'rgba(245,158,11,0.25)'  : 'rgba(220,38,38,0.2)';
                    const textColor     = isLow ? 'rgb(22,163,74)'        : isMed ? 'rgb(217,119,6)'          : 'rgb(220,38,38)';
                    const highlightBg   = isLow ? 'rgba(34,197,94,0.05)'  : isMed ? 'rgba(245,158,11,0.05)'  : 'rgba(220,38,38,0.05)';
                    const highlightBd   = isLow ? 'rgba(34,197,94,0.4)'   : isMed ? 'rgba(245,158,11,0.4)'   : 'rgba(220,38,38,0.4)';
                    const scoreBg       = isLow ? 'rgba(34,197,94,0.1)'   : isMed ? 'rgba(245,158,11,0.15)'  : 'rgba(220,38,38,0.1)';

                    return (
                      <div key={idx}
                        className="rounded-lg p-3 transition-all cursor-pointer"
                        style={{ background: bgColor, border: `1px solid ${borderColor}` }}
                        onMouseEnter={() => setHoveredWord(item.context || item.word)}
                        onMouseLeave={() => setHoveredWord(null)}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[13px] font-bold" style={{ color: textColor }}>{item.word}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                            style={{ color: textColor, background: scoreBg }}>{item.score}</span>
                        </div>
                        {item.context && (
                          <div className="mb-2 p-2 rounded"
                            style={{ background: highlightBg, borderLeft: `2px solid ${highlightBd}` }}>
                            <p className="text-[9px] uppercase tracking-wider font-bold mb-1"
                              style={{ color: 'var(--text-muted)' }}>Found in sentence:</p>
                            <p className="text-[10px] leading-relaxed"
                              style={{ color: 'var(--text-primary)' }}>"{item.context}"</p>
                          </div>
                        )}
                        <div className="flex items-start gap-1.5">
                          <svg className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                          </svg>
                          <p className="text-[10px] leading-relaxed italic"
                            style={{ color: 'var(--text-muted)' }}>
                            {item.reason || 'Biased language detected by model'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grading scale */}
            <div className="rounded-xl p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <h4 className="text-[9px] font-bold uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)' }}>Bias Grading Scale</h4>
              <div className="w-full h-2 rounded-full overflow-hidden flex mb-3">
                <div className="h-full bg-green-500" style={{ width: '45%' }}/>
                <div className="h-full bg-yellow-400" style={{ width: '20%' }}/>
                <div className="h-full bg-red-500" style={{ width: '35%' }}/>
              </div>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-green-600 font-bold">0% – 50%</span>
                  <span className="italic" style={{ color: 'var(--text-muted)' }}>Likely Factual</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-600 font-bold">51% – 70%</span>
                  <span className="italic" style={{ color: 'var(--text-muted)' }}>Likely Biased</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-600 font-bold">71% – 100%</span>
                  <span className="italic" style={{ color: 'var(--text-muted)' }}>Strongly Biased</span>
                </div>
              </div>
            </div>

            {/* Visit source */}
            {articleUrl && (
              <a href={articleUrl} target="_blank" rel="noopener noreferrer"
                className="block w-full text-center text-xs font-black uppercase tracking-widest py-2.5 rounded-xl transition-colors"
                style={{ background: 'var(--accent)', color: '#fff' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}>
                Visit Original Source
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL — exact clone of BiasModal right panel ── */}
      {showArticleText && (
        <div className="flex-1 overflow-y-auto p-6"
          style={{ background: 'var(--bg-card)' }}>
          <h4 className="text-[9px] font-bold uppercase tracking-widest mb-5"
            style={{ color: 'var(--text-muted)' }}>Full Article Context</h4>
          <div className="prose prose-sm max-w-none">
            {!biasData?.sentence_breakdown ? (
              <div className="space-y-3">
                {(summaryData?.full_content || '').split('\n').filter(Boolean).map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed"
                    style={{ color: 'var(--text-muted)' }}>{para}</p>
                ))}
                {isLoading && (
                  <div className="mt-6 rounded-xl p-6 text-center"
                    style={{ border: '2px dashed var(--border)' }}>
                    <p className="text-sm italic"
                      style={{ color: 'var(--text-subtle)' }}>
                      Bias highlighting will appear here after analysis…
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {biasData.sentence_breakdown.map((s, idx) => {
                  const biased = s.label === 'Biased';
                  // highlight sentence when its keyword is hovered on the left
                  const isHighlighted = hoveredWord && s.text &&
                    s.text.toLowerCase().includes(hoveredWord.toLowerCase().trim().slice(0, 20));

                  return (
                    <span key={idx}
                      className="inline p-0.5 rounded-sm leading-[1.9] text-sm group relative cursor-help transition-colors"
                      style={{
                        color: 'var(--text-primary)',
                        background: isHighlighted
                          ? 'rgba(255,193,7,0.25)'
                          : biased ? 'rgba(220,38,38,0.1)' : 'rgba(22,163,74,0.08)',
                        borderBottom: isHighlighted
                          ? '2px solid rgba(255,193,7,0.9)'
                          : biased ? '2px solid rgba(220,38,38,0.5)' : '2px solid rgba(22,163,74,0.4)',
                      }}
                      title={`${s.label}: ${s.score}%`}>
                      {s.text}{' '}
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-[10px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-48 text-center font-medium leading-normal whitespace-normal"
                        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                        {s.label}: {s.score}%
                        {s.reasoning && (
                          <span className="block mt-1 italic font-normal"
                            style={{ color: 'var(--text-muted)' }}>"{s.reasoning}"</span>
                        )}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
