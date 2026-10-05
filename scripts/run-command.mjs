import { spawn } from 'node:child_process';

export function runCommand(command, args, { cwd, lease, env = lease.env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: 'inherit',
      detached: process.platform !== 'win32',
    });
    const unregister = child.pid
      ? lease.register(child.pid, [command, ...args].join(' '))
      : () => {};
    let interrupted = false;
    let termination = Promise.resolve();
    const stop = (signal) => {
      if (interrupted) return;
      interrupted = true;
      if (process.platform === 'win32') {
        // Kill this owned command's descendants as well as its npm wrapper.
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        });
        termination = new Promise((done) => {
          let settled = false;
          const finish = (failed) => {
            if (settled) return;
            settled = true;
            if (failed) {
              const reason =
                'Command-tree shutdown could not be verified; inspect retained ownership before recovery.';
              console.error(reason);
              lease.retain(reason);
              child.kill(signal);
            }
            done();
          };
          killer.once('error', () => finish(true));
          killer.once('close', (code) => finish(code !== 0));
        });
      } else {
        try {
          process.kill(-child.pid, signal);
        } catch (error) {
          if (error.code !== 'ESRCH') child.kill(signal);
        }
      }
    };
    const interrupt = () => stop('SIGINT');
    const terminate = () => stop('SIGTERM');
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', terminate);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', terminate);
      unregister();
    };
    child.once('error', (error) => {
      cleanup();
      reject(error);
    });
    child.once('close', async (status, signal) => {
      await termination;
      cleanup();
      resolve({ status: interrupted ? 1 : status, signal });
    });
  });
}
