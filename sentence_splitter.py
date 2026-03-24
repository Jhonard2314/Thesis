import re
from news_service import NewsService

def split_into_sentences(text):
    """
    Split text into a list of sentences using regex.
    This handles most common cases like '.', '!', '?' while ignoring common abbreviations.
    """
    if not text:
        return []
    
    # Simple but effective regex for sentence splitting
    # It looks for ending punctuation followed by a space and a capital letter
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text.strip())
    
    # Further clean up any leftover whitespace
    return [s.strip() for s in sentences if s.strip()]

def main():
    service = NewsService()
    
    # Topic to fetch an article from
    topic = "technology"
    print(f"🔍 Fetching one article about '{topic}' to demonstrate sentence splitting...")
    
    articles = service.fetch_all_news(query=topic)
    
    if not articles:
        print("No articles found.")
        return

    # Take the first article that has a valid link
    article = None
    full_content = None
    
    for a in articles:
        url = a.get('link')
        if url:
            print(f"📄 Article Title: {a.get('title')}")
            print(f"🔗 Source: {a.get('source_id')}")
            print(f"⏳ Extracting full text...")
            full_content = service.get_full_content(url)
            if full_content:
                article = a
                break
    
    if not full_content:
        print("Could not retrieve full content for any article.")
        return

    print("\n" + "="*80)
    print("FULL ARTICLE TEXT:")
    print("-" * 80)
    print(full_content[:500] + "..." if len(full_content) > 500 else full_content)
    print("="*80 + "\n")

    # Divide into sentences
    sentences = split_into_sentences(full_content)

    print(f"📋 DIVIDED INTO {len(sentences)} SENTENCES:")
    print("-" * 80)
    for i, sentence in enumerate(sentences, 1):
        print(f"{i}. {sentence}")
        print("-" * 40) # Smaller separator for readability

if __name__ == "__main__":
    main()
