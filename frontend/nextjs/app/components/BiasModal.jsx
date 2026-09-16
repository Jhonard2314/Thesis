'use client';

import { useState } from 'react';

export default function BiasModal({
  isOpen,
  onClose,
  article,
  biasData,
  isLoading,
  loadingStage,
  error,
  onRunBiasAnalysis
}) {
  if (!isOpen) return null;

  const handleReadArticle = () => {
    window.open(article.url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const getBiasColor = (level) => {
    switch (level) {
      case 'Low': return 'text-green-600';
      case 'Medium': return 'text-yellow-600';
      case 'High': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getBiasBgColor = (level) => {
    switch (level) {
      case 'Low': return 'bg-green-50';
      case 'Medium': return 'bg-yellow-50';
      case 'High': return 'bg-red-50';
      default: return 'bg-gray-50';
    }
  };

  const getBiasBadgeColor = (level) => {
    switch (level) {
      case 'Low': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'High': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-5 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              Media Bias Analysis
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Powered by BERT-BABE Linguistic Analysis
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Split Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column: Summary & Analysis Results */}
          <div className="w-1/3 border-r border-gray-100 overflow-y-auto p-6 bg-gray-50/50">
            {/* Article Info */}
            <div className="mb-6">
              <h3 className="font-bold text-gray-900 text-base mb-1 leading-tight">
                {article?.title}
              </h3>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {article?.source?.name || 'Unknown Source'}
              </p>
            </div>

            {/* Summary Section */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Executive Summary</h4>
              {biasData?.summary ? (
                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                  <p className="text-sm text-gray-700 leading-relaxed italic">
                    "{biasData.summary}"
                  </p>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-dashed">
                  <p className="text-sm text-gray-400 italic">
                    Summary unavailable. Analysis can still proceed on the full text.
                  </p>
                </div>
              )}
            </div>

            {/* Overall Analysis Result */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mb-4"></div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest animate-pulse text-center px-4">
                  {loadingStage === 'extracting' ? 'Extracting article...' : 'Analyzing article...'}
                </p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-red-700 text-sm font-bold mb-1">Analysis Failed</p>
                <p className="text-red-600 text-xs">{error}</p>
              </div>
            ) : biasData?.bias_level ? (
              <div className="space-y-6">
                {/* Result Card */}
                <div className={`${getBiasBgColor(biasData.bias_level)} rounded-xl p-5 border border-opacity-20 shadow-sm text-center`}>
                  <div className="text-4xl font-black mb-1">
                    <span className={getBiasColor(biasData.bias_level)}>
                      {biasData.bias_score}%
                    </span>
                  </div>
                  <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getBiasBadgeColor(biasData.bias_level)} mb-4`}>
                    Bias Score
                  </span>
                  <p className="text-xs text-gray-700 font-medium leading-relaxed">
                    {biasData.explanation}
                  </p>
                </div>

                {/* Top Biased Words */}
                {biasData?.top_words && biasData.top_words.length > 0 && biasData.bias_level !== 'Low' && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Key Biased Markers</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {biasData.top_words.map((item, idx) => (
                        <div key={idx} className="bg-white border border-red-100 rounded-lg px-2.5 py-1.5 flex items-center gap-2 shadow-sm">
                          <span className="text-xs font-bold text-red-700">{item.word}</span>
                          <span className="text-[9px] bg-red-50 text-red-500 px-1 rounded font-mono font-bold">
                            {item.score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <button
                    onClick={onRunBiasAnalysis}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest py-4 px-6 rounded-xl shadow-lg shadow-red-200 transform transition active:scale-95 flex items-center justify-center gap-2"
                  >
                    Start Deep Analysis
                  </button>
                </div>

                {/* Grading Threshold Guide */}
                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Bias Grading Scale</h4>
                  <div className="space-y-3">
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden flex shadow-inner">
                      <div className="bg-green-400 h-full w-1/2"></div>
                      <div className="bg-yellow-400 h-full w-[20%]"></div>
                      <div className="bg-red-500 h-full w-[30%]"></div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-green-600 font-bold">0% - 50%</span>
                        <span className="text-gray-500 font-medium italic">Likely Factual</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-yellow-600 font-bold">51% - 70%</span>
                        <span className="text-gray-500 font-medium italic text-right">Likely Biased</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-red-600 font-bold">71% - 100%</span>
                        <span className="text-gray-500 font-medium italic text-right">Strongly Biased</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Full Article with Highlighting */}
          <div className="flex-1 overflow-y-auto p-8 bg-white">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Full Article Context</h4>
            
            <div className="prose prose-sm max-w-none">
              {!biasData?.sentence_breakdown ? (
                <div className="space-y-4">
                  {(biasData?.full_content || article?.description || 'No content available for preview.').split('\n').map((para, i) => (
                    <p key={i} className="text-gray-400 leading-relaxed select-none">
                      {para}
                    </p>
                  ))}
                  {!biasData?.bias_level && !isLoading && (
                    <div className="bg-gray-50 rounded-xl p-8 text-center border-2 border-dashed border-gray-200">
                      <p className="text-gray-400 text-sm italic">
                        Run the analysis to see bias highlighting in the full text.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {biasData.sentence_breakdown.map((s, idx) => {
                    const isBiased = s.label === 'Biased';
                    const highlightClass = isBiased 
                      ? 'bg-red-100/80 border-b-2 border-red-300 hover:bg-red-200 transition-colors cursor-help' 
                      : 'bg-green-100/60 border-b-2 border-green-200 hover:bg-green-200 transition-colors cursor-help';
                    
                    return (
                      <span 
                        key={idx} 
                        className={`inline p-0.5 rounded-sm text-gray-900 leading-[1.8] text-sm group relative ${highlightClass}`}
                        title={s.reasoning || (isBiased ? 'Flagged as potentially biased' : 'Classified as neutral reporting')}
                      >
                        {s.text}{' '}
                        {/* Tooltip on hover */}
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-48 text-center font-medium leading-normal">
                          {s.label}: {s.score}%
                          {s.reasoning && <div className="mt-1 text-gray-400 italic font-normal">"{s.reasoning}"</div>}
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
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-5 flex gap-4 shrink-0">
          <button
            onClick={handleReadArticle}
            disabled={isLoading}
            className="flex-1 bg-gray-900 hover:bg-black disabled:bg-gray-200 text-white font-black text-xs uppercase tracking-widest py-3 rounded-lg transition-all"
          >
            Visit Original Site
          </button>
          <button
            onClick={onClose}
            className="flex-1 border-2 border-gray-100 hover:bg-gray-50 text-gray-500 font-black text-xs uppercase tracking-widest py-3 rounded-lg transition-all"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
}
