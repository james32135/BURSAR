const KEY = 'bursar.workspace'

export type StoredWorkspace = {
  id: string
  owner: string
  vault: string
  sessionId: string
  agentAddress: string
  agentToken: string
  demo: boolean
}

export function loadWorkspace(): StoredWorkspace | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredWorkspace
  } catch {
    return null
  }
}

export function saveWorkspace(ws: StoredWorkspace) {
  localStorage.setItem(KEY, JSON.stringify(ws))
}

export function clearWorkspace() {
  localStorage.removeItem(KEY)
}

export function enterDemo() {
  clearWorkspace()
  localStorage.setItem('bursar.mode', 'demo')
}

export function isDemoMode() {
  const ws = loadWorkspace()
  if (ws) return Boolean(ws.demo)
  return localStorage.getItem('bursar.mode') === 'demo'
}
