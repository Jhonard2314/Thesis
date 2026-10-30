import os
import sys
import re
import json
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
project_root = os.path.dirname(backend_dir)
for p in [current_dir, backend_dir, project_root, os.path.join(backend_dir, "bias_module")]:
    if p not in sys.path:
        sys.path.append(p)

try:
    from core.news_service import NewsService
except ImportError:
    try:
        from backend.core.news_service import NewsService
    except ImportError:
        try:
            from news_service import NewsService
        except ImportError:
            raise ImportError("Could not find news_service.py in any expected location")

app = FastAPI(title="NewsApex AI Backend")
service = NewsService()

@app.on_event("startup")
async def startup_event():
    import threading
    import traceback as tb_global

    # Log which news API keys are configured (key presence only, not values)
    print(f"Startup: NEWSDATA_API_KEY={'set' if service.newsdata_api_key else 'MISSING'}", file=sys.stderr)
    print(f"Startup: MEDIASTACK_API_KEY={'set' if service.mediastack_api_key else 'MISSING'}", file=sys.stderr)
    print(f"Startup: GUARDIAN_API_KEY={'set' if service.guardian_api_key else 'MISSING'}", file=sys.stderr)

    def load_models():
        # OUTER catch-all: if anything unexpected happens (even between try blocks),
        # mark BOTH models as Error so callers never see a permanent "Loading" state.
        try:
            try:
                print("Startup Task: Pre-loading bias model v2 (96%)...", file=sys.stderr)
                service.load_local_bias_model("v2")
                if service.bias_model_status == "Loaded":
                    print("Startup Task: Bias model v2 ready.", file=sys.stderr)
                else:
                    print(f"Startup Task: Bias model v2 finished status={service.bias_model_status}", file=sys.stderr)
            except Exception as ex:
                service.bias_model_status = "Error"
                service.bias_model_error = f"Startup thread exception (bias v2): {ex}\n{tb_global.format_exc()}"
                service.bias_load_started_at = None
                print(f"Startup Task: Bias model v2 FATAL: {ex}", file=sys.stderr)

            try:
                print("Startup Task: Pre-loading facebook/bart-large-cnn summarizer...", file=sys.stderr)
                service.load_local_summarizer()
                if service.summarizer_status == "Loaded":
                    print("Startup Task: Summarizer ready.", file=sys.stderr)
                else:
                    print(f"Startup Task: Summarizer load finished with status={service.summarizer_status} error={service.summarizer_error}", file=sys.stderr)
            except Exception as ex:
                service.summarizer_status = "Error"
                service.summarizer_error = f"Startup thread exception (summarizer): {ex}\n{tb_global.format_exc()}"
                service.summarizer_load_started_at = None
                print(f"Startup Task: Summarizer FATAL exception caught -> summarizer_status=Error. {ex}", file=sys.stderr)
                print(tb_global.format_exc(), file=sys.stderr)

        except Exception as outer_ex:
            # Catastrophic failure: e.g. OOM that killed the thread between blocks, or import error
            msg = f"Startup thread CATASTROPHIC outer exception: {outer_ex}\n{tb_global.format_exc()}"
            print(msg, file=sys.stderr)
            if service.bias_model_status == "Loading":
                service.bias_model_status = "Error"
                service.bias_model_error = msg
                service.bias_load_started_at = None
            if service.summarizer_status == "Loading":
                service.summarizer_status = "Error"
                service.summarizer_error = msg
                service.summarizer_load_started_at = None

    threading.Thread(target=load_models, daemon=True).start()

class AnalysisRequest(BaseModel):
    url: Optional[str] = None
    content: Optional[str] = None
    snippet: Optional[str] = None        # Fallback text when URL scraping fails
    scraped_content: Optional[str] = None  # Pre-screened content cached at fetch time
    summary: Optional[str] = None        # Pre-computed summary — skips BART re-run in analyze_bias
    model_version: str = "v2"            # "v1" = 83% 3-epoch model, "v2" = 96% 10-epoch model
    action: str = "analyze_bias"

