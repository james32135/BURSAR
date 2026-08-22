/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly PRIVY_APP_ID: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
