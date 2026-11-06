import { NextResponse } from 'next/server';

export const maxDuration = 60;

const HF_SPACE_URL = process.env.HF_SPACE_URL || "https://breadknife-news-apex-api.hf.space";

// Ping HF Space to wake it up — fire and forget
async function wakeUp() {
  try {
    await fetch(`${HF_SPACE_URL}/health`, { method: 'GET' });
  } catch (_) {}
}

// Fetch with timeout helper
async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// Retry fetch — retries on network errors or 503 (space waking up)
async function fetchWithRetry(url, options, { timeoutMs = 55000, retries = 3, retryDelayMs = 4000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);
      // 503 = space still waking, retry
      if (res.status === 503 && attempt < retries) {
        await new Promise(r => setTimeout(r, retryDelayMs));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, retryDelayMs));
      }
    }
  }
  throw lastError;
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.url && !body.content) {
      return NextResponse.json({ error: 'Article URL or content is required' }, { status: 400 });
    }

    // Fire wake-up ping immediately (no-op if already awake)
    wakeUp();

    const response = await fetchWithRetry(
      `${HF_SPACE_URL}/analyze`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url:           body.url || body.articleUrl || null,
          content:       body.content || body.full_content || null,
          summary:       body.summary || null,
          snippet:       body.snippet || null,
          model_version: body.model_version || 'v2',
          action:        body.action || 'analyze_bias',
        }),
      },
      { timeoutMs: 55000, retries: 3, retryDelayMs: 5000 }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.ok ? 200 : response.status });

  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    console.error('Bias API error:', error);
    return NextResponse.json(
      {
        error: isTimeout
          ? 'The backend is taking longer than expected. Please try again.'
          : 'Could not reach the analysis backend. Please try again in a moment.',
      },
      { status: 503 }
    );
  }
}
