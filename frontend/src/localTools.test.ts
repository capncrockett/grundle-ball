import { isLocalToolsHost } from './localTools';

describe('isLocalToolsHost', () => {
  it.each(['localhost', 'app.localhost', '127.0.0.1', '::1', '[::1]'])(
    'allows the local hostname %s',
    (hostname) => {
      expect(isLocalToolsHost(hostname)).toBe(true);
    },
  );

  it.each(['grundle-ball.vercel.app', '192.168.1.50', 'example.com'])(
    'rejects the non-local hostname %s',
    (hostname) => {
      expect(isLocalToolsHost(hostname)).toBe(false);
    },
  );
});
