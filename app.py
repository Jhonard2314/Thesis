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
    /* header {
        visibility: hidden !important;
    } */
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
@st.cache_resource
def get_news_service():
    return NewsService()

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

@st.cache_data(show_spinner=False)
def cached_rate_bias(_service, text):
    return _service.rate_bias(text)
# ------------------------

def fetch_and_display_news(query, news_service, title=None, bias_mode=False):
    if title:
        st.subheader(title)
    
    spinner_text = f"🔍 Searching for articles about '{query}'..." if query else "🔍 Fetching latest headlines..."
    with st.spinner(spinner_text):
        try:
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
                                st.subheader("⚖️ Bias Analysis")
                                overall_bias = cached_rate_bias(news_service, full_content)
                                
                                # Display overall rating
                                col_b1, col_b2 = st.columns([1, 3])
                                with col_b1:
                                    color = "red" if overall_bias['label'] == "Biased" else "green"
                                    st.markdown(f"**Overall Rating:** <span style='color:{color}; font-weight:bold;'>{overall_bias['label']}</span>", unsafe_allow_html=True)
                                with col_b2:
                                    st.progress(overall_bias['score'], text=f"Confidence: {overall_bias['score']:.1%}")

                                st.subheader("📋 Full Article (Numbered Sentences for Bias Detection)")
                                sentences = cached_split_into_sentences(news_service, full_content)
                                # Display sentences as a numbered list
                                sentence_html = ""
                                for i, sentence in enumerate(sentences, 1):
                                    # Rate individual sentence bias
                                    s_bias = cached_rate_bias(news_service, sentence)
                                    s_label = s_bias.get('label', 'Factual')
                                    s_color = "rgba(255, 0, 0, 0.1)" if s_label == "Biased" else "transparent"
                                    
                                    # Escape each sentence
                                    escaped_sentence = html.escape(sentence)
                                    # Use a single line to avoid accidental markdown code block triggers
                                    # We access the dictionary keys outside the f-string to avoid quoting issues
                                    sentence_html += f'<div style="margin-bottom: 8px; padding: 4px; background-color: {s_color}; border-radius: 4px;"><b>{i}.</b> {escaped_sentence} <span style="font-size: 0.8rem; color: gray; margin-left: 10px;">({s_label})</span></div>'
                                
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
        except Exception as e:
            st.error(f"An error occurred while fetching news: {str(e)}")

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

    # Initialize Service (Cached)
    with st.sidebar:
        st.header("Search Settings")
        news_service = get_news_service()
        
        query_input = st.text_input("Enter Topic", value=st.session_state.search_query, placeholder="e.g. Artificial Intelligence, Space, Finance")
        
        # Bias Detection Toggle
        bias_mode = st.toggle("Bias Detection Mode", help="Enable to see articles broken down into numbered sentences.")

        # Update session state if input changes manually
        if query_input != st.session_state.search_query:
            st.session_state.search_query = query_input
            st.session_state.is_home = False

        # Manual search button
        if st.button("Fetch News", type="primary"):
            st.session_state.trigger_search = True
            st.session_state.is_home = False

        # Clear Cache button
        if st.button("🧹 Clear Cache"):
            st.cache_data.clear()
            st.success("Cache cleared! Reloading...")
            time.sleep(0.5)
            st.rerun()

        # Reset to Home button
        if st.button("🏠 Home"):
            st.session_state.search_query = ""
            st.session_state.trigger_search = False
            st.session_state.is_home = True
            st.rerun()

        # Model Status indicator
        if news_service.bias_model:
            st.success("✅ Local Model Loaded")
        else:
            st.info("☁️ Using Cloud Fallback")

    # Handle search execution
    if st.session_state.trigger_search and st.session_state.search_query:
        st.session_state.is_home = False # Ensure we're not in home view
        st.write(f"DEBUG: Searching for {st.session_state.search_query}") # DEBUG
        fetch_and_display_news(st.session_state.search_query, news_service, title="Search Results", bias_mode=bias_mode)
        st.session_state.trigger_search = False # Reset trigger after search
    elif st.session_state.trigger_search and not st.session_state.search_query:
        st.sidebar.error("Please enter a topic!")
        st.session_state.trigger_search = False

    # Home View: Latest Headlines
    if st.session_state.is_home:
        fetch_and_display_news(None, news_service, title="Latest Headlines", bias_mode=bias_mode)


if __name__ == "__main__":
    main()
