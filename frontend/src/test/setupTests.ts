import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';
import { TransformStream, WritableStream, ReadableStream } from 'stream/web';

// Silence expected console noise from error-state tests
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

class SafeMessagePort {
  onmessage: ((event: { data?: unknown }) => void) | null = null;
  postMessage(data?: unknown) {
    setTimeout(() => {
      this.onmessage?.({ data });
    }, 0);
  }
  close() {}
  start() {}
}

class SafeMessageChannel {
  port1: SafeMessagePort;
  port2: SafeMessagePort;

  constructor() {
    this.port1 = new SafeMessagePort();
    this.port2 = new SafeMessagePort();
    this.port2.postMessage = (data?: unknown) => {
      setTimeout(() => {
        this.port1.onmessage?.({ data });
      }, 0);
    };
    this.port1.postMessage = (data?: unknown) => {
      setTimeout(() => {
        this.port2.onmessage?.({ data });
      }, 0);
    };
  }
}

class MockBroadcastChannel {
  name: string;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onmessageerror: ((ev: MessageEvent) => void) | null = null;
  constructor(name: string) {
    this.name = name;
  }
  postMessage(data?: unknown) {
    const event = new MessageEvent('message', { data });
    this.onmessage?.(event);
  }
  close() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }
}

type PolyfillableGlobals = {
  TextEncoder?: typeof globalThis.TextEncoder;
  TextDecoder?: typeof globalThis.TextDecoder;
  TransformStream?: typeof globalThis.TransformStream;
  ReadableStream?: typeof globalThis.ReadableStream;
  WritableStream?: typeof globalThis.WritableStream;
  fetch?: typeof globalThis.fetch;
  Headers?: typeof globalThis.Headers;
  Request?: typeof globalThis.Request;
  Response?: typeof globalThis.Response;
};

type TestGlobal = Omit<
  typeof globalThis,
  keyof PolyfillableGlobals | 'MessageChannel' | 'MessagePort' | 'BroadcastChannel'
> &
  PolyfillableGlobals & {
    MessageChannel?: typeof globalThis.MessageChannel | typeof SafeMessageChannel;
    MessagePort?: typeof globalThis.MessagePort | typeof SafeMessagePort;
    BroadcastChannel?: typeof globalThis.BroadcastChannel | typeof MockBroadcastChannel;
  };

const globalScope = globalThis as TestGlobal;
const polyfillTextEncoder = TextEncoder;
const polyfillTextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;
const polyfillTransformStream = TransformStream as unknown as typeof globalThis.TransformStream;
const polyfillReadableStream = ReadableStream as unknown as typeof globalThis.ReadableStream;
const polyfillWritableStream = WritableStream as unknown as typeof globalThis.WritableStream;
const polyfillBroadcastChannel =
  MockBroadcastChannel as unknown as typeof globalThis.BroadcastChannel;

// Polyfill TextEncoder/TextDecoder for react-router in Jest
if (!globalScope.TextEncoder) {
  globalScope.TextEncoder = polyfillTextEncoder;
}

if (!globalScope.TextDecoder) {
  globalScope.TextDecoder = polyfillTextDecoder;
}

if (!globalScope.TransformStream) {
  globalScope.TransformStream = polyfillTransformStream;
}

if (!globalScope.ReadableStream) {
  globalScope.ReadableStream = polyfillReadableStream;
}

if (!globalScope.WritableStream) {
  globalScope.WritableStream = polyfillWritableStream;
}

globalScope.MessageChannel = globalScope.MessageChannel ?? SafeMessageChannel;
globalScope.MessagePort = globalScope.MessagePort ?? SafeMessagePort;

// Load undici only after global TextEncoder/TextDecoder are available
// eslint-disable-next-line @typescript-eslint/no-require-imports
const undici = require('undici') as typeof import('undici');
const polyfillFetch = undici.fetch as unknown as typeof globalThis.fetch;
const polyfillHeaders = undici.Headers as unknown as typeof globalThis.Headers;
const polyfillRequest = undici.Request as unknown as typeof globalThis.Request;
const polyfillResponse = undici.Response as unknown as typeof globalThis.Response;

// Prefer Node/undici fetch so MSW's node server can intercept
globalScope.fetch = globalScope.fetch ?? polyfillFetch;
globalScope.Headers = globalScope.Headers ?? polyfillHeaders;
globalScope.Request = globalScope.Request ?? polyfillRequest;
globalScope.Response = globalScope.Response ?? polyfillResponse;

if (!globalScope.BroadcastChannel) {
  globalScope.BroadcastChannel = polyfillBroadcastChannel;
}

// Load MSW server only after fetch/Response are defined
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { server } = require('./server') as typeof import('./server');

// MSW: start/stop per test lifecycle
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
  consoleErrorSpy.mockRestore();
  consoleWarnSpy.mockRestore();
});
