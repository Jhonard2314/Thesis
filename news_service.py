import requests
import os
import re
from dotenv import load_dotenv
from newspaper import Article, Config
from huggingface_hub import InferenceClient
from concurrent.futures import ThreadPoolExecutor
import sys

# Add bias_module to path for integration
sys.path.append(os.path.join(os.getcwd(), "bias_module"))

load_dotenv()

class NewsService:
    # Common English stop words to filter from biased words list
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
        # API keys from .env with fallbacks for ease of use
        self.newsdata_api_key = os.getenv("NEWSDATA_API_KEY", "pub_c319de1ec46240dc912d9b112e01c866")
        self.guardian_api_key = os.getenv("GUARDIAN_API_KEY", "438ab5df-f19b-42b6-9ca9-83b8e971f219")
        self.hf_token = os.getenv("HF_TOKEN")
        
        self.session = requests.Session()
        self.config = Config()
        self.config.browser_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        self.config.request_timeout = 20
        self.config.fetch_images = False
        self.config.memoize_articles = False
        self.config.MAX_TEXT = 100000 # Ensure we get as much text as possible
        
        # Initialize HF Client for summarization and fallback bias detection
        if self.hf_token:
            try:
                self.hf_client = InferenceClient(token=self.hf_token)
            except:
                self.hf_client = None
        else:
            self.hf_client = None

        # --- BIAS MODULE INTEGRATION ---
        self.bias_model = None
        self.bias_tokenizer = None
        # Model will be loaded on first use of rate_bias

    def load_local_bias_model(self):
        """Attempts to load the local BERT model for bias detection."""
        global torch, BertTokenizer, BertForSequenceClassification
        try:
            import torch
            from transformers import BertTokenizer, BertForSequenceClassification
            from bias_module import config as bias_config
            
            # Use absolute paths to ensure the model loads correctly regardless of where the service is started
            base_path = os.path.dirname(os.path.abspath(__file__))
            model_path = os.path.join(base_path, "bias_module", "models", "bert_babe.pt")
            model_cache_dir = os.path.join(base_path, "bias_module", "data", "model_cache")
            
            if os.path.exists(model_path):
                # Load from local cache if possible to avoid HF connectivity issues
                if os.path.exists(model_cache_dir):
                    from transformers import BertConfig
                    self.bias_tokenizer = BertTokenizer.from_pretrained(model_cache_dir)
                    # Load model structure from config to avoid needing the base pytorch_model.bin
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
                # Print to stderr so it doesn't break JSON parsing in the bridge
                print(f"Local bias model loaded successfully from {model_path}", file=sys.stderr)
        except Exception as e:
            print(f"Error loading local bias model: {e}", file=sys.stderr)
            self.bias_model = None
            self.bias_tokenizer = None

    def get_top_biased_words_gradient(self, text, top_k=5):
        """
        Calculates word importance using gradients, matching the formula in bias_module/predict.py.
        """
        if not self.bias_model or not self.bias_tokenizer:
            return []

        try:
            encoding = self.bias_tokenizer(
                text,
                return_tensors="pt",
                truncation=True,
                padding="max_length",
                max_length=128
            )

            input_ids = encoding["input_ids"]
            attention_mask = encoding["attention_mask"]

            # Enable gradients ONLY for the embedding layer to save memory and time
            self.bias_model.zero_grad()
            
            # We only need gradients for the word embeddings to calculate importance
            for param in self.bias_model.bert.embeddings.word_embeddings.parameters():
                param.requires_grad = True

            # Use torch.enable_grad() since we might be inside a torch.no_grad() block
            import torch
            with torch.enable_grad():
                outputs = self.bias_model(input_ids=input_ids, attention_mask=attention_mask)
                logits = outputs.logits

                # Focus on "biased" class (index 1)
                bias_logit = logits[0, 1]
                bias_logit.backward()

            # Get gradients from embedding layer
            embedding_grad = self.bias_model.bert.embeddings.word_embeddings.weight.grad
            if embedding_grad is None:
                return []

            token_ids = input_ids[0]
            token_grads = embedding_grad[token_ids]

            # Importance score = L2 norm (as used in bias_module/predict.py)
            scores = torch.norm(token_grads, dim=1)
            tokens = self.bias_tokenizer.convert_ids_to_tokens(token_ids)

            # Filter tokens
            filtered = []
            for tok, score in zip(tokens, scores):
                if tok in ["[CLS]", "[SEP]", "[PAD]"] or tok.startswith("##"):
                    continue
                if not any(c.isalnum() for c in tok):
                    continue
                if tok.lower() in self.STOP_WORDS:
                    continue
                if len(tok) < 3 and tok.lower() not in ['a', 'i']:
                    continue
                
                filtered.append((tok, score.item()))

            # Sort by importance
            sorted_tokens = sorted(filtered, key=lambda x: x[1], reverse=True)
            return [{"word": t[0], "score": round(t[1] * 100, 2)} for t in sorted_tokens[:top_k]]
        except Exception as e:
            print(f"Gradient Calculation Error: {e}", file=sys.stderr)
            return []

    def get_bias_reasoning(self, text, label, bias_score):
        """
        Provides detailed reasoning for bias classification using the labels from predict.py.
        """
        if bias_score > 0.7:
            return "Interpretation: Strongly biased"
        elif bias_score > 0.5:
            return "Interpretation: Likely Biased"
        else:
            return "Interpretation: Likely Factual"

    def rate_bias_batch(self, sentences):
        """
        Rates bias for multiple sentences in a single batch for maximum performance.
        """
        if not sentences:
            return []

        if not self.bias_model:
            self.load_local_bias_model()

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
                    
                    results.append({
                        "label": label,
                        "score": bias_score,
                        "reasoning": reasoning
                    })
                return results
        except Exception as e:
            print(f"Batch Analysis Error: {e}", file=sys.stderr)
            return [self.rate_bias(s) for s in sentences]

    def rate_bias(self, text):
        """
        Rates bias for a given text and provides detailed reasoning and top biased words.
        """
        if not self.bias_model:
            self.load_local_bias_model()

        if not text or len(text.strip()) < 10:
            return {"label": "Neutral", "score": 0.0, "reasoning": "Text too short for analysis."}

        filtered_sentences = self.split_into_sentences(text)
        if not filtered_sentences:
            return {"label": "Neutral", "score": 0.0, "reasoning": "No valid content found."}
        
        filtered_text = " ".join(filtered_sentences)

        if self.bias_model and self.bias_tokenizer:
            try:
                inputs = self.bias_tokenizer(filtered_text, return_tensors="pt", truncation=True, padding=True, max_length=128)
                with torch.no_grad():
                    outputs = self.bias_model(**inputs)
                    probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
                    
                    bias_score = probs[0][1].item()
                    label = "Biased" if bias_score > 0.5 else "Factual"
                    
                    # Get top biased words for overall analysis
                    top_words = self.get_top_biased_words_gradient(filtered_text, top_k=8)
                    reasoning = self.get_bias_reasoning(filtered_text, label, bias_score)
                    
                    return {
                        "label": label, 
                        "score": bias_score,
                        "reasoning": reasoning,
                        "top_words": top_words
                    }
            except Exception as e:
                print(f"Local Model Prediction Error: {e}", file=sys.stderr)

        return {"label": "Offline", "score": 0.0, "reasoning": "Model failed or is offline."}


    def split_into_sentences(self, text):
        """
        Split text into a list of sentences and filter out advertisements/unwanted content.
        """
        if not text:
            return []
        
        # 1. Basic splitting
        sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text.strip())
        
        # 2. Advertisement and low-value sentence filtering
        ad_keywords = [
            "sign up for", "subscribe to", "advertisement", "promoted", 
            "sponsored", "click here", "follow us on", "read more", 
            "newsletter", "privacy policy", "terms of service", "cookies",
            "related stories", "recommended for you", "check out our",
            "all rights reserved", "photo by", "image credit", "copyright"
        ]
        
        filtered_sentences = []
        for s in sentences:
            s_clean = s.strip()
            if not s_clean:
                continue
            
            # Skip very short sentences (often UI fragments)
            if len(s_clean.split()) < 4:
                continue
                
            # Skip if it contains advertisement keywords
            s_lower = s_clean.lower()
            if any(keyword in s_lower for keyword in ad_keywords):
                continue
            
            filtered_sentences.append(s_clean)
            
        return filtered_sentences

    def fetch_newsdata(self, query=None, category=None, language="en"):
        if not self.newsdata_api_key: return []
        url = "https://newsdata.io/api/1/news"
        # Strictly enforce English
        params = {"apikey": self.newsdata_api_key, "language": "en"}
        if query: params["q"] = query
        if category and category != 'general': 
            params["category"] = category
        try:
            res = self.session.get(url, params=params)
            # print(f"DEBUG: NewsData.io API response status: {res.status_code}")
            data = res.json()
            # print(f"DEBUG: NewsData.io raw data: {str(data)[:500]}...") # Print first 500 chars
            if data.get("status") == "success":
                return [{
                    "title": r.get("title"), 
                    "link": r.get("link"), 
                    "source_id": r.get("source_id"), 
                    "pubDate": r.get("pubDate"),
                    "image_url": r.get("image_url"),
                    "snippet": r.get("description") or r.get("content")
                } for r in data.get("results", [])]
            return []
        except: return []

    def fetch_guardian(self, query=None, category=None):
        if not self.guardian_api_key or "your_" in self.guardian_api_key: return []
        url = "https://content.guardianapis.com/search"
        params = {"api-key": self.guardian_api_key, "show-fields": "thumbnail,trailText"}
        if query: 
            params["q"] = query
        
        # Map frontend categories to Guardian sections
        category_map = {
            'business': 'business',
            'technology': 'technology',
            'entertainment': 'culture',
            'health': 'society',
            'science': 'science',
            'sports': 'sport'
        }
        if category and category in category_map:
            params["section"] = category_map[category]

        try:
            res = self.session.get(url, params=params)
            data = res.json()
            results = data.get("response", {}).get("results", [])
            return [{
                "title": r.get("webTitle"), 
                "link": r.get("webUrl"), 
                "source_id": "The Guardian", 
                "pubDate": r.get("webPublicationDate"),
                "image_url": r.get("fields", {}).get("thumbnail"),
                "snippet": r.get("fields", {}).get("trailText")
            } for r in results]
        except: return []

    def fetch_all_news(self, query=None, category=None, language="en"):
        all_articles = []
        all_articles.extend(self.fetch_newsdata(query, category, language))
        all_articles.extend(self.fetch_guardian(query, category))

        # Deduplicate articles based on title
        unique_articles = []
        seen_titles = set()
        for article in all_articles:
            title = article.get("title")
            if title and title.lower() not in seen_titles:
                unique_articles.append(article)
                seen_titles.add(title.lower())
        
        # Sort by publication date
        try:
            unique_articles.sort(key=lambda x: x.get('pubDate', ''), reverse=True)
        except:
            pass

        # --- SCRAPABILITY FILTER ---
        # We only want to show articles that we can actually scrape content from.
        # Since scraping is slow, we use a thread pool and limit the number of articles we check.
        filtered_articles = []
        # Limit to top 15 most recent/relevant articles to ensure fast response time
        articles_to_check = unique_articles[:15]
        
        def check_article(article):
            url = article.get("link")
            if not url:
                return None
            
            # Simple check: can we get content?
            content = self.get_full_content(url)
            if content:
                # Store content temporarily to avoid re-scraping if needed, 
                # but for now we just return the article if it's scrapable
                return article
            return None

        with ThreadPoolExecutor(max_workers=5) as executor:
            results = list(executor.map(check_article, articles_to_check))
            filtered_articles = [r for r in results if r is not None]

        # If we have very few articles after filtering, maybe check a few more 
        # but don't exceed the API timeout
        if len(filtered_articles) < 5 and len(unique_articles) > 15:
            extra_to_check = unique_articles[15:25]
            with ThreadPoolExecutor(max_workers=5) as executor:
                extra_results = list(executor.map(check_article, extra_to_check))
                filtered_articles.extend([r for r in extra_results if r is not None])

        return filtered_articles

    def get_full_content(self, url):
        try:
            headers = {
                'User-Agent': self.config.browser_user_agent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
            response = self.session.get(url, headers=headers, timeout=self.config.request_timeout)
            if response.status_code != 200:
                return None
            
            # Fast check: skip known paywall messages in raw HTML
            html_lower = response.text.lower()
            quick_fail_terms = ["subscribe to continue", "paywall", "premium access", "log in to read", "javascript is required"]
            if any(term in html_lower for term in quick_fail_terms):
                return None

            article = Article(url, config=self.config)
            article.set_html(response.text)
            article.parse()
            
            # Use raw extracted text, no truncation or AI here.
            text = article.text.strip()
            
            # --- STRICT SCANNING FILTER ---
            # If text is too short, it's likely a paywall or failed extraction
            if not text or len(text) < 400:
                return None
            
            system_errors = [
                "javascript is required", "enable javascript", "allow cookies", "cookie policy",
                "subscribe to continue", "log in to read", "premium access", "paywall",
                "watch the video", "live updates", "photo gallery", "video-only",
                "forbidden", "access denied", "403", "404"
            ]
            text_lower = text.lower()
            if any(err in text_lower for err in system_errors):
                return None
            
            return text
        except Exception as e:
            return None

    def summarize_content(self, text):
        if not self.hf_client or not text or len(text.strip()) < 100:
            return None
        try:
            truncated_text = text[:2000] # Reduced from 3500 to 2000
            # Use a faster, smaller summarization model
            response = self.hf_client.summarization(
                truncated_text,
                model="facebook/bart-large-cnn" 
            )
            
            # Extract summary_text safely
            if hasattr(response, 'summary_text'):
                return response.summary_text
            if isinstance(response, list) and len(response) > 0:
                return response[0].get('summary_text') if isinstance(response[0], dict) else str(response[0])
            if isinstance(response, dict):
                return response.get('summary_text')
            
            return str(response)
        except Exception as e:
            # Silently fail as requested
            return None

if __name__ == "__main__":
    service = NewsService()
    test_text = "The tower is 324 metres (1,063 ft) tall, about the same height as an 81-storey building, and the tallest structure in Paris. Its base is square, measuring 125 metres (410 ft) on each side. During its construction, the Eiffel Tower surpassed the Washington Monument to become the tallest man-made structure in the world, a title it held for 41 years until the Chrysler Building in New York City was finished in 1930. It was the first structure to reach a height of 300 metres. Due to the addition of a broadcasting aerial at the top of the tower in 1957, it is now taller than the Chrysler Building by 5.2 metres (17 ft). Excluding transmitters, the Eiffel Tower is the second tallest free-standing structure in France after the Millau Viaduct."
    print(f"Summary: {service.summarize_content(test_text)}")
