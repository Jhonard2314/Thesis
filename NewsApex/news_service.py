import sys
import os
import re
import requests
from dotenv import load_dotenv
from newspaper import Article, Config
from huggingface_hub import InferenceClient
from concurrent.futures import ThreadPoolExecutor
import torch
from transformers import BertTokenizer, BertForSequenceClassification

# Add current directory to path for imports
base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(base_dir)

# Load .env from current dir or parent dir
load_dotenv(os.path.join(base_dir, ".env"))
load_dotenv(os.path.join(os.path.dirname(base_dir), ".env"))

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
        self.newsdata_api_key = os.getenv("NEWSDATA_API_KEY", "pub_c319de1ec46240dc912d9b112e01c866")
        self.guardian_api_key = os.getenv("GUARDIAN_API_KEY", "438ab5df-f19b-42b6-9ca9-83b8e971f219")
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

    def load_local_bias_model(self):
        try:
            from bias_module import config as bias_config
            base_path = os.path.dirname(os.path.abspath(__file__))
            model_path = os.path.join(base_path, "bias_module", "models", "bert_babe.pt")
            model_cache_dir = os.path.join(base_path, "bias_module", "data", "model_cache")
            
            if os.path.exists(model_path):
                if os.path.exists(model_cache_dir):
                    from transformers import BertConfig
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
        except Exception as e:
            print(f"Error loading local bias model: {e}", file=sys.stderr)

    def get_top_biased_words_gradient(self, text, top_k=5):
        if not self.bias_model or not self.bias_tokenizer:
            return []
        try:
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
        if not self.guardian_api_key or "your_" in self.guardian_api_key: return []
        url = "https://content.guardianapis.com/search"
        params = {"api-key": self.guardian_api_key, "show-fields": "thumbnail,trailText"}
        if query: params["q"] = query
        category_map = {'business': 'business', 'technology': 'technology', 'entertainment': 'culture', 'health': 'society', 'science': 'science', 'sports': 'sport'}
        if category and category in category_map: params["section"] = category_map[category]
        try:
            res = self.session.get(url, params=params, timeout=10)
            data = res.json()
            results = data.get("response", {}).get("results", [])
            return [{"title": r.get("webTitle"), "link": r.get("webUrl"), "source_id": "The Guardian", "pubDate": r.get("webPublicationDate"), "image_url": r.get("fields", {}).get("thumbnail"), "snippet": r.get("fields", {}).get("trailText")} for r in results]
        except: return []

    def fetch_all_news(self, query=None, category=None, language="en"):
        all_articles = []
        all_articles.extend(self.fetch_newsdata(query, category, language))
        all_articles.extend(self.fetch_guardian(query, category))
        unique_articles = []
        seen_titles = set()
        for article in all_articles:
            title = article.get("title")
            if title and title.lower() not in seen_titles:
                unique_articles.append(article)
                seen_titles.add(title.lower())
        try:
            unique_articles.sort(key=lambda x: x.get('pubDate', ''), reverse=True)
        except: pass
        return unique_articles[:20]

    def get_full_content(self, url):
        try:
            headers = {'User-Agent': self.config.browser_user_agent}
            response = self.session.get(url, headers=headers, timeout=20)
            if response.status_code != 200: return None
            article = Article(url, config=self.config)
            article.set_html(response.text)
            article.parse()
            text = article.text.strip()
            if not text or len(text) < 200: return None
            return text
        except Exception as e:
            print(f"Extraction error: {e}", file=sys.stderr)
            return None

    def summarize_content(self, text):
        if not self.hf_client or not text or len(text.strip()) < 100: return None
        try:
            truncated_text = text[:3000]
            response = self.hf_client.summarization(truncated_text, model="facebook/bart-large-cnn")
            if hasattr(response, 'summary_text'): return response.summary_text
            if isinstance(response, list) and len(response) > 0: return response[0].get('summary_text') if isinstance(response[0], dict) else str(response[0])
            if isinstance(response, dict): return response.get('summary_text')
            return str(response)
        except Exception as e:
            print(f"Summary error: {e}", file=sys.stderr)
            return None
