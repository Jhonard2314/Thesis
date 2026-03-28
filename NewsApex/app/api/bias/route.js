import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const maxDuration = 60; // Set max duration to 60 seconds

export async function POST(request) {
  try {
    const body = await request.json();
    const articleUrl = body.url || body.articleUrl;
    const action = body.action || 'analyze_bias'; // Default to bias if not specified

    if (!articleUrl) {
      return NextResponse.json(
        { error: 'Article URL is required' },
        { status: 400 }
      );
    }

    // Run the specified action using our bridge
    const resultData = await new Promise((resolve, reject) => {
      const scriptPath = path.join(process.cwd(), 'bridge_logic.py');
      const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
      const pythonProcess = spawn(pythonCommand, [scriptPath, action, '--url', articleUrl]);

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
          console.error(`Action ${action} failed with code ${code}: ${error}`);
          // Return the error as a JSON object so the frontend can display it
          try {
            const errData = JSON.parse(error);
            resolve(errData);
          } catch (e) {
            resolve({ error: `Python Error (Code ${code}): ${error || 'Unknown error'}` });
          }
        } else {
          try {
            console.log(`Action ${action} successful for: ${articleUrl}`);
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
