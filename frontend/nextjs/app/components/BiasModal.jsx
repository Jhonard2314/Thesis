'use client';

export default function BiasModal({ isOpen, onClose, article, biasData, isLoading, loadingStage, error, onRunBiasAnalysis }) {
  if (!isOpen) return null;

  const getBiasColor = (l) => ({ Low: '#4CAF50', Medium: '#FFC107', High: '#F44336' }[l] ?? '#8BA3C1');
  const getBiasBg    = (l) => ({ Low: '#0d2b0d', Medium: '#2b2200', High: '#2b0d0d' }[l] ?? '#0F1E38');
  const getBiasBadge = (l) => ({ Low: 'bg-green-900 text-green-300', Medium: 'bg-yellow-900 text-yellow-300', High: 'bg-red-900 text-red-300' }[l] ?? 'bg-slate-700 text-slate-300');

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(5,10,20,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        style={{ background: '#0D1B2E', border: '1px solid #1E3A5F' }}>

        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center shrink-0"
          style={{ borderBottom: '1px solid #1E3A5F' }}>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Media Bias Analysis
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full" style={{ background: '#17C3B2', color: '#0B1628' }}>
                BERT-BABE
              </span>
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#8BA3C1' }}>Powered by BERT-BABE Linguistic Analysis</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-slate-700/50">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left panel */}
          <div className="w-72 shrink-0 overflow-y-auto p-5 space-y-4" style={{ borderRight: '1px solid #1E3A5F', background: '#0B1628' }}>

            {/* Article info */}
            <div>
              <h3 className="font-bold text-white text-sm leading-snug mb-0.5">{article?.title}</h3>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#17C3B2' }}>
                {article?.source?.name || 'Unknown Source'}
              </p>
            </div>

            {/* Summary */}
            <div>
              <h4 className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#8BA3C1' }}>Executive Summary</h4>
              {biasData?.summary ? (
                <div className="rounded-lg p-3" style={{ background: '#112240', border: '1px solid #1E3A5F' }}>
                  <p className="text-xs text-white leading-relaxed italic">"{biasData.summary}"</p>
                </div>
              ) : (
                <div className="rounded-lg p-3" style={{ background: '#112240', border: '1px dashed #1E3A5F' }}>
                  <p className="text-xs italic" style={{ color: '#5A7A9A' }}>Summary unavailable. Analysis can still proceed.</p>
                </div>
              )}
            </div>

            {/* Loading / Error / Results */}
            {isLoading ? (
              <div className="flex flex-col items-center py-8 rounded-xl" style={{ background: '#112240' }}>
                <div className="w-9 h-9 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mb-3"/>
                <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse" style={{ color: '#17C3B2' }}>
                  {loadingStage === 'extracting' ? 'Extracting…' : 'Analyzing…'}
                </p>
              </div>
            ) : error ? (
              <div className="rounded-xl p-4 text-center" style={{ background: '#2b0d0d', border: '1px solid #7f1d1d' }}>
                <p className="text-red-400 text-sm font-bold mb-1">Analysis Failed</p>
                <p className="text-red-500 text-xs">{error}</p>
              </div>
            ) : biasData?.bias_level ? (
              <div className="space-y-4">
                {/* Score card */}
                <div className="rounded-xl p-4 text-center" style={{ background: getBiasBg(biasData.bias_level), border: `1px solid ${getBiasColor(biasData.bias_level)}30` }}>
                  <div className="text-4xl font-black mb-1" style={{ color: getBiasColor(biasData.bias_level) }}>
                    {biasData.bias_score}%
                  </div>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest mb-2 ${getBiasBadge(biasData.bias_level)}`}>
                    Bias Score
                  </span>
                  <p className="text-xs leading-relaxed" style={{ color: '#B8C5D6' }}>{biasData.explanation}</p>
                </div>

                {/* Top biased words */}
                {biasData?.top_words?.length > 0 && biasData.bias_level !== 'Low' && (
                  <div>
                    <h4 className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#8BA3C1' }}>Key Biased Markers</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {biasData.top_words.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                          style={{ background: '#1A0808', border: '1px solid #7f1d1d' }}>
                          <span className="text-[11px] font-bold text-red-400">{item.word}</span>
                          <span className="text-[9px] text-red-600 font-mono">{item.score}</span>
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
                  style={{ background: '#17C3B2', color: '#0B1628' }}
                  onMouseEnter={(e) => e.target.style.background = '#0FA89A'}
                  onMouseLeave={(e) => e.target.style.background = '#17C3B2'}>
                  Start Deep Analysis
                </button>

                {/* Grading scale */}
                <div className="rounded-xl p-4" style={{ background: '#112240', border: '1px solid #1E3A5F' }}>
                  <h4 className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: '#8BA3C1' }}>Bias Grading Scale</h4>
                  <div className="w-full h-2 rounded-full overflow-hidden flex mb-3">
                    <div className="h-full w-1/2 bg-green-500"/>
                    <div className="h-full w-[20%] bg-yellow-400"/>
                    <div className="h-full w-[30%] bg-red-500"/>
                  </div>
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex justify-between"><span className="text-green-400 font-bold">0% - 50%</span><span className="italic" style={{ color: '#8BA3C1' }}>Likely Factual</span></div>
                    <div className="flex justify-between"><span className="text-yellow-400 font-bold">51% - 70%</span><span className="italic" style={{ color: '#8BA3C1' }}>Likely Biased</span></div>
                    <div className="flex justify-between"><span className="text-red-400 font-bold">71% - 100%</span><span className="italic" style={{ color: '#8BA3C1' }}>Strongly Biased</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right panel — article text */}
          <div className="flex-1 overflow-y-auto p-6" style={{ background: '#0D1B2E' }}>
            <h4 className="text-[9px] font-bold uppercase tracking-widest mb-5" style={{ color: '#8BA3C1' }}>Full Article Context</h4>
            <div className="prose prose-sm max-w-none">
              {!biasData?.sentence_breakdown ? (
                <div className="space-y-3">
                  {(biasData?.full_content || article?.description || '').split('\n').map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed" style={{ color: '#5A7A9A' }}>{p}</p>
                  ))}
                  {!biasData?.bias_level && !isLoading && (
                    <div className="rounded-xl p-8 text-center mt-4" style={{ border: '2px dashed #1E3A5F' }}>
                      <p className="text-sm italic" style={{ color: '#5A7A9A' }}>Run the analysis to see bias highlighting.</p>
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
                          color: '#E2EAF4',
                          background: biased ? 'rgba(244,67,54,0.15)' : 'rgba(76,175,80,0.1)',
                          borderBottom: biased ? '2px solid rgba(244,67,54,0.6)' : '2px solid rgba(76,175,80,0.4)',
                        }}
                        title={`${s.label}: ${s.score}%`}>
                        {s.text}{' '}
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-[10px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-48 text-center font-medium leading-normal whitespace-normal"
                          style={{ background: '#0B1628', color: '#E2EAF4', border: '1px solid #1E3A5F' }}>
                          {s.label}: {s.score}%
                          {s.reasoning && <span className="block mt-1 italic font-normal" style={{ color: '#8BA3C1' }}>"{s.reasoning}"</span>}
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
        <div className="px-5 py-4 flex gap-3 shrink-0" style={{ borderTop: '1px solid #1E3A5F' }}>
          <button onClick={() => { window.open(article?.url, '_blank', 'noopener,noreferrer'); }}  
            className="flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors"
            style={{ background: '#17C3B2', color: '#0B1628' }}>
            Visit Original Site
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors"
            style={{ background: 'transparent', border: '1px solid #1E3A5F', color: '#8BA3C1' }}>
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
}
