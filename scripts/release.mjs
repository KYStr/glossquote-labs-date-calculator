export const PAGE_PATHS = Object.freeze(["index.html", "en/index.html"]);

export function releasePolicy(siteUrl) {
  if (typeof siteUrl !== "string" || !/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?(?:\/[a-zA-Z0-9_/-]*)?$/.test(siteUrl)) {
    throw new Error("site-url must be an explicit HTTPS base URL with a plain path and no credentials, query, or fragment.");
  }
  const url = new URL(siteUrl);
  if (!url.hostname.includes(".") || url.hostname.startsWith(".") || url.hostname.endsWith(".") ||
      url.pathname.includes("//") || url.pathname.split("/").some((part) => part === "." || part === "..")) {
    throw new Error("site-url must contain a host and an unambiguous deployment directory.");
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  const base = url.href;
  const urls = PAGE_PATHS.map((path) => new URL(path, base).href);
  const links = (page) => [
    `<link rel="canonical" href="${urls[PAGE_PATHS.indexOf(page)]}">`,
    `<link rel="alternate" hreflang="zh-Hant" href="${urls[0]}">`,
    `<link rel="alternate" hreflang="en" href="${urls[1]}">`,
  ];
  const files = new Map([["sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((entry) => `  <url><loc>${entry}</loc></url>`).join("\n") + "\n</urlset>\n"]]);
  if (url.pathname === "/") files.set("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${base}sitemap.xml\n`);
  return { base, urls, links, files };
}

export function parseReleaseArgs(args) {
  if (args.length === 0) return { production: false };
  if (args.length !== 3 || !args.includes("--production")) {
    throw new Error("Use --production --site-url https://host/directory/ together, or no arguments for preview.");
  }
  const productionAt = args.indexOf("--production");
  if (productionAt !== 0 && productionAt !== 2) throw new Error("Unknown release argument order.");
  const remaining = args.filter((_, index) => index !== productionAt);
  if (remaining[0] !== "--site-url") throw new Error("Unknown release arguments.");
  releasePolicy(remaining[1]);
  return { production: true, siteUrl: remaining[1] };
}

function activeMarkup(html) {
  // Preserve offsets so transformations still refer to the original document.
  const blank = (text) => " ".repeat(text.length);
  const uncommented = html.replace(/<!--[\s\S]*?(?:-->|$)/g, blank);
  // This release format has no templates or unusual parsing contexts in head.
  const head = uncommented.match(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i)?.[0] ?? "";
  if (/<(?:template|noscript|textarea|xmp|iframe|noembed|noframes|plaintext)\b/i.test(head)) {
    throw new Error("Unsupported parsing context in release head.");
  }
  return uncommented.replace(/<(script|style|title|textarea|template|noscript|xmp|iframe|noembed|noframes|plaintext)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, blank);
}

function seoTags(html) {
  return [...activeMarkup(html).matchAll(/<(?:meta|link)\b[^>]*>/gi)].filter(([tag]) =>
    /\b(?:rel|name)\s*=\s*["']?(?:canonical|alternate|robots)\b/i.test(tag));
}

function assertHead(html, tags) {
  const heads = [...activeMarkup(html).matchAll(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi)];
  if (heads.length !== 1 || tags.some((tag) => tag.index <= heads[0].index ||
      tag.index >= heads[0].index + heads[0][0].length)) {
    throw new Error("SEO metadata must occur once in the document head.");
  }
}

export function productionHtml(html, page, policy) {
  if (!PAGE_PATHS.includes(page)) throw new Error("Unknown language page.");
  const tags = seoTags(html);
  assertHead(html, tags);
  const relativeLinks = page === "index.html"
    ? ['<link rel="alternate" hreflang="en" href="./en/index.html">', '<link rel="alternate" hreflang="zh-Hant" href="./index.html">']
    : ['<link rel="alternate" hreflang="zh-Hant" href="../index.html">', '<link rel="alternate" hreflang="en" href="./index.html">'];
  const expected = ['<meta name="robots" content="noindex, nofollow">', ...relativeLinks];
  if (tags.length !== expected.length || expected.some((tag) => tags.filter(([actual]) => actual === tag).length !== 1)) {
    throw new Error("Unexpected preview SEO metadata; production transformation refused.");
  }
  let output = html.replace(expected[0], '<meta name="robots" content="index, follow">\n  ' + policy.links(page).join("\n  "));
  for (const tag of relativeLinks) output = output.replace(tag, "");
  assertProductionHtml(output, page, policy);
  return output;
}

export function assertProductionHtml(html, page, policy) {
  if (!PAGE_PATHS.includes(page)) throw new Error("Unexpected production HTML page.");
  const tags = seoTags(html);
  assertHead(html, tags);
  const expected = ['<meta name="robots" content="index, follow">', ...policy.links(page)];
  if (tags.length !== expected.length || expected.some((tag) => tags.filter(([actual]) => actual === tag).length !== 1)) {
    throw new Error("Production SEO metadata differs from the exact language URL policy.");
  }
}