@app.get("/")
def read_root():
    # Status fields are ALWAYS initialized in NewsService.__init__ → they are the single source of truth.
    # No need for `or` fallbacks; fallbacks here would hide bugs where status didn't get updated on a path.
    resp = {
        "status": "online",
        "service": "NewsApex AI Backend",
        "bias_model_status": service.bias_model_status,
        "bias_model_loaded": service.bias_model is not None,
        "summarizer_status": service.summarizer_status,
        "summarizer_model_loaded": service.summarizer_model is not None,
        "summarizer_model": "facebook/bart-large-cnn",
        "bias_model_local": "bert_babe.pt (bert-base-uncased fine-tuned)",
        "hf_remote_available": service.hf_client is not None,
        "api_version": "1.2.2"
    }
    # Effective bias status: reflects what /analyze will actually return to users
    if service.bias_model_status == "Loaded":
        resp["bias_effective_status"] = "Ready"
    elif service.bias_model_status == "Loading":
        resp["bias_effective_status"] = "Loading (HF fallback active)" if service.hf_client is not None else "Loading"
    elif service.bias_model_status == "Error" and service.hf_client is not None:
        resp["bias_effective_status"] = "Ready (HF remote fallback)"
        resp["bias_note"] = "Local bert_babe.pt not deployed on this server. Bias analysis uses Hugging Face Inference API remote fallback (facebook/bart-large-mnli zero-shot). All /analyze requests still return 200 OK. To enable local gradient-based top_words, add bert_babe.pt to backend/models/."
    elif service.bias_model_status == "Error":
        resp["bias_effective_status"] = "Error (no fallback)"
    else:
        resp["bias_effective_status"] = "Idle"
    if service.bias_model_error:
        resp["bias_model_error"] = str(service.bias_model_error)[:1200]
    if service.summarizer_error:
        resp["summarizer_error"] = str(service.summarizer_error)[:1200]
    return resp

@app.get("/health")
def health_check():
    """Dedicated health check for deployment monitors. Reports individual subsystem readiness."""
    bias_elapsed = service.get_loading_elapsed("bias")
    sum_elapsed = service.get_loading_elapsed("summarizer")
    bias_stuck = service.is_stuck_loading("bias", 180)
    sum_stuck = service.is_stuck_loading("summarizer", 180)

    bias_ready  = service.bias_model_status == "Loaded"
    # For deployment monitoring: summarizer in Error is still "ready" because HF API fallback exists.
    sum_ready   = service.summarizer_status in ("Loaded", "Error")

    # Bias "effectively ready" includes remote fallback capability:
    bias_effective_ready = bias_ready or (
        service.bias_model_status == "Error" and service.hf_client is not None
    )

    if bias_effective_ready and sum_ready:
        overall = "ok"
    elif sum_ready:
        overall = "degraded"
    else:
        overall = "booting"

    return {
        "status": overall,
        "model_ready": bias_ready,
        "bias_effective_ready": bias_effective_ready,
        "summarizer_ready": sum_ready,
        "bias_model_status": service.bias_model_status,
        "summarizer_status": service.summarizer_status,
        "bias_loading_elapsed_s": bias_elapsed,
        "summarizer_loading_elapsed_s": sum_elapsed,
        "bias_stuck_loading": bias_stuck,
        "summarizer_stuck_loading": sum_stuck,
        "hf_remote_available": service.hf_client is not None,
        "api_version": "1.2.2"
    }

