import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const maxDuration = 60; // Set max duration to 60 seconds

const HF_SPACE_URL = process.env.HF_SPACE_URL;
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

export async function POST(request) {
  try {
    const body = await request.json();
    const articleUrl = body.url || body.articleUrl;
    const action = body.action || 'analyze_bias';
    const existingContent = body.content || body.full_content;

    if (!articleUrl && !existingContent) {
      return NextResponse.json({ error: 'Article URL or content is required' }, { status: 400 });
    }

    // 🔹 In Production (Vercel), use the Hugging Face API to avoid 10s timeouts
    if (IS_PRODUCTION && HF_SPACE_URL) {
      try {
        const response = await fetch(`${HF_SPACE_URL}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: articleUrl,
            content: existingContent,
            action: action
          })
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data);
        } else {
          console.error(`HF Space error: ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to reach HF Space:', error);
      }
    }

    // 🔹 Restore Python Bridge as the Primary Logic (Fixes Local Host)
    const resultData = await new Promise((resolve, reject) => {
      const scriptPath = path.join(process.cwd(), 'bridge_logic.py');
      const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
      
      const args = [scriptPath, action];
      if (articleUrl) args.push('--url', articleUrl);
      if (existingContent) args.push('--content', existingContent);

      const pythonProcess = spawn(pythonCommand, args);
      let output = '';
      let error = '';

      // 🔹 Environment-Aware Timeout
      // On Vercel, we must finish in 10s. On Local, we can wait much longer for BERT.
      const timeoutLimit = IS_PRODUCTION ? 9000 : 120000; // 9s for Vercel, 2 mins for Local
      
      const timeout = setTimeout(() => {
        pythonProcess.kill();
        resolve({ 
          error: IS_PRODUCTION 
            ? 'Analysis timed out on the server. The local BERT model is too heavy for Vercel.' 
            : 'Local analysis timed out. Check if your Python environment is responsive.'
        });
      }, timeoutLimit);

      pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
      pythonProcess.stderr.on('data', (data) => { error += data.toString(); });

      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          try {
            const errData = JSON.parse(error);
            resolve(errData);
          } catch (e) {
            resolve({ error: `Python Error (Code ${code}): ${error || 'Unknown error'}` });
          }
        } else {
          try {
            resolve(JSON.parse(output));
          } catch (e) {
            console.error(`Failed to parse bias output. Raw output: ${output}`);
            reject(new Error(`Backend error: ${output.substring(0, 100)}...`));
          }
        }
      });
    });

    return NextResponse.json(resultData);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
