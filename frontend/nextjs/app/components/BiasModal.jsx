'use client';

import { useState } from 'react';

export default function BiasModal({ isOpen, onClose, article, biasData, isLoading, loadingStage, error, onRunBiasAnalysis, modelVersion = 'v2', modelInfo = {} }) {
  const [hoveredWordIdx, setHoveredWordIdx] = useState(null);
  
  if (!isOpen) return null;

  // Use model info from response if available, fall back to prop
  const activeVersion = biasData?.model_version || modelVersion;
  const activeLabel   = biasData?.model_label   || modelInfo[activeVersion]?.label  || 'BERT-BABE';
  const activeDetail  = modelInfo[activeVersion]?.detail || '';
  const activeColor   = modelInfo[activeVersion]?.color  || '#0FA89A';

  const getBiasColor  = (l) => ({ Low: '#16a34a', Medium: '#FFEB3B', High: '#dc2626' }[l] ?? 'var(--text-muted)');
  const getBiasBg     = (l) => ({ Low: 'rgba(22,163,74,0.08)', Medium: 'rgba(255,235,59,0.08)', High: 'rgba(220,38,38,0.08)' }[l] ?? 'var(--bg-card-alt)');
  const getBiasBorder = (l) => ({ Low: 'rgba(22,163,74,0.3)', Medium: 'rgba(255,235,59,0.3)', High: 'rgba(220,38,38,0.3)' }[l] ?? 'var(--border)');
  const getBiasBadge  = (l) => ({ Low: 'bg-green-100 text-green-700', Medium: 'bg-yellow-100 text-yellow-700', High: 'bg-red-100 text-red-700' }[l] ?? 'bg-slate-100 text-slate-600');

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(10,20,40,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <div>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              Media Bias Analysis
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: activeColor, color: '#fff' }}>
                {activeLabel}
              </span>
              {activeDetail && (
                <span className="text-[9px] font-normal px-2 py-0.5 rounded-full"
                  style={{ background: activeColor + '18', color: activeColor, border: `1px solid ${activeColor}35` }}>
                  {activeDetail}
                </span>
              )}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Powered by BERT-BABE Linguistic Analysis</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-alt)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left panel */}
          <div className="w-72 shrink-0 overflow-y-auto p-5 space-y-4"
            style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-primary)' }}>

            {/* Article info */}
            <div>
              <h3 className="font-bold text-sm leading-snug mb-0.5" style={{ color: 'var(--text-primary)' }}>{article?.title}</h3>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                {article?.source?.name || 'Unknown Source'}
              </p>
            </div>

            {/* Summary */}
            <div>
              <h4 className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Executive Summary</h4>
              {biasData?.summary ? (
                <div className="rounded-lg p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <p className="text-xs leading-relaxed italic" style={{ color: 'var(--text-primary)' }}>"{biasData.summary}"</p>
                </div>
              ) : (
                <div className="rounded-lg p-3" style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}>
                  <p className="text-xs italic" style={{ color: 'var(--text-subtle)' }}>Summary unavailable. Analysis can still proceed.</p>
                </div>
              )}
            </div>

            {/* Loading / Error / Results */}
            {isLoading ? (
              <div className="flex flex-col items-center py-8 rounded-xl" style={{ background: 'var(--bg-card)' }}>
                <div className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin mb-3" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}/>
                <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse" style={{ color: 'var(--accent)' }}>
                  {loadingStage === 'extracting' ? 'Extracting…' : 'Analyzing…'}
                </p>
              </div>
            ) : error ? (
              <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)' }}>
                <p className="text-red-600 text-sm font-bold mb-1">Analysis Failed</p>
                <p className="text-red-500 text-xs">{error}</p>
              </div>
            ) : biasData?.bias_level ? (
              <div className="space-y-4">
                {/* Score card */}
                <div className="rounded-xl p-4 text-center"
                  style={{ background: getBiasBg(biasData.bias_level), border: `1px solid ${getBiasBorder(biasData.bias_level)}` }}>
                  <div className="text-4xl font-black mb-1" style={{ color: getBiasColor(biasData.bias_level) }}>
                    {biasData.bias_score}%
                  </div>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest mb-1 ${getBiasBadge(biasData.bias_level)}`}>
                    Bias Score
                  </span>
                  <p className="text-[9px] font-semibold mb-2" style={{ color: activeColor }}>
                    {activeLabel}{activeDetail ? ` · ${activeDetail}` : ''}
                  </p>
                  <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>{biasData.explanation}</p>
                  
                  {/* Interpretation */}
                  {biasData.interpretation && (
                    <div className="rounded-lg p-3 mb-3 text-left" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                      <h5 className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Why This Score?</h5>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>{biasData.interpretation}</p>
                    </div>
                  )}
                  
                  {/* Bias Indicators */}
                  {biasData.bias_indicators && biasData.bias_indicators.length > 0 && (
                    <div className="text-left mb-3">
                      <h5 className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Detected Patterns</h5>
                      <div className="space-y-1.5">
                        {biasData.bias_indicators.map((indicator, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                            <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: getBiasColor(biasData.bias_level) }}/>
                            <span>{indicator}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Top biased words with explanations */}
                {biasData?.top_words?.length > 0 && biasData.bias_level !== 'Low' && (
                  <div>
                    <h4 className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Key Biased Markers</h4>
                    <div className="space-y-2">
                      {biasData.top_words.map((item, idx) => (
                        <div key={idx} 
                          className="rounded-lg p-2 transition-all"
                          style={{ 
                            background: hoveredWordIdx === idx ? 'rgba(220,38,38,0.12)' : 'rgba(220,38,38,0.06)', 
                            border: '1px solid rgba(220,38,38,0.2)'
                          }}
                          onMouseEnter={() => setHoveredWordIdx(idx)}
                          onMouseLeave={() => setHoveredWordIdx(null)}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] font-bold text-red-600">{item.word}</span>
                            <span className="text-[9px] text-red-400 font-mono bg-red-50 px-1.5 py-0.5 rounded">{item.score}</span>
                          </div>
                          <p className="text-[10px] leading-relaxed italic" style={{ color: 'var(--text-muted)' }}>
                            {item.reason || "Biased language detected by model"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <button onClick={onRunBiasAnalysis}
                  className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
                  style={{ background: activeColor, color: '#FFFFFF' }}
                  onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
                  onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}>
                  Analyze with {activeLabel}
                </button>

                {/* Grading scale */}
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <h4 className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Bias Grading Scale</h4>
                  <div className="w-full h-2 rounded-full overflow-hidden flex mb-3">
                    <div className="h-full bg-green-500" style={{ width: '45%' }}/>
                    <div className="h-full bg-yellow-400" style={{ width: '20%' }}/>
                    <div className="h-full bg-red-500" style={{ width: '35%' }}/>
                  </div>
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex justify-between"><span className="text-green-600 font-bold">0% – 50%</span><span className="italic" style={{ color: 'var(--text-muted)' }}>Likely Factual</span></div>
                    <div className="flex justify-between"><span className="text-yellow-600 font-bold">51% – 70%</span><span className="italic" style={{ color: 'var(--text-muted)' }}>Likely Biased</span></div>
                    <div className="flex justify-between"><span className="text-red-600 font-bold">71% – 100%</span><span className="italic" style={{ color: 'var(--text-muted)' }}>Strongly Biased</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right panel — article text */}
          <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--bg-card)' }}>
            <h4 className="text-[9px] font-bold uppercase tracking-widest mb-5" style={{ color: 'var(--text-muted)' }}>Full Article Context</h4>
            <div className="prose prose-sm max-w-none">
              {!biasData?.sentence_breakdown ? (
                <div className="space-y-3">
                  {(biasData?.full_content || article?.description || '').split('\n').map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{p}</p>
                  ))}
                  {!biasData?.bias_level && !isLoading && (
                    <div className="rounded-xl p-8 text-center mt-4" style={{ border: '2px dashed var(--border)' }}>
                      <p className="text-sm italic" style={{ color: 'var(--text-subtle)' }}>Run the analysis to see bias highlighting.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {biasData.sentence_breakdown.map((s, idx) => {
                    const biased = s.label === 'Biased';
                    return (
                      <span key={idx}
                        className="inline p-0.5 rounded-sm leading-[1.9] text-sm group relative cursor-help transition-colors"
                        style={{
                          color: 'var(--text-primary)',
                          background: biased ? 'rgba(220,38,38,0.1)' : 'rgba(22,163,74,0.08)',
                          borderBottom: biased ? '2px solid rgba(220,38,38,0.5)' : '2px solid rgba(22,163,74,0.4)',
                        }}
                        title={`${s.label}: ${s.score}%`}>
                        {s.text}{' '}
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-[10px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-48 text-center font-medium leading-normal whitespace-normal"
                          style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                          {s.label}: {s.score}%
                          {s.reasoning && <span className="block mt-1 italic font-normal" style={{ color: 'var(--text-muted)' }}>"{s.reasoning}"</span>}
                        </span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-3 shrink-0" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <button onClick={() => { window.open(article?.url, '_blank', 'noopener,noreferrer'); }}
            className="flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors"
            style={{ background: 'var(--accent)', color: '#FFFFFF' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}>
            Visit Original Site
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors"
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-alt)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
}