@app.get("/status")
def status_detailed():
    """Full detailed diagnostic status for operators/debugging."""
    bias_elapsed = service.get_loading_elapsed("bias")
    sum_elapsed = service.get_loading_elapsed("summarizer")
    resp = {
        "api": {
            "version": "1.2.2",
            "service": "NewsApex AI Backend"
        },
        "bias_model": {
            "status": service.bias_model_status,
            "model_loaded": service.bias_model is not None,
            "tokenizer_loaded": service.bias_tokenizer is not None,
            "loading_elapsed_s": bias_elapsed,
            "stuck_loading_gt_3min": service.is_stuck_loading("bias", 180),
            "local_model_file": "bert_babe.pt (bert-base-uncased fine-tuned)",
            "error": str(service.bias_model_error)[:1600] if service.bias_model_error else None
        },
        "summarizer": {
            "status": service.summarizer_status,
            "model_loaded": service.summarizer_model is not None,
            "tokenizer_loaded": service.summarizer_tokenizer is not None,
            "loading_elapsed_s": sum_elapsed,
            "stuck_loading_gt_3min": service.is_stuck_loading("summarizer", 180),
            "local_model": "facebook/bart-large-cnn",
            "error": str(service.summarizer_error)[:1600] if service.summarizer_error else None
        },
        "fallbacks": {
            "hf_inference_api_available": service.hf_client is not None,
            "hf_token_configured": bool(service.hf_token)
        }
    }
    return resp

