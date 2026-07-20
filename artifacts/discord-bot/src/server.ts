/**
 * Minimal HTTP health-check server.
 * Required by Render Web Service type to keep the process alive.
 * Harmless when running locally — just listens on PORT if set.
 */
import http from "node:http";

export function startHealthServer(): void {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;
  if (!port) return; // Skip locally unless PORT is set

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "discord-moderation-bot" }));
  });

  server.listen(port, () => {
    console.log(`[Health] HTTP server listening on port ${port}`);
  });
}
