/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LARK_APP_ID: string;
  readonly VITE_LARK_APP_SECRET: string;
  readonly VITE_OPENAI_API_KEY: string;
  readonly VITE_ROOT_FOLDER_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  lark?: {
    requestAuthCode: (options: { appId: string; redirectUri: string }) => void;
  };
} 