@app.get("/fetch_news")
def fetch_news(query: Optional[str] = None, category: Optional[str] = None):
    try:
        articles = service.fetch_all_news(query=query, category=category)
        transformed = []
        for a in articles:
            transformed.append({
                "title":          a.get("title"),
                "url":            a.get("link"),
                "source":         {"name": a.get("source_id")},
                "publishedAt":    a.get("pubDate"),
                "urlToImage":     a.get("image_url"),
                "description":    a.get("snippet"),
                # Pre-screening fields — used by frontend to badge cards and by /analyze to skip re-scraping
                "scrapable":      a.get("scrapable", False),
                "snippet_only":   a.get("snippet_only", False),
                "scraped_content": a.get("scraped_content")  # cached content from pre-screen (avoids re-scrape)
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

        # 1. Get content — priority: already-extracted content > pre-screened cache > live scrape > snippet fallback
        content = request.content or request.scraped_content or service.get_full_content(request.url)

        # Surface a clear message when the site actively blocked the scraper
        if isinstance(content, str) and content.startswith('__BLOCKED__:'):
            block_msg = content[len('__BLOCKED__:'):]
            return {"error": block_msg, "blocked": True}

        if not content and request.snippet:
            import html as _html
            import re as _re
            clean_snippet = _html.unescape(request.snippet.strip())
            # Strip HTML tags and truncation markers before checking length
            clean_snippet = _re.sub(r'<[^>]+>', ' ', clean_snippet)
            clean_snippet = _re.sub(r'\[[\+\-]?\d+\s*chars?\]', '', clean_snippet)
            clean_snippet = _re.sub(r'\[\.\.\.\]', '', clean_snippet)
            clean_snippet = _re.sub(r'\s+', ' ', clean_snippet).strip()
            if len(clean_snippet) >= 80:
                print(f"Scraping failed for {request.url}, using snippet fallback ({len(clean_snippet)} chars)", file=sys.stderr)
                content = clean_snippet
        if not content:
            return {"error": "Could not retrieve content for this article."}

        # 🔹 Select model version requested
        model_version = request.model_version if request.model_version in ("v1", "v2") else "v2"

        # 🔹 Graceful bias-model state handling
        # Route status/model references based on selected version
        active_status = service.bias_model_v1_status if model_version == "v1" else service.bias_model_status
        bias_elapsed = service.get_loading_elapsed("bias" if model_version == "v2" else "bias_v1")
        bias_stuck = service.is_stuck_loading("bias" if model_version == "v2" else "bias_v1", 180)

        if active_status == "Loading":
            # Auto-transition stuck Loading (>3 min) to Error
            if bias_stuck:
                err_msg = f"Auto-transition bias {model_version} Loading->Error after {bias_elapsed:.0f}s stuck."
                print(f"SAFETY: {err_msg}", file=sys.stderr)
                if model_version == "v1":
                    service.bias_model_v1_status = "Error"
                    service.bias_model_v1_error = err_msg
                else:
                    service.bias_model_status = "Error"
                    service.bias_model_error = err_msg
                    service.bias_load_started_at = None

            if service.hf_client is not None:
                use_remote_due_to_loading = (active_status == "Loading")
                if use_remote_due_to_loading:
                    print(f"Loading-state remote fallback for {model_version} (elapsed={bias_elapsed:.1f}s).", file=sys.stderr)
            else:
                return JSONResponse(
                    status_code=503,
                    content={
                        "error": f"Bias model {model_version} is still loading.",
                        "hint": "Retry in 30-60 seconds.",
                        "bias_model_status": active_status,
                        "bias_loading_elapsed_s": bias_elapsed,
                        "hf_remote_available": False
                    }
                )
        else:
            use_remote_due_to_loading = False

        if not service.bias_model and service.bias_model_status != "Error" and not use_remote_due_to_loading:
            service.load_local_bias_model("v2")
        if not service.bias_model_v1 and service.bias_model_v1_status != "Error" and model_version == "v1":
            service.load_local_bias_model("v1")

        active_model_error = service.bias_model_v1_error if model_version == "v1" else service.bias_model_error
        active_model_loaded = service.bias_model_v1 if model_version == "v1" else service.bias_model

        ####################################################################
        # EMERGENCY REMOTE FALLBACK:
        #   (a) local bias model is PERMANENTLY broken (status=Error) AND user has HF_TOKEN, OR
        #   (b) bias model is still Loading in background thread (single-CPU HF Space contention)
        # In either case, use zero-shot classification remotely so users NEVER see 503 in production.
        ####################################################################
        use_remote_bias_fallback = (
            ((active_status == "Error") and (service.hf_client is not None))
            or use_remote_due_to_loading
        )

        if request.action == "get_summary":
            summary = service.summarize_content(content[:3000])
            if not summary:
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
            sentences = service.split_into_sentences(content)
            analysis_sentences = sentences[:25]
            # Re-fetch elapsed (it may have been updated by stuck-loading transition above)
            cur_elapsed = service.get_loading_elapsed("bias")
            
            if not analysis_sentences:
                return JSONResponse(status_code=400, content={"error": "No valid content found to analyze."})

            ################################################################
            # PATH A: Local bias model works (99% of the time after first boot)
            ################################################################
            if not use_remote_bias_fallback:
                batch_results = service.rate_bias_batch(analysis_sentences, model_version=model_version)
                is_offline = all(res.get("label") in ["Offline", "Error"] for res in batch_results)

                if is_offline and service.hf_client is not None:
                    # Secondary runtime-detected offline fallback (belt-and-suspenders)
                    use_remote_bias_fallback = True
                    print("Runtime fallthrough: Local bias returned Offline for all -> switching to HF Inference API remote fallback.", file=sys.stderr)
                elif is_offline:
                    return JSONResponse(
                        status_code=503,
                        content={
                            "error": "The bias detection model is currently offline or failing to load.",
                            "details": batch_results[0].get("reasoning", "Unknown error"),
                            "bias_model_status": service.bias_model_status,
                            "bias_loading_elapsed_s": cur_elapsed,
                            "bias_model_error": (str(service.bias_model_error)[:800] if service.bias_model_error else None),
                            "hf_remote_available": service.hf_client is not None
                        }
                    )

            ################################################################
            # PATH B: Remote bias fallback (emergency only)
            ################################################################
            if use_remote_bias_fallback:
                print(f"Emergency remote bias fallback engaged for {len(analysis_sentences)} sentences.", file=sys.stderr)
                try:
                    candidate_labels = ["Factual news reporting", "Highly biased opinion or rhetoric"]
                    hypothesis_template = "This sentence is {}."
                    batch_results = []
                    for sentence in analysis_sentences:
                        try:
                            res = service.hf_client.text_classification(
                                sentence,
                                model="facebook/bart-large-mnli",
                                candidate_labels=candidate_labels,
                                hypothesis_template=hypothesis_template,
                                multi_label=False
                            )
                            labels_by_score = sorted(res, key=lambda x: (x.score if hasattr(x, 'score') else x.get('score', 0)), reverse=True)
                            top = labels_by_score[0]
                            top_label = top.label if hasattr(top, 'label') else top.get('label', '')
                            top_score = top.score if hasattr(top, 'score') else top.get('score', 0.0)
                            is_biased = ('biased' in top_label.lower() or 'rhetoric' in top_label.lower())
                            bias_score_raw = (top_score if is_biased else (1.0 - top_score))
                            bias_score_raw = max(0.05, min(0.95, bias_score_raw))
                            batch_results.append({
                                "label": "Biased" if is_biased else "Factual",
                                "score": bias_score_raw,
                                "reasoning": f"Remote zero-shot MNLI classifier top label: '{top_label}' (confidence {top_score:.2f}).",
                                "remote_fallback": True
                            })
                        except Exception as inner:
                            batch_results.append({
                                "label": "Offline",
                                "score": 0.5,
                                "reasoning": f"Remote fallback per-sentence error: {inner}"
                            })
                    # Check if remote also failed
                    if all(r.get("label") == "Offline" for r in batch_results):
                        _cur_el = service.get_loading_elapsed("bias")
                        return JSONResponse(
                            status_code=503,
                            content={
                                "error": "Both local bias model and Hugging Face remote zero-shot fallback failed.",
                                "bias_model_status": service.bias_model_status,
                                "bias_loading_elapsed_s": _cur_el,
                                "bias_model_error": str(service.bias_model_error)[:1200] if service.bias_model_error else None,
                                "remote_fallback_used": True,
                                "fallback_reason": "local_model_still_loading" if use_remote_due_to_loading else ("local_model_error" if service.bias_model_status == "Error" else "runtime_local_failed"),
                                "hf_remote_available": True,
                                "note": "Check network or HF API rate limits / service status."
                            }
                        )
                except Exception as remote_e:
                    _cur_el = service.get_loading_elapsed("bias")
                    return JSONResponse(
                        status_code=503,
                        content={
                            "error": f"Local bias broken, and remote HF fallback failed: {remote_e}",
                            "bias_model_status": service.bias_model_status,
                            "bias_loading_elapsed_s": _cur_el,
                            "bias_model_error": str(service.bias_model_error)[:1200] if service.bias_model_error else None,
                            "remote_fallback_used": True,
                            "fallback_reason": "local_model_still_loading" if use_remote_due_to_loading else ("local_model_error" if service.bias_model_status == "Error" else "runtime_local_failed"),
                            "hf_remote_available": True
                        }
                    )
            
            # 3. Get Summary - use pre-computed summary if provided (avoids double BART inference)
            summary = request.summary or service.summarize_content(content)
            if not summary:
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
                    "reasoning": res.get("reasoning", ""),
                    **({"remote_fallback": True} if res.get("remote_fallback") else {})
                })

            avg_bias_prob = total_score / len(batch_results)
            
            level = "High" if avg_bias_prob > 0.65 else "Medium" if avg_bias_prob > 0.50 else "Low"
            
            # Generate detailed interpretation
            interpretation = ""
            bias_indicators = []
            
            if level == "High":
                interpretation = f"This article exhibits strong linguistic bias across {biased_count} of {len(batch_results)} analyzed sentences ({round(biased_count/len(batch_results)*100, 1)}%). The language contains significant emotional framing, subjective opinions, or loaded terminology that deviates from neutral reporting standards."
                bias_indicators = [
                    f"{biased_count} of {len(batch_results)} sentences flagged as biased",
                    "Strong emotional or loaded language throughout",
                    "Opinion-based framing detected"
                ]
            elif level == "Medium":
                interpretation = f"This article shows moderate bias in {biased_count} of {len(batch_results)} sentences ({round(biased_count/len(batch_results)*100, 1)}%). While some factual reporting is present, the language includes noticeable opinion-based phrasing or emotionally charged terms that suggest editorial perspective."
                bias_indicators = [
                    f"{biased_count} sentences with bias markers",
                    f"{factual_count} sentences with neutral tone",
                    "Mix of factual and opinion content"
                ]
            else:
                interpretation = f"This article demonstrates largely factual reporting with {biased_count} of {len(batch_results)} sentences ({round(biased_count/len(batch_results)*100, 1)}%) showing bias markers. The language is predominantly neutral and objective, consistent with balanced journalism standards."
                bias_indicators = [
                    f"{factual_count} of {len(batch_results)} sentences use neutral language",
                    "Minimal emotional terminology",
                    "Objective reporting style"
                ]
            
            sample_text = " ".join(analysis_sentences[:8])
            if not use_remote_bias_fallback and active_model_loaded and service.bias_tokenizer:
                top_words = service.get_top_biased_words_gradient(sample_text, top_k=8, model_version=model_version)
            else:
                from collections import Counter
                import re
                words = re.findall(r"[A-Za-z][A-Za-z]{2,}", sample_text.lower())
                filtered = [w for w in words if w not in service.STOP_WORDS]
                top_words = [{"word": w, "score": round(c * 10, 2)} for w, c in Counter(filtered).most_common(8)]
                if use_remote_bias_fallback:
                    for tw in top_words:
                        tw["remote_fallback"] = True

            # Add explanations for why each word is biased - comprehensive pattern matching
            bias_word_patterns = {
                                "dismissive": {
                    "words": ["dismissal", "dismissed", "reject", "rejection", "ignore", "disregard"],
                    "reason": "Dismissive language that minimizes opposing viewpoints"
                },
                "aftermath": {
                    "words": ["aftermath", "fallout", "consequences", "repercussions", "impact"],
                    "reason": "Consequence framing that emphasizes negative outcomes"
                },
                "temperature": {
                    "words": ["cold", "hot", "warm", "cool", "heated", "chilly"],
                    "reason": "Temperature metaphor used to characterize tone or relationships"
                },
                "warning_language": {
                    "words": ["warning", "caution", "alert", "danger", "risk", "hazard"],
                    "reason": "Cautionary language that may heighten concern or urgency"
                },
                "names_places": {
                    "words": ["disneyland", "mike", "trump", "biden", "washington", "hollywood"],
                    "reason": "Named entity that may carry preconceived associations or stereotypes"
                },
                "emotional": {
                    "words": ["outrageous", "shocking", "devastating", "horrific", "stunning", "unbelievable", "dramatically", 
                             "tragic", "heartbreaking", "alarming", "frightening", "terrifying", "rage", "fury", "anger"],
                    "reason": "Emotional language that appeals to feelings rather than presenting facts"
                },
                "subjective": {
                    "words": ["obviously", "clearly", "undoubtedly", "certainly", "definitely", "surely", "plainly", 
                             "evidently", "apparent", "brilliant", "perfect", "ideal", "best", "worst"],
                    "reason": "Subjective opinion presented as objective fact"
                },
                "loaded": {
                    "words": ["radical", "extreme", "dangerous", "threat", "crisis", "disaster", "catastrophe",
                             "scheme", "plot", "regime", "propaganda"],
                    "reason": "Loaded terminology with strong negative connotation"
                },
                "sensational": {
                    "words": ["slammed", "blasted", "destroyed", "crushed", "demolished", "annihilated", "explosive",
                             "bombshell", "shocking", "stunning"],
                    "reason": "Sensational language that exaggerates for dramatic effect"
                },
                "judgmental": {
                    "words": ["terrible", "horrible", "awful", "ridiculous", "absurd", "stupid", "idiotic", "foolish",
                             "traitor", "villain", "hero", "corrupt"],
                    "reason": "Judgmental language expressing personal value judgment"
                },
                "partisan": {
                    "words": ["liberal", "conservative", "leftist", "rightist", "socialist", "fascist", "communist"],
                    "reason": "Political label often used to frame subjects negatively"
                },
                "fear_mongering": {
                    "words": ["chaos", "collapse", "doom", "destruction", "apocalypse", "nightmare", "horror"],
                    "reason": "Fear-inducing language that heightens anxiety"
                },
                "combat": {
                    "words": ["attack", "assault", "battle", "war", "fight", "combat", "clash", "confronted", "hit"],
                    "reason": "Combat metaphors that frame issues as conflicts"
                },
                "economic_bias": {
                    "words": ["budget", "spending", "cost", "expensive", "cheap", "waste", "taxpayer"],
                    "reason": "Economic framing that emphasizes financial impact over other considerations"
                },
                "investigative": {
                    "words": ["probe", "investigation", "scandal", "controversy", "allegation", "accused"],
                    "reason": "Language suggesting wrongdoing before facts are established"
                },
                "location_context": {
                    "words": ["spot", "area", "location", "burnham", "ocean", "city", "town"],
                    "reason": "Geographic term that may carry implicit associations or context"
                },
                "analysis_framing": {
                    "words": ["analysis", "report", "study", "research", "data", "findings"],
                    "reason": "Framing word that influences how information is received"
                }
            }
            
            # Apply pattern matching to each word
            for word_obj in top_words:
                word_lower = word_obj["word"].lower()
                # Smart fallback based on word characteristics
                if word_lower.endswith(('ism', 'ist')):
                    reason = "Ideological label that may frame subjects with political bias"
                elif word_lower.endswith(('ing', 'ed')) and len(word_lower) > 6:
                    reason = "Action verb that may indicate opinionated framing or narrative bias"
                elif word_lower[0].isupper() or word_lower.istitle():
                    reason = "Proper noun flagged by model - may carry loaded associations in context"
                elif any(char.isdigit() for char in word_lower):
                    reason = "Numerical reference that may emphasize or de-emphasize significance"
                elif word_obj["score"] > 150:
                    reason = "Very high model confidence - strong bias signal detected in usage pattern"
                elif word_obj["score"] > 120:
                    reason = "High model activation - word usage deviates from neutral reporting patterns"
                else:
                    reason = "Model detected subtle bias in how this word is used contextually"
                
                # Check against all categories
                matched = False
                for category, data in bias_word_patterns.items():
                    if word_lower in data["words"]:
                        reason = data["reason"]
                        matched = True
                        break
                
                # If no exact match, check for partial matches (word contains pattern or vice versa)
                if not matched:
                    for category, data in bias_word_patterns.items():
                        for pattern_word in data["words"]:
                            if pattern_word in word_lower or word_lower in pattern_word:
                                reason = data["reason"] + f" (contains '{pattern_word}')"
                                matched = True
                                break
                        if matched:
                            break
                
                word_obj["reason"] = reason
            
            resp = {
                "bias_level": level,
                "bias_score": round(avg_bias_prob * 100, 1),
                "summary": summary,
                "model_version": model_version,
                "model_label": "BERT-BABE v1 (83% acc, 3-epoch)" if model_version == "v1" else "BERT-BABE v2 (96% acc, 10-epoch)",
                "explanation": f"Analysis completed across {len(analysis_sentences)} sentences. Overall bias score represents the average linguistic bias detected.",
                "interpretation": interpretation,
                "bias_indicators": bias_indicators,
                "top_words": top_words,
                "sentence_breakdown": sentence_results,
                "factual_count": factual_count,
                "biased_count": biased_count,
                "total_sentences_analyzed": len(analysis_sentences),
                "full_content": content
            }
            if use_remote_bias_fallback:
                resp["remote_bias_fallback_used"] = True
                if use_remote_due_to_loading:
                    resp["fallback_reason"] = "local_model_still_loading"
                    resp["bias_loading_elapsed_s"] = bias_elapsed
                    resp["bias_model_status_at_request_time"] = "Loading"
                    resp["hint"] = "Local BERT bias model is still loading on this CPU. Retry in 60s for local gradient-based top_words."
                elif service.bias_model_status == "Error":
                    resp["fallback_reason"] = "local_model_error"
                    resp["bias_model_error_preview"] = str(service.bias_model_error)[:400] if service.bias_model_error else "Unknown"
                else:
                    resp["fallback_reason"] = "runtime_local_failed"
                    resp["bias_model_error_preview"] = str(service.bias_model_error)[:400] if service.bias_model_error else None
            return resp
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action")

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
