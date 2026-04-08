// @ts-check

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { buildBoard } from "./services/board.js";

try {
  loadEnvFile();
} catch {
  // .env es opcional
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = normalize(join(__dirname, "..", "public"));

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

/**
 * @param {string} filePath
 */
function staticCacheControl(filePath) {
  const extension = extname(filePath);
  if (extension === ".html") return "no-store";
  if (extension === ".css" || extension === ".js") return "no-store";
  return "public, max-age=3600";
}

/**
 * @param {string} pathname
 */
function safePublicPath(pathname) {
  const cleaned = pathname === "/" ? "/index.html" : pathname;
  const fullPath = normalize(join(publicDir, cleaned));
  if (!fullPath.startsWith(publicDir)) return null;
  return fullPath;
}

/**
 * @param {import("node:http").ServerResponse} response
 * @param {number} status
 * @param {unknown} data
 */
function sendJson(response, status, data) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(data));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  try {
    if (url.pathname === "/healthz") {
      return sendJson(response, 200, {
        ok: true,
        service: "clima-brc",
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/board") {
      const payload = await buildBoard({
        targetDate: url.searchParams.get("date") ?? undefined
      });
      return sendJson(response, 200, payload);
    }

    const filePath = safePublicPath(url.pathname);
    if (!filePath) return sendJson(response, 403, { error: "Ruta no permitida" });

    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
      "cache-control": staticCacheControl(filePath)
    });
    response.end(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    if (url.pathname.startsWith("/api/")) {
      return sendJson(response, 500, {
        error: message,
        timestamp: new Date().toISOString()
      });
    }

    response.writeHead(404, {
      "content-type": "text/plain; charset=utf-8"
    });
    response.end("No encontrado");
  }
});

const port = Number(process.env.PORT || "8787");
const host = process.env.HOST || "0.0.0.0";
server.listen(port, host, () => {
  console.log(`Clima BRC escuchando en http://${host}:${port}`);
});
