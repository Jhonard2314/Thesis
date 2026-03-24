import streamlit as st
import re
from news_service import NewsService
import time

# Page config
st.set_page_config(page_title="AI News Sentence Splitter Test", layout="wide")

# Initialize NewsService
@st.cache_resource
def get_news_service():
    return NewsService()

news_service = get_news_service()

# Header
st.title("📰 AI News Sentence Splitter & Summarizer")
st.markdown("""
This is a **Simplified Test Version** of the frontend.
It automatically picks one article about **'Technology'** to demonstrate the sentence-splitting logic.
""")

# Automatically fetch one article
if 'test_article' not in st.session_state:
    with st.spinner("Fetching a sample article..."):
        articles = news_service.fetch_all_news(query="Technology")
        if articles:
            # Try to find an article that has content
            for article in articles:
                content = news_service.get_full_content(article.get('link'))
                if content:
                    st.session_state.test_article = {
                        "metadata": article,
                        "content": content
                    }
                    break
        else:
            st.error("Could not fetch any sample articles.")

# Display analysis if article is found
if 'test_article' in st.session_state:
    data = st.session_state.test_article
    article = data['metadata']
    full_content = data['content']
    
    st.header(f"Analysis: {article.get('title')}")
    st.caption(f"Source: {article.get('source_id')} | [Read Original]({article.get('link')})")
    
    st.divider()
    
    # Process content
    sentences = news_service.split_into_sentences(full_content)
    
    with st.spinner("Generating AI summarization..."):
        summary = news_service.summarize_content(full_content)
    
    # Layout
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.subheader("📋 Full Article (Numbered Sentences)")
        st.info(f"Total Sentences: {len(sentences)}")
        st.markdown("---")
        for i, sentence in enumerate(sentences, 1):
            st.markdown(f"**{i}.** {sentence}")
            st.markdown("<div style='height: 1px; background-color: #eee; margin: 10px 0;'></div>", unsafe_allow_html=True)
    
    with col2:
        st.subheader("🤖 AI Summarization")
        st.markdown("---")
        if summary:
            st.success(summary)
        else:
            st.warning("AI summarization is unavailable for this article.")
        
        st.markdown("### How it works")
        st.write("""
        1. **Extraction**: Uses `Newspaper3k` to get the full article text.
        2. **Splitting**: A custom regex splits the text into clean sentences.
        3. **Summarization**: Hugging Face's `bart-large-cnn` model summarizes the content.
        """)

else:
    if 'test_article' not in st.session_state:
        st.warning("Click the button below to retry fetching a sample article.")
        if st.button("Retry Sample Fetch"):
            st.rerun()

# Footer
st.markdown("---")
st.caption("Powered by NewsData.io, The Guardian, NYT, and Hugging Face (BART-large-cnn)")
