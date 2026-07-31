import { pruneExpiredSessions } from "./auth.mjs";
import { defaultPort, host } from "./config.mjs";
import { createRaddusHttpServer, listenOnAvailablePort } from "./http.mjs";

export async function startServer({ isDev = false, port = defaultPort } = {}) {
  const startPort = Number.isFinite(port) ? port : 5174;
  const server = await createRaddusHttpServer({ isDev, defaultPort: startPort });
  const listeningPort = await listenOnAvailablePort(server, startPort);
  const interval = setInterval(pruneExpiredSessions, 60_000);
  interval.unref?.();

  console.log(`Raddus Canvas listening at http://${host}:${listeningPort}`);

  return {
    server,
    port: listeningPort,
    interval,
    stop: () => new Promise((resolveStop, rejectStop) => {
      clearInterval(interval);
      server.close((error) => {
        if (error) rejectStop(error);
        else resolveStop();
      });
    }),
  };
}
