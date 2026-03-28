import os
import sys
import json
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Add current directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

# Lazy import NewsService to handle both flat and nested structures
try:
    from news_service import NewsService
except ImportError:
    try:
        from NewsApex.news_service import NewsService
    except ImportError:
        raise ImportError("Could not find news_service.py in root or NewsApex folder")

app = FastAPI(title="NewsApex AI Backend")
service = NewsService()

# Pre-load the model at startup to avoid delay on first request
print("Pre-loading bias model...", file=sys.stderr)
service.load_local_bias_model()
print("Bias model ready.", file=sys.stderr)

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

        # Ensure model is loaded (pre-load should have handled this, but be safe)
        if not service.bias_model:
            service.load_local_bias_model()

        if request.action == "get_summary":
            summary = service.summarize_content(content[:3000])
            if not summary:
                # 🔹 Fallback: take the first 3-4 sentences of the first non-empty paragraph
                paragraphs = [p for p in content.split('\n') if len(p.strip()) > 100]
                if paragraphs:
                    summary = paragraphs[0][:350].strip() + "..."
                else:
                    summary = content[:350].strip() + "..."
            
            return {
                "summary": summary,
                "full_content": content
            }

        elif request.action == "analyze_bias":
            # 1. Split and get sentences (up to 25 for stability)
            sentences = service.split_into_sentences(content)
            analysis_sentences = sentences[:25]
            
            if not analysis_sentences:
                return JSONResponse(status_code=400, content={"error": "No valid content found to analyze."})

            # 2. Analyze sentences in a single batch
            batch_results = service.rate_bias_batch(analysis_sentences)
            
            # Check if all results are "Offline" or "Error"
            is_offline = all(res.get("label") in ["Offline", "Error"] for res in batch_results)
            if is_offline:
                return JSONResponse(
                    status_code=503,
                    content={
                        "error": "The bias detection model is currently offline or failing to load.",
                        "details": batch_results[0].get("reasoning", "Unknown error")
                    }
                )
            
            # 3. Get Summary - Use a more specific generation logic
            summary = service.summarize_content(content)
            if not summary:
                # Fallback to truncated first paragraph if BART fails
                summary = content.split('\n')[0][:300] + "..."
            
            # 4. Process results and calculate overall metrics
            sentence_results = []
            factual_count = 0
            biased_count = 0
            total_score = 0
            
            for i, res in enumerate(batch_results):
                label = res["label"]
                score = res["score"]
                total_score += score
                
                if label == "Biased":
                    biased_count += 1
                else:
                    factual_count += 1

                sentence_results.append({
                    "text": analysis_sentences[i],
                    "label": label,
                    "score": round(score * 100, 1),
                    "reasoning": res.get("reasoning", "")
                })

            # Calculate average bias probability
            avg_bias_prob = total_score / len(batch_results)
            
            # Determine overall level
            # 🔹 ADJUSTED THRESHOLD: Lowered 'High' to 0.65 for more realistic detection
            level = "High" if avg_bias_prob > 0.65 else "Medium" if avg_bias_prob > 0.45 else "Low"
            
            # Get top biased words (using a sample)
            sample_text = " ".join(analysis_sentences[:8])
            top_words = service.get_top_biased_words_gradient(sample_text, top_k=8)
            
            return {
                "bias_level": level,
                "bias_score": round(avg_bias_prob * 100, 1),
                "summary": summary,
                "explanation": f"Analysis completed across {len(analysis_sentences)} sentences. Overall bias score represents the average linguistic bias detected.",
                "top_words": top_words,
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
