import { chromium } from 'playwright'

const ORIGIN = 'http://localhost:3002'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

await page.goto(`${ORIGIN}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
await context.clearCookies()

const cleared = await page.evaluate(() => {
  const ls = localStorage.length
  const ss = sessionStorage.length
  const cookieNames = document.cookie
    .split(';')
    .map((c) => c.split('=')[0]?.trim())
    .filter(Boolean)

  localStorage.clear()
  sessionStorage.clear()

  for (const name of cookieNames) {
    document.cookie = `${name}=; path=/; max-age=0`
    document.cookie = `${name}=; path=/; domain=localhost; max-age=0`
  }

  return {
    localStorageKeys: ls,
    sessionStorageKeys: ss,
    cookieNames,
    remainingCookies: document.cookie,
    remainingLocalStorage: localStorage.length,
  }
})

console.log('localhost:3002 limpo:', JSON.stringify(cleared, null, 2))
await browser.close()
