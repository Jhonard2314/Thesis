import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const maxDuration = 60; // Set max duration to 60 seconds

const HF_SPACE_URL = process.env.HF_SPACE_URL;
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const category = searchParams.get('category') || '';

  // 🔹 In Production (Vercel), use the Hugging Face API to avoid 10s timeouts
  if (IS_PRODUCTION && HF_SPACE_URL) {
    try {
      const url = new URL(`${HF_SPACE_URL}/fetch_news`);
      if (query) url.searchParams.append('query', query);
      if (category) url.searchParams.append('category', category);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        next: { revalidate: 300 } // Cache for 5 minutes
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

  try {
    const newsData = await new Promise((resolve, reject) => {
      const args = ['bridge_logic.py', 'fetch_news'];
      if (query) {
        args.push('--query', query);
      }
      if (category) {
        args.push('--category', category);
      }

      const scriptPath = path.join(process.cwd(), 'bridge_logic.py');
      // Use python3 for Linux/Vercel environment
      const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
      const pythonProcess = spawn(pythonCommand, [scriptPath, ...args.slice(1)], {});

      // Generous timeout for local host
      const timeout = setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('Backend process timed out. The news fetch is taking too long.'));
      }, 60000);

      let output = '';
      let error = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          console.error(`Python process exited with code ${code}. Error: ${error}`);
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
            console.error(`Failed to parse news output. Raw output: ${output}`);
            reject(new Error(`Backend error: ${output.substring(0, 100)}...`));
          }
        }
      });
    });

    return NextResponse.json(newsData);
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch news articles' },
      { status: 500 }
    );
  }
}
