import { Html, Head, Main, NextScript } from "next/document";
import {
  getDocumentBodyScriptsForRoute,
  getDocumentHeadDataForRoute,
} from "../src/lib/webflow-files";

const booleanAttrs = new Set([
  "async",
  "autoplay",
  "checked",
  "controls",
  "defer",
  "disabled",
  "hidden",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "open",
  "playsinline",
  "readonly",
  "required",
  "selected",
]);

function renderAttrs(attrs = {}) {
  const normalized = {};

  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;

    if (key === "crossorigin") {
      normalized.crossOrigin = value === true ? "" : value;
    } else if (key === "charset") {
      normalized.charSet = value;
    } else if (key === "nomodule") {
      normalized.noModule = value === true || value === "" ? true : value;
    } else if (key === "playsinline") {
      normalized.playsInline = value === true || value === "" ? true : value;
    } else if (key === "readonly") {
      normalized.readOnly = value === true || value === "" ? true : value;
    } else if (booleanAttrs.has(key)) {
      normalized[key] = value === true || value === "" ? true : value;
    } else {
      normalized[key] = value === true ? "" : value;
    }
  }

  return normalized;
}

export default function Document(props) {
  const route = props.__NEXT_DATA__?.page || "/";
  const headData = getDocumentHeadDataForRoute(route);
  const bodyScripts = getDocumentBodyScriptsForRoute(route);

  return (
    <Html
      lang="en"
      data-wf-domain={headData.htmlAttrs["data-wf-domain"]}
      data-wf-page={headData.htmlAttrs["data-wf-page"]}
      data-wf-site={headData.htmlAttrs["data-wf-site"]}
      data-wf-status={headData.htmlAttrs["data-wf-status"]}
    >
      <Head>
        {headData.links.map((link, index) => (
          <link key={`webflow-link-${index}`} {...renderAttrs(link)} />
        ))}
        {headData.styles.map((style, index) => (
          <style
            key={`webflow-style-${index}`}
            {...renderAttrs(style.attrs)}
            dangerouslySetInnerHTML={{ __html: style.content }}
          />
        ))}
        {headData.scripts.map((script, index) => (
          <script
            key={`webflow-head-script-${index}`}
            {...renderAttrs(script.attrs)}
            dangerouslySetInnerHTML={{ __html: script.content }}
          />
        ))}
      </Head>
      <body>
        <Main />
        {bodyScripts.map((script, index) => (
          <script
            key={`webflow-body-script-${index}`}
            {...renderAttrs(script.attrs)}
            dangerouslySetInnerHTML={script.content ? { __html: script.content } : undefined}
          />
        ))}
        <NextScript />
      </body>
    </Html>
  );
}
