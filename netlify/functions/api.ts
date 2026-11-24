import serverless from 'serverless-http';
import { connectLambda, getStore } from '@netlify/blobs';
import { createExpressApp } from '../../server/app';
import {
  flushDbToRemoteStore,
  registerRemoteDbAdapter,
  syncDbFromRemoteStore,
  type PrepWiseDatabase,
} from '../../server/db';

const BLOB_STORE_NAME = 'divshinastudy-data';
const BLOB_DB_KEY = 'prepwise-db.json';

export interface NetlifyFunctionEvent {
  rawUrl?: string;
  rawQuery?: string;
  path?: string;
  requestPath?: string;
  httpMethod?: string;
  headers?: Record<string, string | undefined>;
  multiValueHeaders?: Record<string, string[] | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
  multiValueQueryStringParameters?: Record<string, string[] | undefined> | null;
  body?: string | null;
  isBase64Encoded?: boolean;
  blobs?: string;
  [key: string]: unknown;
}

export function normalizeNetlifyApiPath(rawPath: string, rawUrl?: string): string {
  let pathname = rawPath || '/';
  if (rawUrl) {
    try {
      const parsedPathname = new URL(rawUrl).pathname;
      if (parsedPathname && parsedPathname !== '/') {
        pathname = parsedPathname;
      }
    } catch {
      // Keep rawPath if rawUrl cannot be parsed
    }
  }
  pathname = pathname.replace(/^\/\.netlify\/functions\/api(?=\/|$)/, '');
  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`;
  }
  if (pathname === '/') {
    return '/api';
  }
  return pathname === '/api' || pathname.startsWith('/api/') ? pathname : `/api${pathname}`;
}

const app = createExpressApp();
const expressHandler = serverless(app);

export const handler = async (
  event: NetlifyFunctionEvent,
  context: Record<string, unknown> = {}
) => {
  let blobsAvailable = Boolean(process.env.NETLIFY_BLOBS_CONTEXT);
  if (typeof event.blobs === 'string' && event.blobs.length > 0) {
    try {
      const headers = event.headers ?? {};
      const normalizedHeaders: Record<string, string | undefined> = { ...headers };
      for (const [k, v] of Object.entries(headers)) {
        normalizedHeaders[k.toLowerCase()] = v;
      }
      connectLambda({
        ...event,
        headers: normalizedHeaders,
      } as unknown as Parameters<typeof connectLambda>[0]);
      blobsAvailable = true;
    } catch (err) {
      console.warn('[Divshinastudy Netlify] connectLambda skipped:', err instanceof Error ? err.message : err);
    }
  }

  if (blobsAvailable) {
    registerRemoteDbAdapter({
      async load() {
        const store = getStore(BLOB_STORE_NAME);
        try {
          const data = await store.get(BLOB_DB_KEY, { type: 'json', consistency: 'strong' });
          return (data as Partial<PrepWiseDatabase> | null) ?? null;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const name = err instanceof Error ? err.name : '';
          if (
            name === 'BlobsConsistencyError' ||
            msg.includes('uncachedEdgeURL') ||
            msg.includes('strong consistency')
          ) {
            const data = await store.get(BLOB_DB_KEY, { type: 'json', consistency: 'eventual' });
            return (data as Partial<PrepWiseDatabase> | null) ?? null;
          }
          throw err;
        }
      },
      async save(db) {
        const store = getStore(BLOB_STORE_NAME);
        await store.setJSON(BLOB_DB_KEY, db);
      },
    });
    await syncDbFromRemoteStore();
  } else {
    registerRemoteDbAdapter(null);
  }

  const normalizedPath = normalizeNetlifyApiPath(
    event.requestPath || event.path || '/',
    event.rawUrl
  );

  let queryStringParameters = event.queryStringParameters ?? undefined;
  let normalizedRawUrl = event.rawUrl;
  if (event.rawUrl) {
    try {
      const parsedUrl = new URL(event.rawUrl);
      parsedUrl.pathname = normalizedPath;
      normalizedRawUrl = parsedUrl.toString();
      if (!queryStringParameters && parsedUrl.searchParams.size > 0) {
        const qp: Record<string, string> = {};
        parsedUrl.searchParams.forEach((val, key) => {
          qp[key] = val;
        });
        queryStringParameters = qp;
      }
    } catch {
      // Ignore malformed rawUrl
    }
  }

  const normalizedEvent: NetlifyFunctionEvent = {
    ...event,
    path: normalizedPath,
    requestPath: normalizedPath,
    httpMethod: event.httpMethod || 'GET',
    ...(queryStringParameters ? { queryStringParameters } : {}),
    ...(normalizedRawUrl ? { rawUrl: normalizedRawUrl } : {}),
  };

  try {
    const response = await expressHandler(normalizedEvent, context);
    await flushDbToRemoteStore();
    return response;
  } catch (err) {
    console.error('[Divshinastudy Netlify API error]', err);
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Server error while processing request.' }),
    };
  }
};
