from news_service import NewsService
import sys
from colorama import init, Fore, Style

# Initialize colorama
init(autoreset=True)

def display_article(article, full_content, summary=None, sentences=None):
    """
    Displays the full article content followed by the summarization with precise labeling.
    """
    print("\n" + "=" * 80)
    print(f"{Fore.CYAN}{Style.BRIGHT}TITLE: {article.get('title', 'No Title')}")
    print("-" * 80)
    print(f"{Fore.YELLOW}Source: {article.get('source_id', 'Unknown')}")
    print(f"{Fore.YELLOW}Date: {article.get('pubDate', 'Unknown')}")
    print(f"{Fore.BLUE}Link: {article.get('link', 'No Link')}")
    print("-" * 80)
    
    # Label: Full Article (Essential for bias detection model)
    print(f"{Style.BRIGHT}Full Article (Numbered Sentences for Bias Detection):")
    if sentences:
        for i, sentence in enumerate(sentences, 1):
            print(f"{i}. {sentence}")
    else:
        print(f"{full_content}")
    
    # Essential separator line before summarization
    print("-" * 80)

    # Label: Summarization (Based on the full article content)
    if summary:
        print(f"{Style.BRIGHT}Summarization:")
        print(summary)
    else:
        print(f"{Style.BRIGHT}Summarization: Not available (extraction/summarization skipped)")
    
    print("=" * 80 + "\n")

def main():
    service = NewsService()
    
    print(f"{Fore.CYAN}{Style.BRIGHT}📰 Welcome to the Full Article Generator & Summarizer!")
    print(f"{Fore.WHITE}Sources: NewsData.io, The Guardian, New York Times")
    
    while True:
        try:
            query = input(f"\n{Fore.WHITE}Enter a topic to search (or 'exit' to quit): ").strip()
            
            if query.lower() == 'exit':
                print(f"{Fore.CYAN}Goodbye!")
                break
            
            if not query:
                continue
            
            print(f"\n🔍 Searching for articles about '{Fore.YELLOW}{query}{Fore.WHITE}'...")
            articles = service.fetch_all_news(query=query)
            
            if not articles:
                print(f"{Fore.RED}No articles found for this topic.")
                continue
            
            found_any = False
            for article in articles:
                url = article.get('link')
                if not url:
                    continue
                
                # Simple processing message
                print(f"⏳ Processing: {article.get('title')[:50]}...")
                
                # Fetch full content silently
                full_content = service.get_full_content(url)
                
                # Only display if we have the FULL content
                if full_content:
                    found_any = True
                    
                    # Fetch summary silently
                    summary = service.summarize_content(full_content)
                    
                    # Fetch sentences for bias detection
                    sentences = service.split_into_sentences(full_content)
                    
                    # Display the article
                    display_article(article, full_content, summary, sentences)
                    
                    cont = input(f"{Fore.WHITE}Press [Enter] for next article, or 'q' to search again: ").strip().lower()
                    if cont == 'q':
                        break
            
            if not found_any:
                print(f"{Fore.RED}Could not retrieve full content for any articles in this search. Try another topic.")
                    
        except KeyboardInterrupt:
            print(f"\n{Fore.RED}Exiting...")
            break
        except Exception:
            # Silent failure for general exceptions as requested
            continue

if __name__ == "__main__":
    main()
