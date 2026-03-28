import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const maxDuration = 60; // Set max duration to 60 seconds

const HF_TOKEN = process.env.HF_TOKEN || "hf_GfQdGfRjNlQZcIuMhPkXyVwY";

// 🔹 FAST EXTRACTION: Scrape in Node.js instead of Python to avoid overhead
async function scrapeArticleNode(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(10000)
    });
    const html = await response.text();
    
    // Very simple extraction: grab meta description as a fallback or paragraphs
    // In a real app, we'd use a library like 'cheerio' or 'jsdom', but for speed
    // and zero-dependency, we'll try to find the main content block.
    const metaDescMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
    const metaDesc = metaDescMatch ? metaDescMatch[1] : "";
    
    // Extract paragraph text (simple regex)
    const paragraphs = html.match(/<p[^>]*>(.*?)<\/p>/gi) || [];
    const text = paragraphs
      .map(p => p.replace(/<[^>]*>/g, '').trim())
      .filter(p => p.length > 50)
      .join('\n\n');
      
    return text.length > 200 ? text : metaDesc;
  } catch (e) {
    console.error("Node scraping failed:", e);
    return null;
  }
}

async function callCloudSummary(text) {
  if (!text || text.length < 100) return null;
  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/bart-large-cnn",
      {
        headers: { Authorization: `Bearer ${HF_TOKEN}` },
        method: "POST",
        body: JSON.stringify({ inputs: text.substring(0, 3000) }),
        signal: AbortSignal.timeout(15000)
      }
    );
    const result = await response.json();
    return result?.[0]?.summary_text || null;
  } catch (e) {
    console.error("Cloud summary failed:", e);
    return null;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const articleUrl = body.url || body.articleUrl;
    const action = body.action || 'analyze_bias';
    const existingContent = body.content || body.full_content;

    if (!articleUrl && !existingContent) {
      return NextResponse.json({ error: 'Article URL or content is required' }, { status: 400 });
    }

    // 🔹 ACTION: GET_SUMMARY (Optimized for Vercel)
    if (action === 'get_summary') {
      const content = existingContent || await scrapeArticleNode(articleUrl);
      if (!content) {
        return NextResponse.json({ error: 'Could not extract article content.' });
      }

      // Parallelize summarization (Cloud) and just return the content
      const summary = await callCloudSummary(content);
      return NextResponse.json({
        summary: summary || "Summary unavailable for this article.",
        full_content: content
      });
    }

    // 🔹 ACTION: ANALYZE_BIAS (Keep Python Bridge for local BERT)
    const resultData = await new Promise(async (resolve, reject) => {
      const scriptPath = path.join(process.cwd(), 'bridge_logic.py');
      const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
      
      const args = [scriptPath, action];
      if (articleUrl) args.push('--url', articleUrl);
      if (existingContent) args.push('--content', existingContent);

      const pythonProcess = spawn(pythonCommand, args);
      let output = '';
      let error = '';

      const timeout = setTimeout(() => {
        pythonProcess.kill();
        resolve({ error: 'Analysis timed out. The model is too slow for this article.' });
      }, 14000);

      pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
      pythonProcess.stderr.on('data', (data) => { error += data.toString(); });

      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          try { resolve(JSON.parse(error)); } catch (e) { resolve({ error: `Backend error (${code})` }); }
        } else {
          try { resolve(JSON.parse(output)); } catch (e) { reject(new Error('Parse error')); }
        }
      });
    });

    return NextResponse.json(resultData);
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
