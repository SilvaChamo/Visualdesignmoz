import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';

const VPS_CONFIG = {
  host: process.env.VPS_HOST || '',
  port: parseInt(process.env.VPS_PORT || '22'),
  username: process.env.VPS_USER || '',
  password: process.env.VPS_PASS || ''
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { action, url } = await req.json();

    if (action === 'setup-supabase') {
      return await handleSupabaseSetup();
    }

    if (action === 'clone-site') {
      return await handleSiteClone(url);
    }

    if (action === 'deploy-github') {
      return await handleDeployToGitHub(url);
    }

    return NextResponse.json({ success: false, error: 'Ação inválida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

async function handleSupabaseSetup(): Promise<NextResponse> {
  return new Promise<NextResponse>((resolve) => {
    const conn = new Client();
    let logs = '';

    conn.on('ready', () => {
      const cmd = `
        apt-get update && apt-get install -y docker.io docker-compose
        mkdir -p /root/supabase && cd /root/supabase
        if [ ! -d "docker" ]; then git clone --depth 1 https://github.com/supabase/docker.git; fi
        cd docker
        cp .env.example .env
        docker-compose up -d
      `;

      conn.exec(cmd, (err, stream) => {
        if (err) {
          conn.end();
          resolve(NextResponse.json({ success: false, error: err.message }));
          return;
        }
        stream.on('close', () => {
          conn.end();
          resolve(NextResponse.json({ success: true, logs }));
        }).on('data', (data: any) => {
          logs += data.toString();
        }).stderr.on('data', (data: any) => {
          logs += data.toString();
        });
      });
    }).on('error', (err) => {
      resolve(NextResponse.json({ success: false, error: `SSH Error: ${err.message}` }));
    }).connect(VPS_CONFIG);
  });
}

async function handleSiteClone(targetUrl: string): Promise<NextResponse> {
  try {
    const hostname = new URL(targetUrl).hostname;
    const baseDir = path.join(process.cwd(), 'public', 'cloned', hostname);
    const visited = new Set<string>();
    const queue = [targetUrl];
    const MAX_PAGES = 15;

    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

    while (queue.length > 0 && visited.size < MAX_PAGES) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);

      const res = await fetch(url);
      const html = await res.text();
      
      const urlObj = new URL(url);
      let relativePath = urlObj.pathname === '/' ? 'index.html' : path.join(urlObj.pathname, 'index.html');
      if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
      
      const fullPath = path.join(baseDir, relativePath);
      if (!fs.existsSync(path.dirname(fullPath))) fs.mkdirSync(path.dirname(fullPath), { recursive: true });

      let processedHtml = html;
      const assetMatches = html.matchAll(/(?:src|href)="([^"]+\.(?:png|jpg|jpeg|gif|css|svg))"/g);
      for (const assetMatch of assetMatches) {
        let assetUrl = assetMatch[1];
        if (assetUrl.startsWith('/')) assetUrl = new URL(assetUrl, targetUrl).href;
        try {
          const assetName = path.basename(new URL(assetUrl).pathname);
          const assetPath = path.join(baseDir, 'assets', assetName);
          
          if (!fs.existsSync(path.dirname(assetPath))) fs.mkdirSync(path.dirname(assetPath), { recursive: true });
          
          if (!fs.existsSync(assetPath)) {
            const assetRes = await fetch(assetUrl);
            const buffer = await assetRes.arrayBuffer();
            fs.writeFileSync(assetPath, Buffer.from(buffer));
          }
          
          processedHtml = processedHtml.replace(assetMatch[1], '/assets/' + assetName);
        } catch (e) {}
      }

      fs.writeFileSync(fullPath, processedHtml);

      const matches = html.matchAll(/href="([^"]+)"/g);
      for (const match of matches) {
        let link = match[1];
        if (link.startsWith('/')) link = new URL(link, targetUrl).href;
        if (link.startsWith(targetUrl) && !visited.has(link) && !queue.includes(link)) {
          queue.push(link);
        }
      }
    }

    return NextResponse.json({ success: true, pages: visited.size, path: `/cloned/${hostname}` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}

async function handleDeployToGitHub(targetUrl: string): Promise<NextResponse> {
  try {
    const hostname = new URL(targetUrl).hostname;
    const token = process.env.GITHUB_DEPLOY_TOKEN || '';
    if (!token) {
      return NextResponse.json({ success: false, error: 'GitHub token not configured' });
    }
    const repoName = `${hostname.replace(/\./g, '-')}-static`;

    await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: repoName, private: true })
    });

    return NextResponse.json({ success: true, repo: repoName });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
