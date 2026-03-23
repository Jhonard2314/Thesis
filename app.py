import streamlit as st
from news_service import NewsService
import pandas as pd

# Page Configuration
st.set_page_config(
    page_title="AI News Generator & Summarizer",
    page_icon="📰",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better UI
st.markdown("""
    <style>
    .main {
        background-color: #f8f9fa;
    }
    .stArticle {
        background-color: white;
        padding: 2rem;
        border-radius: 10px;
        border: 1px solid #e9ecef;
        margin-bottom: 2rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .full-content {
        color: #212529;
        font-size: 1.1rem;
        line-height: 1.6;
        margin-top: 1rem;
        margin-bottom: 1rem;
        padding: 1.5rem;
        background-color: #ffffff;
        border-left: 5px solid #007bff;
    }
    .summary-content {
        background-color: #e7f3ff;
        padding: 1.5rem;
        border-radius: 8px;
        border: 1px solid #b8daff;
        color: #004085;
        font-style: italic;
    }
    .meta-info {
        color: #6c757d;
        font-size: 0.9rem;
        margin-bottom: 1rem;
    }
    </style>
    """, unsafe_allow_html=True)

def fetch_and_display_news(query, news_service, title=None):
    if title:
        st.subheader(title)
    
    spinner_text = f"🔍 Searching for articles about '{query}'..." if query else "🔍 Fetching latest headlines..."
    with st.spinner(spinner_text):
        articles = news_service.fetch_all_news(query=query, language="en")
        
        if not articles:
            st.error("No articles found for this topic. Please try another one.")
        else:
            if query:
                st.success(f"✅ Found {len(articles)} articles!")
            
            found_any = False
            for idx, article in enumerate(articles):
                url = article.get('link')
                if not url:
                    continue
                    
                full_content = news_service.get_full_content(url)
                
                if full_content:
                    found_any = True
                    summary = news_service.summarize_content(full_content)
                    sentences = news_service.split_into_sentences(full_content)
                    
                    with st.container():
                        st.markdown('<div class="stArticle">', unsafe_allow_html=True)
                        st.header(article.get('title', 'No Title'))
                        st.markdown(f"""
                            <div class="meta-info">
                                <b>Source:</b> {article.get('source_id', 'Unknown')} | 
                                <b>Date:</b> {article.get('pubDate', 'Unknown')} | 
                                <a href="{url}" target="_blank">Original Link</a>
                            </div>
                        """, unsafe_allow_html=True)
                        
                        st.subheader("Full Article (Numbered Sentences for Bias Detection)")
                        
                        # Display sentences as a numbered list
                        sentence_html = ""
                        for i, sentence in enumerate(sentences, 1):
                            sentence_html += f'<div style="margin-bottom: 8px;"><b>{i}.</b> {sentence}</div>'
                        
                        st.markdown(f'<div class="full-content">{sentence_html}</div>', unsafe_allow_html=True)
                        
                        if summary:
                            st.subheader("Summarization")
                            st.markdown(f'<div class="summary-content">🤖 {summary}</div>', unsafe_allow_html=True)
                        
                        st.markdown('</div>', unsafe_allow_html=True)
                        st.divider()
            
            if not found_any:
                st.warning("Could not retrieve full content for any articles. The sources might be protected or paywalled.")

def main():
    st.title("📰 AI News Generator & Summarizer")
    st.markdown("Your AI-powered gateway to the latest news from around the world.")

    # Initialize session state for query and search trigger
    if 'search_query' not in st.session_state:
        st.session_state.search_query = ""
    if 'trigger_search' not in st.session_state:
        st.session_state.trigger_search = False
    if 'is_home' not in st.session_state:
        st.session_state.is_home = True

    # Sidebar
    st.sidebar.header("Search Settings")
    query_input = st.sidebar.text_input("Enter Topic", value=st.session_state.search_query, placeholder="e.g. Artificial Intelligence, Space, Finance")
    
    # Update session state if input changes manually
    if query_input != st.session_state.search_query:
        st.session_state.search_query = query_input
        st.session_state.is_home = False

    # Initialize Service
    news_service = NewsService()

    # Manual search button
    if st.sidebar.button("Fetch News", type="primary"):
        st.session_state.trigger_search = True
        st.session_state.is_home = False

    # Reset to Home button
    if st.sidebar.button("🏠 Home"):
        st.session_state.search_query = ""
        st.session_state.trigger_search = False
        st.session_state.is_home = True
        st.rerun()

    # Handle search execution
    if st.session_state.trigger_search and st.session_state.search_query:
        fetch_and_display_news(st.session_state.search_query, news_service)
        st.session_state.trigger_search = False # Reset trigger after search
    elif st.session_state.trigger_search and not st.session_state.search_query:
        st.sidebar.error("Please enter a topic!")
        st.session_state.trigger_search = False

    # Home View: Latest Headlines and Popular Topics
    if st.session_state.is_home:
        st.subheader("Latest Headlines")
        fetch_and_display_news(None, news_service)
        
        st.divider()
        st.subheader("Popular Topics")
        cols = st.columns(3)
        topics = ["Technology", "Science", "Business"]
        for i, t in enumerate(topics):
            with cols[i]:
                if st.button(f"Latest in {t}"):
                    st.session_state.search_query = t
                    st.session_state.trigger_search = True
                    st.session_state.is_home = False
                    st.rerun()

if __name__ == "__main__":
    main()
