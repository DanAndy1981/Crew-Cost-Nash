const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT) || 8080;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp"
};

const server = http.createServer((request, response) => {
  let pathname;

  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  if (pathname === "/") pathname = "/index.html";

  const requestedPath = path.resolve(root, "." + pathname);
  const isInsideRoot = requestedPath.startsWith(root + path.sep);
  const isPrivateFile =
    requestedPath === path.join(root, "server.js") ||
    requestedPath === path.join(root, "package.json") ||
    pathname.startsWith("/.");

  if (!isInsideRoot || isPrivateFile || !contentTypes[path.extname(requestedPath).toLowerCase()]) {
    response.writeHead(404).end("Not found");
    return;
  }

  fs.stat(requestedPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(requestedPath).toLowerCase()],
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache"
    });

    fs.createReadStream(requestedPath).pipe(response);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Crew Cost site listening on port ${port}`);
});
