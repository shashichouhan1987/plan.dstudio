import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "website");
const outputPagesDir = path.join(rootDir, "src", "webflow", "pages");
const publicAssetsDir = path.join(rootDir, "public", "assets");
const fontCssPath = path.join(publicAssetsDir, "fonts", "inter.css");
const fontCssHref = "/assets/fonts/inter.css";

const sourcePages = [
  { input: "index.html", output: "index.html" },
  { input: "pricing.html", output: "pricing.html" },
  { input: "hello@dstudio.agency.html", output: "not-found.html" },
];

const assetHosts = new Set([
  "ajax.googleapis.com",
  "cdn.jsdelivr.net",
  "cdn.prod.website-files.com",
  "d3e54v103j8qbb.cloudfront.net",
  "fonts.gstatic.com",
]);

const fetchedAssets = new Map();

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitize(value) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function hash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 10);
}

function isAssetUrl(value) {
  try {
    return assetHosts.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

function normalizeUrl(value) {
  return value.replace(/&amp;/g, "&");
}

function guessContext(url) {
  const pathname = new URL(url).pathname.toLowerCase();

  if (pathname.endsWith(".css")) return "style";
  if (pathname.endsWith(".js") || pathname.endsWith(".txt")) return "script";
  if (pathname.endsWith(".woff") || pathname.endsWith(".woff2") || pathname.endsWith(".ttf")) return "font";
  if (pathname.endsWith(".mp4") || pathname.endsWith(".webm") || pathname.endsWith(".mov")) return "video";
  return "asset";
}

function localPathFor(url, context) {
  const parsed = new URL(url);
  const host = sanitize(parsed.hostname.replace(/\./g, "-")) || "remote";
  const rawBaseName = path.posix.basename(parsed.pathname) || "asset";
  let baseName = sanitize(safeDecode(rawBaseName)) || "asset";
  let extension = path.extname(baseName);

  if (context === "script" && extension === ".txt") {
    baseName = baseName.replace(/\.txt$/i, ".js");
    extension = ".js";
  }

  if (!extension) {
    if (context === "style") baseName += ".css";
    if (context === "script") baseName += ".js";
  }

  return `/assets/${host}/${hash(url)}-${baseName}`;
}

function localSiblingPath(publicPath, fileName) {
  return path.posix.join(path.posix.dirname(publicPath), fileName);
}

function localFsPath(publicPath) {
  return path.join(rootDir, "public", publicPath.replace(/^\//, ""));
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function replaceAsync(input, pattern, replacer) {
  const parts = [];
  let lastIndex = 0;

  for (const match of input.matchAll(pattern)) {
    parts.push(input.slice(lastIndex, match.index));
    parts.push(await replacer(match));
    lastIndex = match.index + match[0].length;
  }

  parts.push(input.slice(lastIndex));
  return parts.join("");
}

async function processCss(css, baseUrl) {
  return replaceAsync(css, /url\((["']?)(.*?)\1\)/gi, async (match) => {
    const rawUrl = match[2].trim();

    if (
      !rawUrl ||
      rawUrl.startsWith("data:") ||
      rawUrl.startsWith("#") ||
      rawUrl.startsWith("about:")
    ) {
      return match[0];
    }

    const resolvedUrl = new URL(rawUrl, baseUrl).toString();
    if (!isAssetUrl(resolvedUrl)) return match[0];

    const localPath = await downloadAsset(resolvedUrl, guessContext(resolvedUrl));
    return `url("${localPath}")`;
  });
}

function processScript(script) {
  return script.replace(
    'return Webflow.env("editor")!==void 0?',
    'return typeof Webflow!="undefined"&&Webflow.env("editor")!==void 0?'
  );
}

function extractWebflowChunkFileNames(script) {
  if (!script.includes("webflow.achunk.")) return [];

  const fileNames = new Set();
  const chunkMapPattern = /webflow\.achunk\.[\s\S]{0,5000}?\}\)\[e\]\s*\+\s*["']\.js["']/g;

  for (const mapMatch of script.matchAll(chunkMapPattern)) {
    for (const hashMatch of mapMatch[0].matchAll(/["']([a-f0-9]{16})["']/gi)) {
      fileNames.add(`webflow.achunk.${hashMatch[1]}.js`);
    }
  }

  return Array.from(fileNames);
}

async function downloadRuntimeSiblingAsset(rawUrl, publicPath) {
  const url = normalizeUrl(rawUrl);
  if (!isAssetUrl(url)) return;

  if (fetchedAssets.has(url)) return;
  fetchedAssets.set(url, publicPath);

  const content = await fetchBuffer(url);
  const destination = localFsPath(publicPath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, content);
}

async function downloadWebflowRuntimeChunks(script, scriptUrl, scriptPublicPath) {
  const chunkFileNames = extractWebflowChunkFileNames(script);

  for (const fileName of chunkFileNames) {
    const chunkUrl = new URL(fileName, scriptUrl).toString();
    const publicPath = localSiblingPath(scriptPublicPath, fileName);
    await downloadRuntimeSiblingAsset(chunkUrl, publicPath);
  }
}

async function downloadAsset(rawUrl, context = "asset") {
  const url = normalizeUrl(rawUrl);
  if (!isAssetUrl(url)) return url;

  if (fetchedAssets.has(url)) {
    return fetchedAssets.get(url);
  }

  const publicPath = localPathFor(url, context);
  fetchedAssets.set(url, publicPath);

  let content = await fetchBuffer(url);

  if (context === "style") {
    const css = await processCss(content.toString("utf8"), url);
    content = Buffer.from(css, "utf8");
  } else if (context === "script") {
    const script = processScript(content.toString("utf8"));
    await downloadWebflowRuntimeChunks(script, url, publicPath);
    content = Buffer.from(script, "utf8");
  }

  const destination = localFsPath(publicPath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, content);

  return publicPath;
}

function extractUrls(html) {
  const urls = new Set();
  const pattern = /https?:\/\/[^"'<>\s]+/g;

  for (const match of html.matchAll(pattern)) {
    for (const part of normalizeUrl(match[0]).split(/,(?=https?:\/\/)/)) {
      const cleaned = part.trim();
      if (isAssetUrl(cleaned)) urls.add(cleaned);
    }
  }

  return Array.from(urls);
}

function stripRemoteFontLoader(html) {
  return html
    .replace(/<link\b[^>]*href=["']https:\/\/fonts\.googleapis\.com["'][^>]*>\s*/gi, "")
    .replace(/<link\b[^>]*href=["']https:\/\/fonts\.gstatic\.com["'][^>]*>\s*/gi, "")
    .replace(/<script\b[^>]*src=["']https:\/\/ajax\.googleapis\.com\/ajax\/libs\/webfont\/1\.6\.26\/webfont\.js["'][^>]*><\/script>\s*/gi, "")
    .replace(/<script\b[^>]*>\s*WebFont\.load\([\s\S]*?\);\s*<\/script>\s*/gi, "");
}

function stripPreconnects(html) {
  return html.replace(/<link\b[^>]*rel=["']preconnect["'][^>]*>\s*/gi, "");
}

function stripIntegrityForLocalFiles(html) {
  return html
    .replace(/\s+integrity=(["']).*?\1/gi, "")
    .replace(/\s+crossorigin=(["']).*?\1/gi, "");
}

function addLocalFontCss(html) {
  if (html.includes(fontCssHref)) return html;
  return html.replace("</head>", `<link href="${fontCssHref}" rel="stylesheet" type="text/css"/></head>`);
}

async function buildInterFontCss() {
  const googleCssUrl =
    "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap";
  const response = await fetch(googleCssUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download Inter font CSS: ${response.status} ${response.statusText}`);
  }

  const css = await processCss(await response.text(), googleCssUrl);
  await fs.mkdir(path.dirname(fontCssPath), { recursive: true });
  await fs.writeFile(fontCssPath, css, "utf8");
}

async function localizeHtml(html) {
  let localized = addLocalFontCss(stripPreconnects(stripRemoteFontLoader(html)));
  const urls = extractUrls(localized);

  for (const url of urls) {
    await downloadAsset(url, guessContext(url));
  }

  const replacements = Array.from(fetchedAssets.entries()).sort((a, b) => b[0].length - a[0].length);
  for (const [remoteUrl, localPath] of replacements) {
    localized = localized.split(remoteUrl).join(localPath);
    localized = localized.split(remoteUrl.replace(/&/g, "&amp;")).join(localPath);
  }

  return stripIntegrityForLocalFiles(localized);
}

async function run() {
  await fs.mkdir(outputPagesDir, { recursive: true });
  await buildInterFontCss();

  for (const page of sourcePages) {
    const sourcePath = path.join(sourceDir, page.input);
    const outputPath = path.join(outputPagesDir, page.output);
    const html = await fs.readFile(sourcePath, "utf8");
    const localized = await localizeHtml(html);

    await fs.writeFile(outputPath, localized, "utf8");
    console.log(`Imported ${page.input} -> ${path.relative(rootDir, outputPath)}`);
  }

  console.log(`Downloaded ${fetchedAssets.size} local assets.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
