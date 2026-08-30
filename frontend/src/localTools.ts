const LOCAL_TOOL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export const isLocalToolsHost = (hostname?: string): boolean => {
  const candidate = hostname ?? (typeof window === 'undefined' ? '' : window.location.hostname);
  const normalized = candidate.trim().toLowerCase().replace(/\.$/, '');
  return LOCAL_TOOL_HOSTS.has(normalized) || normalized.endsWith('.localhost');
};
