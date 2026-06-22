'use client'

import { useEffect, useState } from 'react'
import { buildPanelLoginUrl } from '@/lib/panel-origin'

function clearSiteStorage() {
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    /* ignore */
  }

  const names = document.cookie
    .split(';')
    .map((c) => c.split('=')[0]?.trim())
    .filter(Boolean)

  for (const name of names) {
    document.cookie = `${name}=; path=/; max-age=0`
    document.cookie = `${name}=; path=/; domain=localhost; max-age=0`
    document.cookie = `${name}=; path=/; domain=.localhost; max-age=0`
  }

  return {
    cookies: names,
    localStorageLeft: localStorage.length,
    sessionStorageLeft: sessionStorage.length,
    cookiesLeft: document.cookie,
  }
}

export default function ClearStoragePage() {
  const [done, setDone] = useState(false)

  useEffect(() => {
    clearSiteStorage()
    setDone(true)
    const login = buildPanelLoginUrl(window.location.origin).toString()
    window.setTimeout(() => {
      window.location.replace(login)
    }, 800)
  }, [])

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {done ? 'Cookies e armazenamento limpos. A ir para o login…' : 'A limpar…'}
      </p>
    </div>
  )
}
