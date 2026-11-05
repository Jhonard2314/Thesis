'use client';

import { useState } from 'react';

// Shared component for displaying bias analysis results
// Used by both BiasModal and AnalyzePage for consistent design

const getBiasColor  = (l) => ({ Low: '#10b981', Medium: '#f59e0b', High: '#ef4444' }[l] ?? '#64748b');
const getBiasBg     = (l) => ({ Low: 'rgba(16,185,129,0.08)', Medium: 'rgba(245,158,11,0.08)', High: 'rgba(239,68,68,0.08)' }[l] ?? 'rgba(226,232,240,0.5)');
const getBiasBorder = (l) => ({ Low: 'rgba(16,185,129,0.25)', Medium: 'rgba(245,158,11,0.25)', High: 'rgba(239,68,68,0.25)' }[l] ?? '#e2e8f0');
const getBiasBadge  = (l) => ({ Low: 'bg-emerald-100 text-emerald-700', Medium: 'bg-amber-100 text-amber-700', High: 'bg-red-100 text-red-700' }[l] ?? 'bg-slate-100 text-slate-600');

export default function BiasResultsPanel({ 
  biasData, 
  summaryData, 
  isLoading = false,
  articleUrl = null,
  showArticleText = true 
}) {
  const [hoveredContext, setHoveredContext] = useState(null);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-16">
        <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-4"/>
        <p className="text-sm font-medium text-slate-600">Running analysis…</p>
      </div>
    );
  }

  if (!biasData) {
    return null;
  }

  return (
    <div className="flex gap-6">
      {/* Left panel - Summary, Score, Keywords, Grading Scale */}
      <div className="w-72 shrink-0 space-y-4">
        
        {/* Executive Summary */}
        {summaryData?.summary && (
          <div className="rounded-xl p-5 bg-white border border-slate-200">
            <h4 className="text-[9px] font-bold uppercase tracking-widest mb-3 text-slate-500">
              Executive Summary
            </h4>
            <p className="text-sm leading-relaxed italic text-slate-700">
              "{summaryData.summary}"
            </p>
          </div>
        )}

        {/* Bias Score Card */}
        <div 
          className="rounded-xl p-5 text-center"
          style={{ 
            background: getBiasBg(biasData.bias_level), 
            border: `1px solid ${getBiasBorder(biasData.bias_level)}` 
          }}
        >
          <div 
            className="text-5xl font-black mb-1" 
            style={{ color: getBiasColor(biasData.bias_level) }}
          >
            {biasData.bias_score}%
          </div>
          <span className={`inline-block px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest mb-3 ${getBiasBadge(biasData.bias_level)}`}>
            Bias Score
          </span>
          <p className="text-xs leading-relaxed text-slate-600 mb-3">
            {biasData.explanation}
          </p>

          {/* Interpretation */}
          {biasData.interpretation && (
            <div className="rounded-lg p-3 mb-3 text-left bg-white border border-slate-200">
              <h5 className="text-[9px] font-bold uppercase tracking-widest mb-2 text-slate-500">
                Why This Score?
              </h5>
              <p className="text-xs leading-relaxed text-slate-700">
                {biasData.interpretation}
              </p>
            </div>
          )}

          {/* Bias Indicators */}
          {biasData.bias_indicators && biasData.bias_indicators.length > 0 && (
            <div className="text-left">
              <h5 className="text-[9px] font-bold uppercase tracking-widest mb-2 text-slate-500">
                Detected Patterns
              </h5>
              <div className="space-y-1.5">
                {biasData.bias_indicators.map((indicator, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                    <div 
                      className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" 
                      style={{ background: getBiasColor(biasData.bias_level) }}
                    />
                    <span>{indicator}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bias Grading Scale */}
        <div className="rounded-xl p-4 bg-white border border-slate-200">
          <h4 className="text-[9px] font-bold uppercase tracking-widest mb-3 text-slate-500">
            Bias Grading Scale
          </h4>
          <div className="w-full h-2 rounded-full overflow-hidden flex mb-3">
            <div className="bg-green-500 h-full" style={{ width: '50%' }}/>
            <div className="bg-yellow-400 h-full" style={{ width: '20%' }}/>
            <div className="bg-red-500 h-full" style={{ width: '30%' }}/>
          </div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-green-600 font-bold">0% – 50%</span>
              <span className="italic text-slate-500">Likely Factual</span>
            </div>
            <div className="flex justify-between">
              <span className="text-yellow-600 font-bold">51% – 70%</span>
              <span className="italic text-slate-500">Likely Biased</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-600 font-bold">71% – 100%</span>
              <span className="italic text-slate-500">Strongly Biased</span>
            </div>
          </div>
        </div>

        {/* Key Biased Markers */}
        {biasData?.top_words?.length > 0 && (
          <div className="rounded-xl p-4 bg-slate-50 border border-slate-200">
            <h4 className="text-[9px] font-bold uppercase tracking-widest mb-3 text-slate-500">
              Key Biased Markers
            </h4>
            <div className="space-y-3">
              {biasData.top_words.map((item, idx) => {
                const isLowBias = biasData.bias_level === 'Low';
                const isMediumBias = biasData.bias_level === 'Medium';
                
                let bgColor, borderColor, textColor, highlightBg, highlightBorder;
                
                if (isLowBias) {
                  bgColor = 'rgba(34,197,94,0.06)';
                  borderColor = 'rgba(34,197,94,0.2)';
                  textColor = 'rgb(22,163,74)';
                  highlightBg = 'rgba(34,197,94,0.05)';
                  highlightBorder = 'rgba(34,197,94,0.4)';
                } else if (isMediumBias) {
                  bgColor = 'rgba(245,158,11,0.06)';
                  borderColor = 'rgba(245,158,11,0.25)';
                  textColor = 'rgb(217,119,6)';
                  highlightBg = 'rgba(245,158,11,0.05)';
                  highlightBorder = 'rgba(245,158,11,0.4)';
                } else {
                  bgColor = 'rgba(220,38,38,0.06)';
                  borderColor = 'rgba(220,38,38,0.2)';
                  textColor = 'rgb(220,38,38)';
                  highlightBg = 'rgba(220,38,38,0.05)';
                  highlightBorder = 'rgba(220,38,38,0.4)';
                }
                
                return (
                  <div 
                    key={idx} 
                    className="rounded-lg p-3 transition-all cursor-pointer"
                    style={{ 
                      background: bgColor, 
                      border: `1px solid ${borderColor}`
                    }}
                    onMouseEnter={() => setHoveredContext(item.context)}
                    onMouseLeave={() => setHoveredContext(null)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-bold" style={{ color: textColor }}>
                        {item.word}
                      </span>
                      <span 
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded" 
                        style={{ 
                          color: textColor, 
                          background: isLowBias ? 'rgba(34,197,94,0.1)' : isMediumBias ? 'rgba(245,158,11,0.15)' : 'rgba(220,38,38,0.1)'
                        }}
                      >
                        {item.score}
                      </span>
                    </div>
                    
                    {item.context && (
                      <div 
                        className="mb-2 p-2 rounded" 
                        style={{ 
                          background: highlightBg, 
                          borderLeft: `2px solid ${highlightBorder}` 
                        }}
                      >
                        <p className="text-[9px] uppercase tracking-wider font-bold mb-1 text-slate-500">
                          Found in sentence:
                        </p>
                        <p className="text-[10px] leading-relaxed text-slate-700">
                          "{item.context}"
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-1.5">
                      <svg className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <p className="text-[10px] leading-relaxed italic text-slate-500">
                        {item.reason || "Biased language detected by model"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Visit Original Source Button */}
        {articleUrl && (
          <a 
            href={articleUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block w-full text-center text-xs font-black uppercase tracking-widest py-3 rounded-xl transition-colors bg-sky-500 text-white hover:bg-sky-600"
          >
            Visit Original Source
          </a>
        )}
      </div>

      {/* Right panel - Full Article Context */}
      {showArticleText && (
        <div className="flex-1 rounded-xl p-6 bg-white border border-slate-200 min-h-[400px]">
          <h4 className="text-[9px] font-bold uppercase tracking-widest mb-5 text-slate-500">
            Full Article Context
          </h4>
          {!biasData?.sentence_breakdown ? (
            <div className="space-y-3">
              {(biasData?.full_content || summaryData?.full_content || '').split('\n').filter(Boolean).map((para, i) => (
                <p key={i} className="text-sm leading-relaxed text-slate-600">{para}</p>
              ))}
            </div>
          ) : (
            <div>
              {biasData.sentence_breakdown.map((s, idx) => {
                const biased = s.label === 'Biased';
                const isHighlighted = hoveredContext && s.text && hoveredContext.includes(s.text.trim());
                
                return (
                  <span 
                    key={idx}
                    className="inline p-0.5 rounded-sm leading-[1.9] text-sm group relative cursor-help transition-all duration-200"
                    style={{
                      color: '#0f172a',
                      background: isHighlighted ? 'rgba(255,193,7,0.3)' : (biased ? 'rgba(220,38,38,0.1)' : 'rgba(22,163,74,0.08)'),
                      borderBottom: isHighlighted ? '3px solid rgba(255,193,7,1)' : (biased ? '2px solid rgba(220,38,38,0.5)' : '2px solid rgba(22,163,74,0.4)'),
                      transform: isHighlighted ? 'scale(1.02)' : 'scale(1)',
                    }}
                    title={`${s.label}: ${s.score}%`}
                  >
                    {s.text}{' '}
                    <span 
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-[10px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-48 text-center font-medium leading-normal whitespace-normal bg-white border border-slate-200"
                      style={{ color: '#0f172a' }}
                    >
                      {s.label}: {s.score}%
                      {s.reasoning && (
                        <span className="block mt-1 italic font-normal text-slate-500">
                          "{s.reasoning}"
                        </span>
                      )}
                    </span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
