
import sys
import os
import json
import argparse

# Add current directory to sys.path to access our news_service and model locally
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from news_service import NewsService

# Helper to print only valid JSON to stdout
def print_json(data):
    # Ensure stdout is clean by flushing and then printing our JSON
    sys.stdout.flush()
    print(json.dumps(data))
    sys.stdout.flush()

def main():
    try:
        # Check for essential modules before starting
        try:
            import requests
        except ImportError:
            print_json({"error": "Essential Python libraries (requests) are not installed on the server. Deployment environment is incomplete."})
            return

        parser = argparse.ArgumentParser(description='Bridge logic for NewsApex UI')
        parser.add_argument('action', choices=['fetch_news', 'get_summary', 'analyze_bias'], help='Action to perform')
        parser.add_argument('--query', help='Search query for news')
        parser.add_argument('--category', help='News category')
        parser.add_argument('--url', help='Article URL for analysis')
        
        args = parser.parse_args()
        service = NewsService()

        if args.action == 'fetch_news':
            # Use our filtered news fetching logic with images
            articles = service.fetch_all_news(query=args.query, category=args.category)
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
            print_json({"articles": transformed})

        elif args.action == 'get_summary':
            if not args.url:
                print_json({"error": "URL required"})
                return

            # 1. Get content
            content = service.get_full_content(args.url)
            if not content:
                print_json({"error": "Could not retrieve content for this article."})
                return

            # 2. Summarization (truncated)
            summary = service.summarize_content(content[:2000])
            
            print_json({
                "summary": summary,
                "full_content": content # We keep this for bias analysis later
            })

        elif args.action == 'analyze_bias':
            if not args.url:
                print_json({"error": "URL required"})
                return

            # 1. Get content
            content = service.get_full_content(args.url)
            if not content:
                print_json({"error": "Could not retrieve content for this article."})
                return

            # 2. Analyze overall bias
            overall = service.rate_bias(content)
            
            # 3. Sentence-by-sentence analysis (Analyze a subset of the article for highlighting)
            sentences = service.split_into_sentences(content)
            # Limit to the first 25 sentences to avoid timeout, while still giving a good breakdown
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

                # Always show the raw bias score from the model
                display_score = res["score"]

                sentence_results.append({
                    "text": analysis_sentences[i],
                    "label": label,
                    "score": round(display_score * 100, 1),
                    "reasoning": res.get("reasoning", "")
                })

            # Determine overall level
            bias_prob = overall["score"]
            if bias_prob > 0.7:
                level = "High"
            elif bias_prob > 0.5:
                level = "Medium"
            else:
                level = "Low"
            
            # Show the raw bias score from the model
            overall_display_score = bias_prob
            
            print_json({
                "bias_level": level,
                "bias_score": round(overall_display_score * 100, 1),
                "explanation": overall.get("reasoning", "No specific reasoning provided."),
                "top_words": overall.get("top_words", []),
                "sentence_breakdown": sentence_results,
                "factual_count": factual_count,
                "biased_count": biased_count,
                "total_sentences_analyzed": len(analysis_sentences),
                "full_content": content
            })
    except Exception as e:
        import sys
        print_json({"error": str(e)})
        print(f"Bridge Error: {str(e)}", file=sys.stderr)

if __name__ == "__main__":
    main()
