import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const maxDuration = 60; // Set max duration to 60 seconds

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const category = searchParams.get('category') || '';

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

      let output = '';
      let error = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`News fetch failed: ${error}`));
        } else {
          try {
            resolve(JSON.parse(output));
          } catch (e) {
            reject(new Error(`Failed to parse news output: ${output}`));
          }
        }
      });
    });

    return NextResponse.json(newsData);
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news articles' },
      { status: 500 }
    );
  }
}
