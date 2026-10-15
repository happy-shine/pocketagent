import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

export function configureNetworkProxy(proxy?: string): void {
  if (!proxy) return;
  const noProxy = 'localhost,127.0.0.1,::1';
  process.env.HTTPS_PROXY = proxy;
  process.env.HTTP_PROXY = proxy;
  process.env.NO_PROXY = noProxy;
  setGlobalDispatcher(new EnvHttpProxyAgent({ httpProxy: proxy, httpsProxy: proxy, noProxy }));
}
