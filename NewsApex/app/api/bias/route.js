import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const maxDuration = 60; // Set max duration to 60 seconds

// 🔹 CLOUD FALLBACK: Directly call Hugging Face if Python bridge is too slow
const HF_TOKEN = process.env.HF_TOKEN || "hf_GfQdGfRjNlQZcIuMhPkXyVwY"; // Use your token or env

async function callCloudBias(text) {
  if (!text || text.length < 50) return null;
  
  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/roberta-hate-speech-dynabench-r4-target",
      {
        headers: { Authorization: `Bearer ${HF_TOKEN}` },
        method: "POST",
        body: JSON.stringify({ inputs: text.substring(0, 500) }),
        signal: AbortSignal.timeout(5000)
      }
    );
    
    const result = await response.json();
    if (Array.isArray(result) && result.length > 0) {
      const hateScore = result.find(r => r.label === 'hate')?.score || 0;
      const bias_level = hateScore > 0.7 ? "High" : hateScore > 0.4 ? "Medium" : "Low";
      
      return {
        bias_level,
        bias_score: Math.round(hateScore * 100),
        explanation: `Cloud Analysis: ${bias_level} Bias detected via Hugging Face.`,
        sentence_breakdown: [{ text: text.substring(0, 200) + "...", label: hateScore > 0.5 ? "Biased" : "Factual", score: Math.round(hateScore * 100) }]
      };
    }
    return null;
  } catch (e) {
    console.error("Cloud bias fallback failed:", e);
    return null;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const articleUrl = body.url || body.articleUrl;
    const action = body.action || 'analyze_bias';
    const existingContent = body.content || body.full_content; // 🔹 Support passing text directly

    if (!articleUrl && !existingContent) {
      return NextResponse.json({ error: 'Article URL or content is required' }, { status: 400 });
    }

    // 🔹 Try Python Bridge first
    const resultData = await new Promise(async (resolve, reject) => {
      const scriptPath = path.join(process.cwd(), 'bridge_logic.py');
      const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
      
      const args = [scriptPath, action];
      if (articleUrl) {
        args.push('--url', articleUrl);
      }
      if (existingContent) {
        args.push('--content', existingContent); // 🔹 Pass content if we already have it
      }

      const pythonProcess = spawn(pythonCommand, args);

      let output = '';
      let error = '';

      // Increased to 14 seconds for analysis
      const timeout = setTimeout(async () => {
        pythonProcess.kill();
        resolve({ 
          error: 'Analysis timed out. The server is under heavy load. Please try a shorter article or wait a moment.'
        });
      }, 14000);

      pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
      pythonProcess.stderr.on('data', (data) => { error += data.toString(); });

      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          try {
            resolve(JSON.parse(error));
          } catch (e) {
            resolve({ error: `Backend error (Code ${code})` });
          }
        } else {
          try {
            resolve(JSON.parse(output));
          } catch (e) {
            console.error(`Failed to parse output: ${output}`);
            reject(new Error('Failed to parse model output'));
          }
        }
      });
    });

    return NextResponse.json(resultData);
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
