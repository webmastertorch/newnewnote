interface Window {
  lark?: {
    requestAuthCode: (options: { appId: string; redirectUri: string }) => void;
  };
} 
