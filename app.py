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
        background-color: #f0f2f6;
    }
    .stCard {
        background-color: white;
        padding: 1rem;
        border-radius: 12px;
        border: 1px solid #e0e0e0;
        margin-bottom: 1.5rem;
        box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        transition: transform 0.2s ease-in-out;
        height: 480px; /* Fixed height for alignment */
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .stCard:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 15px rgba(0,0,0,0.1);
    }
    .card-img {
        width: 100%;
        height: 200px; /* Fixed image height */
        object-fit: cover;
        border-radius: 8px;
        margin-bottom: 0.8rem;
        background-color: #f8f9fa;
        display: block;
    }
    .card-img-placeholder {
        width: 100%;
        height: 200px;
        background-color: #e9ecef;
        border-radius: 8px;
        margin-bottom: 0.8rem;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #adb5bd;
        font-size: 0.9rem;
    }
    .card-title {
        font-size: 1.1rem;
        font-weight: 700;
        color: #1a1a1a;
        margin-bottom: 0.5rem;
        line-height: 1.4;
        height: 4.2rem; /* Fixed height for 3 lines of text */
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .card-meta {
        font-size: 0.8rem;
        color: #6c757d;
        margin-bottom: 0.5rem;
    }
    .stArticle {
        background-color: white;
        padding: 2.5rem;
        border-radius: 15px;
        border: 1px solid #e9ecef;
        box-shadow: 0 10px 25px rgba(0,0,0,0.05);
    }
    .full-content {
        color: #212529;
        font-size: 1.1rem;
        line-height: 1.6;
        margin-top: 1rem;
        margin-bottom: 1rem;
        padding: 0;
        background-color: transparent;
        border-left: none;
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

def display_article_detail(article, news_service):
    """Displays the detailed view of a selected article with bias analysis and summary."""
    if st.button("← Back to Feed"):
        st.session_state.selected_article = None
        st.rerun()

    url = article.get('link')
    if not url:
        st.error("Invalid article link.")
        return

    st.markdown('<div class="stArticle">', unsafe_allow_html=True)
    st.title(article.get('title', 'No Title'))
    
    # Hero image
    img_url = article.get('image_url')
    if img_url:
        st.image(img_url, use_container_width=True)

    st.markdown(f"""
        <div class="meta-info">
            <b>Source:</b> {article.get('source_id', 'Unknown')} | 
            <b>Date:</b> {article.get('pubDate', 'Unknown')} | 
            <a href="{url}" target="_blank">Original Link</a>
        </div>
    """, unsafe_allow_html=True)

    with st.spinner("🧠 Analyzing article content..."):
        full_content = cached_get_full_content(news_service, url)
        
        # --- ROBUST FALLBACK LOGIC ---
        text_to_analyze = full_content
        status_msg = None
        
        # 1. Try Full Content
        if not text_to_analyze or len(text_to_analyze.strip()) < 100:
            # 2. Try Snippet/Description
            text_to_analyze = article.get('snippet')
            if text_to_analyze and len(text_to_analyze.strip()) > 20:
                status_msg = "⚠️ Full content extraction limited. Analyzing article snippet."
            else:
                # 3. Last Resort: Use Title
                text_to_analyze = article.get('title', '')
                status_msg = "⚠️ No content found. Analyzing article headline only."
            
        if not text_to_analyze:
            st.error("Could not retrieve any text for this article.")
            return

        if status_msg:
            st.warning(status_msg)

        # Display the text being analyzed
        with st.expander("📖 View Analyzed Text", expanded=True):
            st.markdown(f'<div style="font-size: 1rem; line-height: 1.5; color: #333;">{html.escape(text_to_analyze)}</div>', unsafe_allow_html=True)

        # AI Summary
        summary = cached_summarize_content(news_service, text_to_analyze)
        if summary:
            st.info(f"🤖 **AI Summary:** {summary}")
        
        st.divider()

        # Bias Analysis
        st.subheader("⚖️ Bias Analysis")
        overall_bias = cached_rate_bias(news_service, text_to_analyze)
        
        col_b1, col_b2 = st.columns([1, 3])
        with col_b1:
            color = "#dc3545" if overall_bias['label'] == "Biased" else "#28a745"
            st.markdown(f"**Overall Rating:** <span style='color:{color}; font-weight:bold; font-size:1.2rem;'>{overall_bias['label']}</span>", unsafe_allow_html=True)
        with col_b2:
            st.progress(overall_bias['score'], text=f"Confidence: {overall_bias['score']:.1%}")

        # --- Interpretation Section ---
        if overall_bias['label'] == "Factual":
            st.success("✅ **Interpretation: Factual Content**\nThis article primarily uses objective language, reports verifiable events, and avoids subjective modifiers or emotional framing. It aims to inform rather than influence.")
        else:
            st.error("⚠️ **Interpretation: Biased Content**\nThis article contains elements that suggest a non-neutral perspective. This could include the use of loaded language, emotional appeals, or selective framing designed to influence the reader's opinion.")

        o_reasoning = overall_bias.get('reasoning', 'No specific reasoning provided.')
        st.warning(f"💡 **Analysis Reasoning:** {o_reasoning}")

        st.subheader("📋 Sentence-by-Sentence Breakdown")
        sentences = cached_split_into_sentences(news_service, text_to_analyze)
        
        sentence_html = ""
        for i, sentence in enumerate(sentences, 1):
            s_bias = cached_rate_bias(news_service, sentence)
            s_label = s_bias.get('label', 'Factual')
            s_reasoning = s_bias.get('reasoning', '')
            s_color = "rgba(220, 53, 69, 0.08)" if s_label == "Biased" else "transparent"
            
            escaped_sentence = html.escape(sentence)
            escaped_reasoning = html.escape(s_reasoning)
            
            reasoning_html = f'<div style="font-size: 0.85rem; color: #721c24; margin-top: 4px; font-style: italic;">Why? {escaped_reasoning}</div>' if s_label == "Biased" else ""
            
            border_style = "border-left: 4px solid #dc3545;" if s_label == "Biased" else "border-left: 4px solid #e9ecef;"
            sentence_html += f'<div style="margin-bottom: 12px; padding: 12px; background-color: {s_color}; border-radius: 6px; {border_style}"><b>{i}.</b> {escaped_sentence} <span style="font-size: 0.8rem; color: #6c757d; margin-left: 10px; font-weight: bold;">[{s_label}]</span>{reasoning_html}</div>'
        
        st.markdown(f'<div class="full-content" style="border:none; padding:0;">{sentence_html}</div>', unsafe_allow_html=True)
    
    st.markdown('</div>', unsafe_allow_html=True)

def fetch_and_display_news(query, news_service, title=None):
    """Fetches and displays news in a grid layout."""
    if title:
        st.subheader(title)
    
    spinner_text = f"🔍 Searching for '{query}'..." if query else "🔍 Fetching latest headlines..."
    with st.spinner(spinner_text):
        try:
            articles = cached_fetch_all_news(news_service, query, language="en")
            
            if not articles:
                st.error("No articles found for this topic. Please try another one.")
                return

            # Grid layout: 3 columns
            articles = articles[:12]
            cols = st.columns(3)
            for idx, article in enumerate(articles):
                with cols[idx % 3]:
                    st.markdown('<div class="stCard">', unsafe_allow_html=True)
                    
                    # Thumbnail Image handling
                    img_url = article.get('image_url')
                    if img_url and img_url.startswith('http'):
                        st.markdown(f'<img src="{img_url}" class="card-img" onerror="this.style.display=\'none\'; this.nextSibling.style.display=\'flex\';">', unsafe_allow_html=True)
                        st.markdown('<div class="card-img-placeholder" style="display:none;">🖼️ Image Unavailable</div>', unsafe_allow_html=True)
                    else:
                        st.markdown('<div class="card-img-placeholder">🖼️ No Image</div>', unsafe_allow_html=True)
                    
                    # Source and Date
                    date_str = article.get('pubDate', 'Unknown')[:10]
                    st.markdown(f'<div class="card-meta">{article.get("source_id", "Unknown")} • {date_str}</div>', unsafe_allow_html=True)
                    
                    # Title
                    st.markdown(f'<div class="card-title">{article.get("title", "No Title")}</div>', unsafe_allow_html=True)
                    
                    # Analyze Button
                    if st.button("Analyze Article", key=f"btn_{idx}", use_container_width=True):
                        st.session_state.selected_article = article
                        st.rerun()
                    
                    st.markdown('</div>', unsafe_allow_html=True)
                    
        except Exception as e:
            st.error(f"Error fetching news: {str(e)}")

def main():
    st.title("📰 NEXTER")
    st.markdown("Modern AI-Powered News Analysis")

    # Initialize session states
    if 'search_query' not in st.session_state: st.session_state.search_query = ""
    if 'selected_article' not in st.session_state: st.session_state.selected_article = None
    if 'is_home' not in st.session_state: st.session_state.is_home = True

    with st.sidebar:
        st.header("Search Settings")
        news_service = get_news_service()
        
        query_input = st.text_input("Topic Search", value=st.session_state.search_query, placeholder="e.g. Finance, AI, Sports")
        
        if query_input != st.session_state.search_query:
            st.session_state.search_query = query_input
            st.session_state.selected_article = None
            st.session_state.is_home = False

        if st.button("Fetch News", type="primary"):
            st.session_state.selected_article = None
            st.session_state.is_home = False
            st.rerun()

        if st.button("🏠 Home Feed"):
            st.session_state.search_query = ""
            st.session_state.selected_article = None
            st.session_state.is_home = True
            st.rerun()

        st.divider()
        if st.button("🧹 Clear Cache"):
            st.cache_data.clear()
            st.success("Cache cleared!")
            time.sleep(0.5)
            st.rerun()

        if news_service.bias_model:
            st.success("✅ AI Bias Model Loaded")
        else:
            st.info("☁️ Cloud Analysis Active")

    # Display logic
    if st.session_state.selected_article:
        display_article_detail(st.session_state.selected_article, news_service)
    elif st.session_state.is_home:
        fetch_and_display_news(None, news_service, title="Top Headlines")
    else:
        fetch_and_display_news(st.session_state.search_query, news_service, title=f"Results for: {st.session_state.search_query}")


if __name__ == "__main__":
    main()
