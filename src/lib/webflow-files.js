import fs from "node:fs";
import path from "node:path";

const pagesDir = path.join(process.cwd(), "src", "webflow", "pages");

const routeFileMap = {
  "/": "index.html",
  "/pricing": "pricing.html",
  "/404": "not-found.html",
  "/hello@dstudio.agency": "not-found.html",
  "/aditya@dstudio.agency": "not-found.html",
};

function readPage(fileName) {
  return fs.readFileSync(path.join(pagesDir, fileName), "utf8");
}

function matchTag(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
  return match ? match[1] : "";
}

function extractBody(html) {
  return matchTag(html, "body");
}

function stripScripts(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

function extractTitle(html) {
  return matchTag(html, "title").trim() || "Dstudio Agency";
}

function extractDescription(html) {
  const match = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  return match ? match[1] : "";
}

function parseAttributes(tag) {
  const attrs = {};
  const attrPattern = /([:@\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;

  while ((match = attrPattern.exec(tag))) {
    const key = match[1];
    if (key === "link" || key === "script" || key === "style" || key.startsWith("<")) {
      continue;
    }
    attrs[key.toLowerCase()] = decodeHtmlAttribute(match[2] ?? match[3] ?? match[4] ?? true);
  }

  return attrs;
}

function decodeHtmlAttribute(value) {
  if (typeof value !== "string") return value;

  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&#60;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#62;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractHtmlAttrs(html) {
  const match = html.match(/<html\b([^>]*)>/i);
  return match ? parseAttributes(match[0]) : {};
}

function extractHeadData(html) {
  const head = matchTag(html, "head");
  const links = [];
  const styles = [];
  const scripts = [];

  for (const linkMatch of head.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = parseAttributes(linkMatch[0]);
    const rel = String(attrs.rel || "").toLowerCase();

    if (
      rel === "stylesheet" ||
      rel === "shortcut icon" ||
      rel === "icon" ||
      rel === "apple-touch-icon"
    ) {
      links.push(attrs);
    }
  }

  for (const styleMatch of head.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)) {
    styles.push({
      attrs: parseAttributes(`<style ${styleMatch[1] || ""}>`),
      content: styleMatch[2],
    });
  }

  for (const scriptMatch of head.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = parseAttributes(`<script ${scriptMatch[1] || ""}>`);
    if (!attrs.src) {
      scripts.push({
        attrs,
        content: scriptMatch[2],
      });
    }
  }

  return {
    htmlAttrs: extractHtmlAttrs(html),
    links,
    styles,
    scripts,
  };
}

function extractBodyScripts(html) {
  const body = extractBody(html);
  const scripts = [];

  for (const scriptMatch of body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    scripts.push({
      attrs: parseAttributes(`<script ${scriptMatch[1] || ""}>`),
      content: scriptMatch[2],
    });
  }

  return scripts;
}

export function getWebflowPageData(fileName) {
  const html = readPage(fileName);

  return {
    title: extractTitle(html),
    description: extractDescription(html),
    bodyHtml: stripScripts(extractBody(html)),
  };
}

export async function getWebflowPageProps(fileName) {
  return {
    props: getWebflowPageData(fileName),
  };
}

export function getDocumentHeadDataForRoute(route) {
  const fileName = routeFileMap[route] || "not-found.html";
  return extractHeadData(readPage(fileName));
}

export function getDocumentBodyScriptsForRoute(route) {
  const fileName = routeFileMap[route] || "not-found.html";
  return extractBodyScripts(readPage(fileName));
}
