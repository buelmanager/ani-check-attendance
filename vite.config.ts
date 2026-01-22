import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Git 변경사항을 한글로 변환하는 함수
async function getGitChanges(): Promise<{ changes: string[], summary: string }> {
  try {
    // git status로 변경된 파일 목록 가져오기
    const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: process.cwd() })

    // git log로 최근 커밋 메시지 가져오기
    const { stdout: logOutput } = await execAsync('git log -5 --oneline', { cwd: process.cwd() })

    // git diff로 변경 내용 요약 가져오기
    const { stdout: diffStat } = await execAsync('git diff --stat HEAD~1 2>/dev/null || git diff --stat', { cwd: process.cwd() })

    const changes: string[] = []

    // 상태 코드 한글 변환
    const statusMap: Record<string, string> = {
      'M': '수정됨',
      'A': '추가됨',
      'D': '삭제됨',
      'R': '이름변경',
      '?': '미추적',
      'U': '충돌'
    }

    if (statusOutput.trim()) {
      const lines = statusOutput.trim().split('\n')
      for (const line of lines) {
        const status = line.substring(0, 2).trim()
        const file = line.substring(3)
        const statusText = statusMap[status[0]] || statusMap[status[1]] || status
        changes.push(`[${statusText}] ${file}`)
      }
    }

    // 최근 커밋 정보
    const recentCommits = logOutput.trim().split('\n').filter(l => l)

    return {
      changes: changes.length > 0 ? changes : ['변경사항 없음'],
      summary: `최근 커밋:\n${recentCommits.join('\n')}\n\n변경 통계:\n${diffStat || '없음'}`
    }
  } catch (error) {
    return {
      changes: ['Git 정보를 가져올 수 없습니다'],
      summary: String(error)
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'git-api',
      configureServer(server) {
        server.middlewares.use('/api/git-changes', async (_req, res) => {
          res.setHeader('Content-Type', 'application/json')
          const data = await getGitChanges()
          res.end(JSON.stringify(data))
        })
      }
    }
  ],
  server: {
    port: 3000,
    open: true
  }
})
