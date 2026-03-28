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
        headers: { Authorization: `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({ 
          inputs: text.substring(0, 3000),
          options: { wait_for_model: true } // 🔹 Tell HF to wait if model is loading
        }),
        signal: AbortSignal.timeout(20000)
      }
    );
    
    const result = await response.json();
    
    // Handle different HF response formats
    if (Array.isArray(result) && result[0]?.summary_text) {
      return result[0].summary_text;
    }
    if (result?.summary_text) {
      return result.summary_text;
    }
    
    console.error("HF Summary unexpected format:", result);
    return null;
  } catch (e) {
    console.error("Cloud summary failed:", e);
    return null;
  }
}

async function callCloudBiasNode(text) {
  if (!text || text.length < 50) return null;
  
  try {
    // 🔹 Use a zero-shot classification model for better bias detection in cloud
    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
      {
        headers: { Authorization: `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({ 
          inputs: text.substring(0, 1000),
          parameters: { candidate_labels: ["biased", "neutral", "factual"] },
          options: { wait_for_model: true }
        }),
        signal: AbortSignal.timeout(15000)
      }
    );
    
    const result = await response.json();
    if (result?.labels && result?.scores) {
      const biasedIdx = result.labels.indexOf("biased");
      const bias_score = result.scores[biasedIdx] || 0;
      const bias_level = bias_score > 0.7 ? "High" : bias_score > 0.4 ? "Medium" : "Low";
      
      return {
        bias_level,
        bias_score: Math.round(bias_score * 100),
        explanation: `Cloud Analysis: This article is classified as ${bias_level} bias using zero-shot NLP.`,
        sentence_breakdown: [{ 
          text: text.substring(0, 200) + "...", 
          label: bias_score > 0.5 ? "Biased" : "Factual", 
          score: Math.round(bias_score * 100),
          reasoning: "Cloud fallback analysis."
        }],
        factual_count: bias_score < 0.5 ? 1 : 0,
        biased_count: bias_score >= 0.5 ? 1 : 0,
        total_sentences_analyzed: 1
      };
    }
    return null;
  } catch (e) {
    console.error("Cloud bias Node fallback failed:", e);
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

      const summary = await callCloudSummary(content);
      return NextResponse.json({
        summary: summary || "Summary unavailable for this article.",
        full_content: content
      });
    }

    // 🔹 ACTION: ANALYZE_BIAS
    // 1. Try Python Bridge (Local BERT)
    const pythonResult = await new Promise(async (resolve) => {
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
        resolve({ timeout: true });
      }, 12000);

      pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
      pythonProcess.stderr.on('data', (data) => { error += data.toString(); });

      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          resolve({ error: true });
        } else {
          try { resolve(JSON.parse(output)); } catch (e) { resolve({ error: true }); }
        }
      });
    });

    // 2. If Python worked, return it
    if (pythonResult && !pythonResult.timeout && !pythonResult.error) {
      return NextResponse.json(pythonResult);
    }

    // 3. 🔹 CLOUD FALLBACK (If Python failed/timed out on Vercel)
    console.log("Python failed or timed out, switching to Node Cloud Fallback...");
    const contentToAnalyze = existingContent || await scrapeArticleNode(articleUrl);
    const cloudBiasResult = await callCloudBiasNode(contentToAnalyze);
    
    if (cloudBiasResult) {
      return NextResponse.json(cloudBiasResult);
    }

    return NextResponse.json({ 
      error: 'Analysis failed. The article might be too long or the server is busy. Please try again.' 
    }, { status: 500 });

  } catch (error) {
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
