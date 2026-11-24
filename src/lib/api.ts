const SESSION_STORAGE_KEY = 'divshinastudy_session_token';
let memorySessionToken: string | null = null;

export function getSessionToken(): string | null {
  if (memorySessionToken) return memorySessionToken;
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        memorySessionToken = stored;
        return stored;
      }
    } catch {
      // Ignore localStorage read errors in restricted environments
    }
  }
  return null;
}

export function setSessionToken(token: string | null): void {
  memorySessionToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore localStorage write errors in restricted environments
    }
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = isFormData
    ? {
        'X-Requested-With': 'XMLHttpRequest',
        ...(options.headers as Record<string, string> | undefined),
      }
    : {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(options.headers as Record<string, string> | undefined),
      };

  const activeToken = getSessionToken();
  if (activeToken && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${activeToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const rawText = await response.text();
  let data: Record<string, unknown> | null = null;
  if (rawText) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === 'object') {
        data = parsed as Record<string, unknown>;
      }
    } catch {
      // Non-JSON error body (e.g. HTML 502/404 from proxy) handled gracefully below
    }
  }

  if (data && typeof data.session_token === 'string') {
    setSessionToken(data.session_token);
  }
  if (url === '/api/auth/logout') {
    setSessionToken(null);
  }

  if (!response.ok) {
    if (response.status === 401) {
      setSessionToken(null);
      if (typeof window !== 'undefined' && url !== '/api/auth/login' && url !== '/api/auth/register') {
        window.dispatchEvent(new Event('divshinastudy:unauthorized'));
      }
    }
    const message =
      (data && typeof data.error === 'string' ? data.error : null) ||
      `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return (data ?? {}) as T;
}
