/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_DEFAULT_LOCALE: string;
  readonly VITE_SUPPORTED_LOCALES: string;
  readonly VITE_API_TOKEN?: string;
  readonly VITE_COUNSEL_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
