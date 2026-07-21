import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { getServerHost, getHestiaUrl } from '@/lib/server-config'

const execAsync = promisify(exec)

// Função para executar comandos SSH no servidor
async function execSSH(command: string): Promise<string> {
  const { exec } = require('child_process')
  const { Client } = require('ssh2')
  
  return new Promise((resolve, reject) => {
    const conn = new Client()
    let out = ''
    const rawKey = process.env.SSH_PRIVATE_KEY || ''
    const privateKey = rawKey.replace(/\\n/g, '\n')

    conn.on('ready', () => {
      conn.exec(command, (err: any, stream: any) => {
        if (err) { 
          console.error('SSH Error:', err)
          conn.end(); 
          return reject(err); 
        }
        stream.on('data', (d: Buffer) => { out += d.toString(); });
        stream.stderr.on('data', (d: Buffer) => { out += d.toString(); });
        stream.on('close', () => { conn.end(); resolve(out); });
      });
    });

    conn.on('error', (err: any) => {
      console.error('SSH Connection Error:', err)
      reject(err)
    });
    
    conn.connect({
      host: getServerHost(),
      port: 22,
      username: 'root',
      privateKey,
      readyTimeout: 10000,
      algorithms: {
        kex: ['diffie-hellman-group-exchange-sha256', 'ecdh-sha2-nistp256'],
        cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr'],
        hmac: ['hmac-sha2-256', 'hmac-sha1']
      }
    });
  });
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'SilvaChamo'
const GITHUB_REPO = process.env.GITHUB_REPO || 'Portal Digitale'
const VERCEL_DEPLOY_HOOK = process.env.VERCEL_DEPLOY_HOOK
const IS_LOCAL = process.env.NODE_ENV === 'development'

const ghHeaders = (): Record<string, string> => ({
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'Portal Digital-Admin',
  ...(GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {}),
})

export async function GET() {
  try {
    // When running locally, also get git status
    let localGit: any = null
    if (IS_LOCAL) {
      try {
        const cwd = process.cwd()
        const [statusOut, branchOut, logOut] = await Promise.all([
          execAsync('git status --short', { cwd }).then(r => r.stdout.trim()),
          execAsync('git rev-parse --abbrev-ref HEAD', { cwd }).then(r => r.stdout.trim()),
          execAsync('git log -1 --pretty=format:"%h %s"', { cwd }).then(r => r.stdout.trim()),
        ])
        localGit = {
          branch: branchOut,
          lastCommit: logOut,
          changedFiles: statusOut.split('\n').filter(Boolean),
          hasChanges: statusOut.trim().length > 0,
        }
      } catch { localGit = null }
    }

    const [repoRes, commitsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`, { headers: ghHeaders() }),
      fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?per_page=6`, { headers: ghHeaders() }),
    ])

    const repo = repoRes.ok ? await repoRes.json() : null
    const commits = commitsRes.ok ? await commitsRes.json() : []

    return NextResponse.json({
      success: true,
      isLocal: IS_LOCAL,
      localGit,
      repo: repo ? {
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        branch: repo.default_branch,
        lastPush: repo.pushed_at,
      } : null,
      commits: Array.isArray(commits) ? commits.map((c: any) => ({
        sha: c.sha?.substring(0, 7),
        message: c.commit?.message?.split('\n')[0],
        author: c.commit?.author?.name,
        date: c.commit?.author?.date,
        url: c.html_url,
      })) : [],
      hasDeployHook: !!VERCEL_DEPLOY_HOOK,
      hasGithubToken: !!GITHUB_TOKEN,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, message } = body

    // ── LOCAL: git add + commit + push ──
    if (action === 'git-push') {
      if (!IS_LOCAL) {
        return NextResponse.json({ success: false, error: 'git push só funciona em desenvolvimento local.' }, { status: 400 })
      }
      if (!message?.trim()) {
        return NextResponse.json({ success: false, error: 'Mensagem de commit é obrigatória.' }, { status: 400 })
      }

      const cwd = process.cwd()
      const steps: string[] = []

      await execAsync('git add .', { cwd })
      steps.push('git add . → OK')

      try {
        const { stdout } = await execAsync(`git commit -m "${message.replace(/"/g, "'")}"`, { cwd })
        steps.push(`git commit → ${stdout.split('\n')[0].trim()}`)
      } catch (e: any) {
        if (e.message?.includes('nothing to commit')) {
          return NextResponse.json({ success: true, steps: ['Nada para commitar — working tree limpo.'], message: 'Sem alterações para enviar.' })
        }
        throw e
      }

      try {
        await execAsync('git pull --rebase origin main', { cwd })
        steps.push('git pull --rebase → OK')
      } catch (pullErr: any) {
        steps.push(`git pull → ${pullErr.message?.split('\n')[0] || 'aviso'}`)
      }

      const { stdout: pushOut, stderr: pushErr } = await execAsync('git push', { cwd })
      steps.push(`git push → OK`)

      return NextResponse.json({
        success: true,
        steps,
        message: 'Commit e push realizados! Vercel vai fazer deploy automaticamente em ~1-2 min.',
        output: (pushOut + pushErr).trim(),
      })
    }

    // ── DEPLOY SIMULTÂNEO: GitHub + Site Online ──
    if (action === 'deploy-all') {
      const steps: string[] = []
      
      // 1. Fazer git push primeiro
      if (IS_LOCAL && message?.trim()) {
        const cwd = process.cwd()
        
        try {
          await execAsync('git add .', { cwd })
          steps.push('git add . → OK')

          try {
            const { stdout } = await execAsync(`git commit -m "${message.replace(/"/g, "'")}"`, { cwd })
            steps.push(`git commit → ${stdout.split('\n')[0].trim()}`)
          } catch (e: any) {
            if (e.message?.includes('nothing to commit')) {
              steps.push('Nenhuma alteração para commitar')
            } else {
              throw e
            }
          }

          try {
            await execAsync('git pull --rebase origin main', { cwd })
            steps.push('git pull --rebase → OK')
          } catch (pullErr: any) {
            steps.push(`git pull → ${pullErr.message?.split('\n')[0] || 'aviso'}`)
          }

          await execAsync('git push', { cwd })
          steps.push('git push → OK')
        } catch (e: any) {
          steps.push(`Git error: ${e.message}`)
        }
      }

      // 2. Disparar Vercel Deploy Hook para site online
      if (VERCEL_DEPLOY_HOOK) {
        try {
          const hookRes = await fetch(VERCEL_DEPLOY_HOOK, { method: 'POST' })
          if (hookRes.ok) {
            steps.push('Deploy Hook Vercel → OK (site online)')
          } else {
            steps.push(`Deploy Hook falhou: ${hookRes.status}`)
          }
        } catch (e: any) {
          steps.push(`Deploy Hook error: ${e.message}`)
        }
      } else {
        steps.push('VERCEL_DEPLOY_HOOK não configurado')
      }

      return NextResponse.json({
        success: true,
        steps,
        message: 'Deploy iniciado! GitHub actualizado e site online sendo actualizado em ~1-2 minutos.',
        vercelDashboard: VERCEL_DEPLOY_HOOK ? `https://vercel.com/silvachamo/${GITHUB_REPO.toLowerCase()}/deployments` : null,
      })
    }

    // ── PRODUCTION: Vercel Deploy Hook ──
    if (action === 'deploy-hook') {
      if (!VERCEL_DEPLOY_HOOK) {
        return NextResponse.json({
          success: false,
          error: 'VERCEL_DEPLOY_HOOK não configurado.',
          setup: [
            '1. Vercel Dashboard → Project → Settings → Git → Deploy Hooks',
            '2. "Add Deploy Hook" → nome: admin-panel, branch: main',
            '3. Copia o URL e adiciona como env var VERCEL_DEPLOY_HOOK',
          ],
        }, { status: 400 })
      }

      const hookRes = await fetch(VERCEL_DEPLOY_HOOK, { method: 'POST' })
      if (!hookRes.ok) {
        return NextResponse.json({ success: false, error: `Deploy Hook falhou: ${hookRes.status}` }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Deploy iniciado! Vercel está a fazer deploy em ~1-2 minutos.',
        vercelDashboard: `https://vercel.com/silvachamo/${GITHUB_REPO.toLowerCase()}/deployments`,
      })
    }

    // ── DEPLOY DO SITE NO SERVIDOR ──
    if (action === 'deploySite') {
      const domain = body.params?.domain || body.domain || 'your-domain.com'
      
      if (domain === 'painel.visualdesignmoz.com') {
        if (VERCEL_DEPLOY_HOOK) {
          try {
            const hookRes = await fetch(VERCEL_DEPLOY_HOOK, { method: 'POST' })
            if (!hookRes.ok) {
              throw new Error(`Deploy Hook Vercel falhou com status: ${hookRes.status}`)
            }
            const output = 'DEPLOY_COMPLETE_VERCEL'
            return NextResponse.json({
              success: true,
              output,
              data: {
                success: true,
                output,
              },
              message: 'Deploy do painel iniciado com sucesso via Vercel Deploy Hook!'
            })
          } catch (err: any) {
            return NextResponse.json({
              success: false,
              output: err.message || 'Erro durante o deploy do painel na Vercel.',
              data: {
                success: false,
                output: err.message || 'Erro durante o deploy do painel na Vercel.',
              },
              error: err.message || 'Erro durante o deploy.'
            }, { status: 500 })
          }
        }

        try {
          const cwd = process.cwd()
          // 1. git pull
          const { stdout: pullOut, stderr: pullErr } = await execAsync('git pull origin main', { cwd })
          // 2. npm ci
          const { stdout: ciOut, stderr: ciErr } = await execAsync('npm ci --prefer-offline --no-audit --no-fund', { cwd })
          // 3. npm run build
          const { stdout: buildOut, stderr: buildErr } = await execAsync('npm run build', {
            cwd,
            env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' }
          })
          const output = `[Git Pull]\n${pullOut}\n${pullErr}\n\n[NPM Install]\n${ciOut}\n${ciErr}\n\n[NPM Build]\n${buildOut}\n${buildErr}\n\nDEPLOY_COMPLETE`
          
          // 4. Agendar reinício do PM2 em background
          exec('sleep 2 && pm2 restart visualdesign-panel', { cwd })
          
          return NextResponse.json({
            success: true,
            output,
            data: {
              success: true,
              output,
            },
            message: 'Deploy do painel concluído com sucesso no servidor Hetzner!'
          })
        } catch (err: any) {
          return NextResponse.json({
            success: false,
            output: err.message || 'Erro durante o deploy do painel.',
            data: {
              success: false,
              output: err.message || 'Erro durante o deploy do painel.',
            },
            error: err.message || 'Erro durante o deploy.'
          }, { status: 500 })
        }
      }

      const raw = await execSSH(`
        git config --global --add safe.directory /home/${domain}/public_html 2>/dev/null
        cd /home/${domain}/public_html
        git pull origin main 2>&1
        npm install --production 2>&1 | tail -5
        npm run build 2>&1 | tail -10
        echo "DEPLOY_COMPLETE"
      `)
      return NextResponse.json({ 
        output: raw, 
        success: raw.includes('DEPLOY_COMPLETE'),
        data: {
          output: raw, 
          success: raw.includes('DEPLOY_COMPLETE')
        },
        message: raw.includes('DEPLOY_COMPLETE') ? 'Deploy concluído com sucesso!' : 'Erro no deploy'
      })
    }

    if (action === 'getDeployStatus') {
      const domain = body.params?.domain || body.domain || 'your-domain.com'
      if (domain === 'painel.visualdesignmoz.com') {
        const { stdout: raw } = await execAsync('git log --oneline -5', { cwd: process.cwd() })
        return NextResponse.json({
          output: raw,
          success: true,
          data: {
            output: raw,
            success: true
          }
        })
      }

      const raw = await execSSH(`
        git config --global --add safe.directory /home/${domain}/public_html 2>/dev/null
        cd /home/${domain}/public_html && git log --oneline -5 2>&1
      `)
      return NextResponse.json({
        output: raw,
        success: true,
        data: {
          output: raw,
          success: true
        }
      })
    }

    if (action === 'getGitLog') {
      const domain = body.params?.domain || body.domain || 'your-domain.com'
      if (domain === 'painel.visualdesignmoz.com') {
        const { stdout: raw } = await execAsync('git log --oneline -10', { cwd: process.cwd() })
        return NextResponse.json({
          output: raw,
          success: true,
          data: {
            output: raw,
            success: true
          }
        })
      }

      const raw = await execSSH(`
        git config --global --add safe.directory /home/${domain}/public_html 2>/dev/null
        cd /home/${domain}/public_html && git log --oneline -10 2>&1
      `)
      return NextResponse.json({
        output: raw,
        success: true,
        data: {
          output: raw,
          success: true
        }
      })
    }

    return NextResponse.json({ success: false, error: 'Acção inválida.' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      hint: 'Verifica que o Git está configurado e o repositório tem acesso de escrita.',
    }, { status: 500 })
  }
}
