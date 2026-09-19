import sys
import os
import re
import requests
from dotenv import load_dotenv
from newspaper import Article, Config
from huggingface_hub import InferenceClient
from concurrent.futures import ThreadPoolExecutor
import sys

# Move heavy AI imports inside methods to speed up news fetch startup
# import torch
# from transformers import BertTokenizer, BertForSequenceClassification

base_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.dirname(base_dir)
project_root = os.path.dirname(frontend_dir)
backend_dir = os.path.join(project_root, "backend")
for _p in [base_dir, frontend_dir, project_root, backend_dir, os.path.join(backend_dir, "core"), os.path.join(backend_dir, "bias_module")]:
    if _p not in sys.path:
        sys.path.append(_p)

load_dotenv(os.path.join(project_root, ".env"))
load_dotenv(os.path.join(base_dir, ".env"))
load_dotenv()

class NewsService:
    STOP_WORDS = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
        'do', 'does', 'did', 'but', 'if', 'then', 'else', 'when', 'where', 'why',
        'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
        'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
        's', 't', 'can', 'will', 'just', 'don', "should", "now", "of", "as", "by",
        "it", "its", "they", "them", "their", "this", "that", "these", "those",
        "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your"
    }

    def __init__(self):
        self.newsdata_api_key = os.getenv("NEWSDATA_API_KEY")
        self.mediastack_api_key = os.getenv("MEDIASTACK_API_KEY")
        self.guardian_api_key = os.getenv("GUARDIAN_API_KEY", "22a8f287-72ca-4501-b9b8-bdf3884753d5")
        self.hf_token = os.getenv("HF_TOKEN")
        
        self.session = requests.Session()
        
        self.config = Config()
        self.config.browser_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        self.config.request_timeout = 20
        self.config.fetch_images = False
        self.config.memoize_articles = False
        self.config.MAX_TEXT = 100000 
        
        self.hf_client = None
        if self.hf_token:
            try:
                self.hf_client = InferenceClient(token=self.hf_token)
            except:
                self.hf_client = None

        self.bias_model = None
        self.bias_tokenizer = None

        self.summarizer_model = None
        self.summarizer_tokenizer = None
        self._summarizer_load_attempted = False

    def load_local_bias_model(self):
        try:
            import torch
            from transformers import BertTokenizer, BertForSequenceClassification, BertConfig
            from bias_module import config as bias_config
            base_path = os.path.dirname(os.path.abspath(__file__))
            
            parent_path = os.path.dirname(base_path)
            frontend_path = os.path.dirname(base_path)
            project_root = os.path.dirname(frontend_path)
            backend_path = os.path.join(project_root, "backend")
            possible_paths = [
                os.path.join(backend_path, "models", "bert_babe.pt"),
                os.path.join(backend_path, "bias_module", "models", "bert_babe.pt"),
                os.path.join(project_root, "backend", "models", "bert_babe.pt"),
                os.path.join(os.getcwd(), "backend", "models", "bert_babe.pt"),
                os.path.join(os.getcwd(), "bert_babe.pt"),
                os.path.join(base_path, "bert_babe.pt"),
                "/app/backend/models/bert_babe.pt",
                "/app/bert_babe.pt"
            ]
            
            print(f"DEBUG: base_path={base_path}", file=sys.stderr)
            print(f"DEBUG: cwd={os.getcwd()}", file=sys.stderr)
            
            model_path = None
            for p in possible_paths:
                exists = os.path.exists(p)
                print(f"DEBUG: Checking path {p} - exists={exists}", file=sys.stderr)
                if exists:
                    model_path = p
                    break
            
            model_cache_dir = os.path.join(backend_path, "bias_module", "data", "model_cache")
            if not os.path.exists(model_cache_dir):
                model_cache_dir = os.path.join(project_root, "backend", "bias_module", "data", "model_cache")
            
            if model_path:
                print(f"Loading model from: {model_path}", file=sys.stderr)
                if os.path.exists(model_cache_dir):
                    self.bias_tokenizer = BertTokenizer.from_pretrained(model_cache_dir)
                    config = BertConfig.from_pretrained(os.path.join(model_cache_dir, "config.json"))
                    self.bias_model = BertForSequenceClassification(config)
                else:
                    self.bias_tokenizer = BertTokenizer.from_pretrained(bias_config.MODEL_NAME)
                    self.bias_model = BertForSequenceClassification.from_pretrained(
                        bias_config.MODEL_NAME,
                        num_labels=2
                    )
                
                self.bias_model.load_state_dict(torch.load(model_path, map_location=torch.device('cpu')))
                self.bias_model.eval()
                print(f"Local bias model loaded successfully.", file=sys.stderr)
                return True
            else:
                print(f"Model file 'bert_babe.pt' not found in any expected location.", file=sys.stderr)
                return False
        except Exception as e:
            print(f"Error loading local bias model: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            self.bias_model = None
            self.bias_tokenizer = None
            return False

    def get_top_biased_words_gradient(self, text, top_k=5):
        if not self.bias_model or not self.bias_tokenizer:
            return []
        try:
            import torch
            encoding = self.bias_tokenizer(text, return_tensors="pt", truncation=True, padding="max_length", max_length=128)
            input_ids = encoding["input_ids"]
            attention_mask = encoding["attention_mask"]
            self.bias_model.zero_grad()
            for param in self.bias_model.bert.embeddings.word_embeddings.parameters():
                param.requires_grad = True
            with torch.enable_grad():
                outputs = self.bias_model(input_ids=input_ids, attention_mask=attention_mask)
                logits = outputs.logits
                bias_logit = logits[0, 1]
                bias_logit.backward()
            embedding_grad = self.bias_model.bert.embeddings.word_embeddings.weight.grad
            if embedding_grad is None: return []
            token_ids = input_ids[0]
            token_grads = embedding_grad[token_ids]
            scores = torch.norm(token_grads, dim=1)
            tokens = self.bias_tokenizer.convert_ids_to_tokens(token_ids)
            filtered = []
            for tok, score in zip(tokens, scores):
                if tok in ["[CLS]", "[SEP]", "[PAD]"] or tok.startswith("##"): continue
                if not any(c.isalnum() for c in tok): continue
                if tok.lower() in self.STOP_WORDS: continue
                if len(tok) < 3 and tok.lower() not in ['a', 'i']: continue
                filtered.append((tok, score.item()))
            sorted_tokens = sorted(filtered, key=lambda x: x[1], reverse=True)
            return [{"word": t[0], "score": round(t[1] * 100, 2)} for t in sorted_tokens[:top_k]]
        except Exception as e:
            print(f"Gradient Calculation Error: {e}", file=sys.stderr)
            return []

    def get_bias_reasoning(self, text, label, bias_score):
        if bias_score > 0.7: return "Interpretation: Strongly biased"
        elif bias_score > 0.5: return "Interpretation: Likely Biased"
        else: return "Interpretation: Likely Factual"

    def rate_bias_batch(self, sentences):
        if not sentences: return []
        if not self.bias_model: self.load_local_bias_model()
        if not self.bias_model or not self.bias_tokenizer:
            return [{"label": "Offline", "score": 0.0, "reasoning": "Model not available."} for _ in sentences]
        try:
            import torch
            inputs = self.bias_tokenizer(sentences, return_tensors="pt", truncation=True, padding=True, max_length=128)
            with torch.no_grad():
                outputs = self.bias_model(**inputs)
                probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
                results = []
                for i, prob in enumerate(probs):
                    bias_score = prob[1].item()
                    label = "Biased" if bias_score > 0.5 else "Factual"
                    reasoning = self.get_bias_reasoning(sentences[i], label, bias_score)
                    results.append({"label": label, "score": bias_score, "reasoning": reasoning})
                return results
        except Exception as e:
            print(f"Batch Analysis Error: {e}", file=sys.stderr)
            return [{"label": "Error", "score": 0.0, "reasoning": str(e)} for _ in sentences]

    def rate_bias(self, text):
        if not self.bias_model: self.load_local_bias_model()
        if not text or len(text.strip()) < 10:
            return {"label": "Neutral", "score": 0.0, "reasoning": "Text too short for analysis."}
        filtered_sentences = self.split_into_sentences(text)
        if not filtered_sentences: return {"label": "Neutral", "score": 0.0, "reasoning": "No valid content found."}
        filtered_text = " ".join(filtered_sentences)
        if self.bias_model and self.bias_tokenizer:
            try:
                import torch
                inputs = self.bias_tokenizer(filtered_text, return_tensors="pt", truncation=True, padding=True, max_length=128)
                with torch.no_grad():
                    outputs = self.bias_model(**inputs)
                    probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
                    bias_score = probs[0][1].item()
                    label = "Biased" if bias_score > 0.5 else "Factual"
                    top_words = self.get_top_biased_words_gradient(filtered_text, top_k=8)
                    reasoning = self.get_bias_reasoning(filtered_text, label, bias_score)
                    return {"label": label, "score": bias_score, "reasoning": reasoning, "top_words": top_words}
            except Exception as e:
                print(f"Local Model Prediction Error: {e}", file=sys.stderr)
        return {"label": "Offline", "score": 0.0, "reasoning": "Model failed or is offline."}

    def split_into_sentences(self, text):
        if not text: return []
        sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text.strip())
        ad_keywords = ["sign up for", "subscribe to", "advertisement", "promoted", "sponsored"]
        filtered_sentences = []
        for s in sentences:
            s_clean = s.strip()
            if not s_clean or len(s_clean.split()) < 4: continue
            if any(keyword in s_clean.lower() for keyword in ad_keywords): continue
            filtered_sentences.append(s_clean)
        return filtered_sentences

    def fetch_mediastack(self, query=None, category=None, language="en"):
        """Fetch articles from Mediastack API (mediastack.com)."""
        if not self.mediastack_api_key:
            return []
        url = "http://api.mediastack.com/v1/news"
        params = {
            "access_key": self.mediastack_api_key,
            "languages": "en",
            "limit": 20,
            "sort": "published_desc"
        }
        if query:
            params["keywords"] = query
        if category and category != 'general':
            params["categories"] = category
        try:
            res = self.session.get(url, params=params, timeout=10)
            data = res.json()
            if data.get("error"):
                print(f"Mediastack API error: {data['error'].get('message', 'Unknown error')}", file=sys.stderr)
                return []
            return [{
                "title": r.get("title"),
                "link": r.get("url"),
                "source_id": r.get("source"),
                "pubDate": r.get("published_at"),
                "image_url": r.get("image"),
                "snippet": r.get("description")
            } for r in data.get("data", []) if r.get("title")]
        except Exception as e:
            print(f"Mediastack Exception: {e}", file=sys.stderr)
            return []

    def fetch_newsdata(self, query=None, category=None, language="en"):
        if not self.newsdata_api_key: return []
        url = "https://newsdata.io/api/1/news"
        params = {"apikey": self.newsdata_api_key, "language": "en"}
        if query: params["q"] = query
        if category and category != 'general': params["category"] = category
        try:
            res = self.session.get(url, params=params, timeout=10)
            data = res.json()
            if data.get("status") == "success":
                return [{"title": r.get("title"), "link": r.get("link"), "source_id": r.get("source_id"), "pubDate": r.get("pubDate"), "image_url": r.get("image_url"), "snippet": r.get("description") or r.get("content")} for r in data.get("results", [])]
            return []
        except: return []

    def fetch_guardian(self, query=None, category=None):
        if not self.guardian_api_key or "your_" in self.guardian_api_key: 
            print("Guardian: API key missing or placeholder, skipping.", file=sys.stderr)
            return []
        url = "https://content.guardianapis.com/search"
        params = {"api-key": self.guardian_api_key, "show-fields": "thumbnail,trailText", "page-size": 20}
        if query: params["q"] = query
        category_map = {'business': 'business', 'technology': 'technology', 'entertainment': 'culture', 'health': 'society', 'science': 'science', 'sports': 'sport'}
        if category and category in category_map: params["section"] = category_map[category]
        try:
            res = self.session.get(url, params=params, timeout=15)
            if res.status_code != 200:
                print(f"Guardian API ERROR: Status {res.status_code}. Response: {res.text[:300]}", file=sys.stderr)
                return []
            data = res.json()
            resp = data.get("response", {})
            if resp.get("status") != "ok":
                print(f"Guardian API Status Error: {resp.get('status')} - {resp.get('message', 'No message')}", file=sys.stderr)
                return []
            results = resp.get("results", [])
            print(f"Guardian API: Retrieved {len(results)} articles.", file=sys.stderr)
            return [{"title": r.get("webTitle"), "link": r.get("webUrl"), "source_id": "The Guardian", "pubDate": r.get("webPublicationDate"), "image_url": r.get("fields", {}).get("thumbnail"), "snippet": r.get("fields", {}).get("trailText")} for r in results]
        except Exception as e:
            print(f"Guardian Exception: {str(e)}", file=sys.stderr)
            return []

    def fetch_all_news(self, query=None, category=None, language="en"):
        # FASTEST POSSIBLE FETCH: Parallelize all API calls at the same time
        all_articles = []
        
        with ThreadPoolExecutor(max_workers=3) as executor:
            # Kick off all API calls at the same time
            future_mediastack = executor.submit(self.fetch_mediastack, query, category, language)
            future_newsdata = executor.submit(self.fetch_newsdata, query, category, language)
            future_guardian = executor.submit(self.fetch_guardian, query, category)
            
            # Collect results
            try:
                all_articles.extend(future_mediastack.result())
            except Exception as e:
                print(f"Mediastack error: {e}", file=sys.stderr)

            try:
                all_articles.extend(future_newsdata.result())
            except Exception as e:
                print(f"NewsData error: {e}", file=sys.stderr)
            
            try:
                all_articles.extend(future_guardian.result())
            except Exception as e:
                print(f"Guardian error: {e}", file=sys.stderr)

        unique_articles = []
        seen_titles = set()
        for article in all_articles:
            title = article.get("title")
            if title and title.lower() not in seen_titles:
                unique_articles.append(article)
                seen_titles.add(title.lower())
        
        try:
            unique_articles.sort(key=lambda x: x.get('pubDate', ''), reverse=True)
        except:
            pass

        # --- SCRAPABILITY FILTER ---
        # Only show articles that we can actually extract content from.
        filtered_articles = []
        # Limit the number of articles we check to keep it fast
        articles_to_check = unique_articles[:30]
        
        def check_article(article):
            url = article.get("link")
            if not url:
                return None
            
            # Use a slightly shorter timeout for the background check
            content = self.get_full_content(url)
            if content and len(content) > 400:
                # Basic check for error messages in the text
                error_terms = ["javascript is disabled", "enable cookies", "paywall", "subscribe to read"]
                content_lower = content.lower()
                if any(term in content_lower for term in error_terms):
                    return None
                return article
            return None

        # Check articles concurrently
        with ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(check_article, articles_to_check))
            filtered_articles = [r for r in results if r is not None]

        return filtered_articles[:20]

    def get_full_content(self, url):
        try:
            headers = {
                'User-Agent': self.config.browser_user_agent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
            }
            response = self.session.get(url, headers=headers, timeout=15)
            if response.status_code != 200: return None
            
            # Quick check for JS-only pages or common error indicators in HTML
            html_lower = response.text.lower()
            if "javascript is disabled" in html_lower or "enable javascript" in html_lower:
                return None

            from newspaper import Article
            article = Article(url, config=self.config)
            article.set_html(response.text)
            article.parse()
            
            text = article.text.strip()
            
            # Final validation of the extracted text
            if not text or len(text) < 300: 
                return None
                
            # Filter out pages that extracted only UI elements/errors
            system_errors = ["please enable javascript", "browser not supported", "access denied", "forbidden"]
            text_lower = text.lower()
            if any(err in text_lower for err in system_errors):
                return None
                
            return text
        except Exception as e:
            # print(f"Extraction error: {e}", file=sys.stderr)
            return None

    def load_local_summarizer(self):
        if self._summarizer_load_attempted:
            return self.summarizer_model is not None
        self._summarizer_load_attempted = True
        try:
            from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
            import torch

            model_name = "facebook/bart-large-cnn"
            print(f"Loading {model_name} summarizer (this may take a moment on first run)...", file=sys.stderr)

            self.summarizer_tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.summarizer_model = AutoModelForSeq2SeqLM.from_pretrained(
                model_name,
                device_map="auto" if torch.cuda.is_available() else None,
                torch_dtype=torch.float32
            )
            if not torch.cuda.is_available():
                self.summarizer_model = self.summarizer_model.to("cpu")
            self.summarizer_model.eval()
            print(f"{model_name} summarizer loaded successfully.", file=sys.stderr)
            return True
        except Exception as e:
            print(f"Error loading local summarizer: {e}. Will use Hugging Face API fallback.", file=sys.stderr)
            self.summarizer_model = None
            self.summarizer_tokenizer = None
            return False

    def _summarize_with_local_model(self, text):
        try:
            import torch
            inputs = self.summarizer_tokenizer(
                text,
                max_length=1024,
                truncation=True,
                return_tensors="pt"
            )
            device = next(self.summarizer_model.parameters()).device
            inputs = {k: v.to(device) for k, v in inputs.items()}

            input_length = inputs["input_ids"].shape[1]
            max_len = min(250, max(60, input_length // 3))
            min_len = min(80, max(30, input_length // 6))

            with torch.no_grad():
                summary_ids = self.summarizer_model.generate(
                    inputs["input_ids"],
                    attention_mask=inputs["attention_mask"],
                    max_length=max_len,
                    min_length=min_len,
                    length_penalty=2.0,
                    num_beams=4,
                    early_stopping=True,
                    do_sample=False
                )
            return self.summarizer_tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        except Exception as e:
            print(f"Local summarization error: {e}", file=sys.stderr)
            return None

    def summarize_content(self, text):
        if not text or len(text.strip()) < 100:
            return None
        truncated_text = text[:3000]

        if self.load_local_summarizer():
            result = self._summarize_with_local_model(truncated_text)
            if result and len(result.strip()) > 30:
                return result

        if self.hf_client:
            try:
                response = self.hf_client.summarization(truncated_text, model="facebook/bart-large-cnn")
                if hasattr(response, 'summary_text'): return response.summary_text
                if isinstance(response, list) and len(response) > 0: return response[0].get('summary_text') if isinstance(response[0], dict) else str(response[0])
                if isinstance(response, dict): return response.get('summary_text')
                return str(response)
            except Exception as e:
                print(f"Hugging Face API summarization fallback error: {e}", file=sys.stderr)

        return None
