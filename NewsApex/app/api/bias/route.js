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
      const pythonProcess = spawn('python', [path.join(process.cwd(), 'bridge_logic.py'), action, '--url', articleUrl]);

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
          reject(new Error(`Operation failed: ${error}`));
        } else {
          try {
            console.log(`Action ${action} successful for: ${articleUrl}`);
            resolve(JSON.parse(output));
          } catch (e) {
            console.error(`Failed to parse output JSON: ${output}`);
            reject(new Error(`Failed to parse output: ${output}`));
          }
        }
      });
    });

    return NextResponse.json(resultData);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
