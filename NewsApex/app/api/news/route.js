import { NextResponse } from 'next/server';

export const maxDuration = 60; // Set max duration to 60 seconds

// API Keys from environment variables
const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY || "pub_c319de1ec46240dc912d9b112e01c866";
const GUARDIAN_API_KEY = process.env.GUARDIAN_API_KEY || "438ab5df-f19b-42b6-9ca9-83b8e971f219";

async function fetchNewsData(query, category) {
  if (!NEWSDATA_API_KEY) return [];
  const url = new URL("https://newsdata.io/api/1/news");
  url.searchParams.append("apikey", NEWSDATA_API_KEY);
  url.searchParams.append("language", "en");
  if (query) url.searchParams.append("q", query);
  if (category && category !== 'general') url.searchParams.append("category", category);

  try {
    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    const data = await response.json();
    if (data.status === "success") {
      return (data.results || []).map(r => ({
        title: r.title,
        url: r.link,
        source: { name: r.source_id },
        publishedAt: r.pubDate,
        urlToImage: r.image_url,
        description: r.description || r.content
      }));
    }
    return [];
  } catch (e) {
    console.error("NewsData API error:", e);
    return [];
  }
}

async function fetchGuardian(query, category) {
  if (!GUARDIAN_API_KEY || GUARDIAN_API_KEY.includes("your_")) return [];
  const url = new URL("https://content.guardianapis.com/search");
  url.searchParams.append("api-key", GUARDIAN_API_KEY);
  url.searchParams.append("show-fields", "thumbnail,trailText");
  if (query) url.searchParams.append("q", query);

  const categoryMap = {
    'business': 'business',
    'technology': 'technology',
    'entertainment': 'culture',
    'health': 'society',
    'science': 'science',
    'sports': 'sport'
  };
  if (category && categoryMap[category]) {
    url.searchParams.append("section", categoryMap[category]);
  }

  try {
    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    const data = await response.json();
    const results = data.response?.results || [];
    return results.map(r => ({
      title: r.webTitle,
      url: r.webUrl,
      source: { name: "The Guardian" },
      publishedAt: r.webPublicationDate,
      urlToImage: r.fields?.thumbnail,
      description: r.fields?.trailText
    }));
  } catch (e) {
    console.error("Guardian API error:", e);
    return [];
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const category = searchParams.get('category') || '';

  try {
    // Run both API calls in parallel using native Node.js fetch
    // This avoids the Python bridge entirely for the initial news fetch
    const [newsDataResults, guardianResults] = await Promise.all([
      fetchNewsData(query, category),
      fetchGuardian(query, category)
    ]);

    const allArticles = [...newsDataResults, ...guardianResults];

    // Simple deduplication by title
    const uniqueArticles = [];
    const seenTitles = new Set();
    for (const article of allArticles) {
      if (article.title && !seenTitles.has(article.title.toLowerCase())) {
        uniqueArticles.push(article);
        seenTitles.add(article.title.toLowerCase());
      }
    }

    // Sort by publication date (descending) - Restoring the filter/sorting logic
    uniqueArticles.sort((a, b) => {
      const dateA = new Date(a.publishedAt || 0);
      const dateB = new Date(b.publishedAt || 0);
      return dateB - dateA;
    });

    // Return the results quickly
    return NextResponse.json({
      articles: uniqueArticles.slice(0, 20)
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch news articles' },
      { status: 500 }
    );
  }
}
