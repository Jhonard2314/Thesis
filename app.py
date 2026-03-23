import streamlit as st
from news_service import NewsService
import pandas as pd
import html
import time

# Page Configuration
st.set_page_config(
    page_title="NEXTER",
    page_icon="📰",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better UI and to hide Deploy/Stop buttons
st.markdown("""
    <style>
    /* Hide Deploy button */
    .stAppDeployButton {
        display: none !important;
    }
    /* Hide the 'Stop' button and the running status indicator to clean up UI */
    [data-testid="stStatusWidget"] {
        display: none !important;
    }
    /* Hide the Main Menu (three dots/hamburger menu) */
    #MainMenu {
        visibility: hidden !important;
    }
    /* Hide the footer (Made with Streamlit) */
    footer {
        visibility: hidden !important;
    }
    /* Hide the header bar entirely */
    header {
        visibility: hidden !important;
    }
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
        white-space: pre-wrap;
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

# --- CACHED FUNCTIONS ---
@st.cache_data(show_spinner=False, ttl=3600)
def cached_fetch_all_news(_service, query, language="en"):
    return _service.fetch_all_news(query=query, language=language)

@st.cache_data(show_spinner=False, ttl=86400)
def cached_get_full_content(_service, url):
    return _service.get_full_content(url)

@st.cache_data(show_spinner=False, ttl=86400)
def cached_summarize_content(_service, text):
    return _service.summarize_content(text)

@st.cache_data(show_spinner=False)
def cached_split_into_sentences(_service, text):
    return _service.split_into_sentences(text)
# ------------------------

def fetch_and_display_news(query, news_service, title=None, bias_mode=False):
    if title:
        st.subheader(title)
    
    spinner_text = f"🔍 Searching for articles about '{query}'..." if query else "🔍 Fetching latest headlines..."
    with st.spinner(spinner_text):
        # Use cached news fetching
        articles = cached_fetch_all_news(news_service, query, language="en")
        
        if not articles:
            st.error("No articles found for this topic. Please try another one.")
        else:
            # Limit to 10 articles to avoid endless fetching/loading
            articles = articles[:10]
            
            if query:
                st.success(f"✅ Found {len(articles)} articles!")
            
            found_any = False
            for idx, article in enumerate(articles):
                url = article.get('link')
                if not url:
                    continue
                
                # Use cached content extraction
                full_content = cached_get_full_content(news_service, url)
                
                if full_content:
                    found_any = True
                    # Use cached summarization and sentence splitting
                    summary = cached_summarize_content(news_service, full_content)
                    
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
                        
                        if bias_mode:
                            st.subheader("Full Article (Numbered Sentences for Bias Detection)")
                            sentences = cached_split_into_sentences(news_service, full_content)
                            # Display sentences as a numbered list
                            sentence_html = ""
                            for i, sentence in enumerate(sentences, 1):
                                # Escape each sentence
                                escaped_sentence = html.escape(sentence)
                                sentence_html += f'<div style="margin-bottom: 8px;"><b>{i}.</b> {escaped_sentence}</div>'
                            st.markdown(f'<div class="full-content">{sentence_html}</div>', unsafe_allow_html=True)
                        else:
                            st.subheader("Full Article")
                            # Escape the full content to ensure it's not cut off by HTML tags
                            escaped_content = html.escape(full_content)
                            st.markdown(f'<div class="full-content">{escaped_content}</div>', unsafe_allow_html=True)
                        
                        if summary:
                            st.subheader("Summarization")
                            st.markdown(f'<div class="summary-content">🤖 {summary}</div>', unsafe_allow_html=True)
                        
                        st.markdown('</div>', unsafe_allow_html=True)
                        st.divider()
            
            if not found_any:
                st.warning("Could not retrieve full content for any articles. The sources might be protected or paywalled.")

def main():
    st.title("📰 NEXTER")
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
    
    # Bias Detection Toggle
    bias_mode = st.sidebar.toggle("Bias Detection Mode", help="Enable to see articles broken down into numbered sentences.")

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

    # Clear Cache button
    if st.sidebar.button("🧹 Clear Cache"):
        st.cache_data.clear()
        st.success("Cache cleared! Reloading...")
        time.sleep(0.5)
        st.rerun()

    # Reset to Home button
    if st.sidebar.button("🏠 Home"):
        st.session_state.search_query = ""
        st.session_state.trigger_search = False
        st.session_state.is_home = True
        st.rerun()

    # Handle search execution
    if st.session_state.trigger_search and st.session_state.search_query:
        fetch_and_display_news(st.session_state.search_query, news_service, bias_mode=bias_mode)
        st.session_state.trigger_search = False # Reset trigger after search
    elif st.session_state.trigger_search and not st.session_state.search_query:
        st.sidebar.error("Please enter a topic!")
        st.session_state.trigger_search = False

    # Home View: Latest Headlines
    if st.session_state.is_home:
        st.subheader("Latest Headlines")
        fetch_and_display_news(None, news_service, bias_mode=bias_mode)

if __name__ == "__main__":
    main()
