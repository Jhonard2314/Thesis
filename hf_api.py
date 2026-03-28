import os
import sys
import json
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Add current directory and NewsApex to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

news_apex_path = os.path.join(current_dir, "NewsApex")
if news_apex_path not in sys.path:
    sys.path.append(news_apex_path)

# Lazy import NewsService to speed up initial load
try:
    from NewsApex.news_service import NewsService
except ImportError:
    from news_service import NewsService

app = FastAPI(title="NewsApex AI Backend")
service = NewsService()

class AnalysisRequest(BaseModel):
    url: Optional[str] = None
    content: Optional[str] = None
    action: str = "analyze_bias"

@app.get("/")
def read_root():
    return {"status": "online", "model": "BERT-BABE Bias Detector"}

@app.get("/fetch_news")
def fetch_news(query: Optional[str] = None, category: Optional[str] = None):
    try:
        articles = service.fetch_all_news(query=query, category=category)
        # Transform for frontend expectations if needed
        transformed = []
        for a in articles:
            transformed.append({
                "title": a.get("title"),
                "url": a.get("link"),
                "source": {"name": a.get("source_id")},
                "publishedAt": a.get("pubDate"),
                "urlToImage": a.get("image_url"),
                "description": a.get("snippet")
            })
        return {"articles": transformed}
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze")
def analyze(request: AnalysisRequest):
    try:
        if not request.url and not request.content:
            raise HTTPException(status_code=400, detail="URL or content required")

        # 1. Get content if not provided
        content = request.content or service.get_full_content(request.url)
        if not content:
            return {"error": "Could not retrieve content for this article."}

        if request.action == "get_summary":
            summary = service.summarize_content(content[:3000])
            return {
                "summary": summary,
                "full_content": content
            }

        elif request.action == "analyze_bias":
            # 2. Analyze overall bias
            overall = service.rate_bias(content)
            
            # 3. Sentence-by-sentence analysis
            sentences = service.split_into_sentences(content)
            analysis_sentences = sentences[:25]
            batch_results = service.rate_bias_batch(analysis_sentences)
            
            sentence_results = []
            factual_count = 0
            biased_count = 0
            
            for i, res in enumerate(batch_results):
                label = res["label"]
                if label == "Biased":
                    biased_count += 1
                else:
                    factual_count += 1

                sentence_results.append({
                    "text": analysis_sentences[i],
                    "label": label,
                    "score": round(res["score"] * 100, 1),
                    "reasoning": res.get("reasoning", "")
                })

            bias_prob = overall["score"]
            level = "High" if bias_prob > 0.7 else "Medium" if bias_prob > 0.5 else "Low"
            
            return {
                "bias_level": level,
                "bias_score": round(bias_prob * 100, 1),
                "explanation": overall.get("reasoning", "No specific reasoning provided."),
                "top_words": overall.get("top_words", []),
                "sentence_breakdown": sentence_results,
                "factual_count": factual_count,
                "biased_count": biased_count,
                "total_sentences_analyzed": len(analysis_sentences),
                "full_content": content
            }
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action")

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
