import { DynamicTool } from "@langchain/core/tools";
import { tool } from "ai";
import { z } from "zod";

const DESCRIPTION =
  "Fetch and read the full content of a specific web page as clean markdown. Use this after web_search to read a URL in detail — documentation, blog posts, project sites, HashScan explorer pages, or any URL the user provides. Prefer this over web_search when the user asks you to read, summarize, or answer questions about a specific page.";

// TODO: Adjust this as needed but this current setting should be good enough for most pages
const MAX_CHARS = 16_000;

async function fetchPage(url) {
  const base = (process.env.CRAWL4AI_URL || "http://localhost:11235").replace(/\/$/, "");

  const headers = { "content-type": "application/json" };
  const token = process.env.CRAWL4AI_API_TOKEN?.trim();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${base}/crawl`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      urls: [url],
      crawler_config: {
        type: "CrawlerRunConfig",
        params: {
          word_count_threshold: 10,
          remove_overlay_elements: true,
          // PruningContentFilter populates fit_markdown with body-only content,
          // stripping navigation, footers, and boilerplate.
          markdown_generator: {
            type: "DefaultMarkdownGenerator",
            params: {
              content_filter: {
                type: "PruningContentFilter",
                params: { threshold: 0.48, threshold_type: "fixed", min_word_threshold: 0 },
              },
            },
          },
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Crawl4AI request failed (${res.status}): ${res.statusText}`);
  }

  const data = await res.json();

  // Crawl4AI returns results synchronously: { success, results: [{...}] }
  const result = data.results?.[0];
  if (!data.success || !result) {
    return `Crawl4AI: could not read page at ${url}`;
  }

  // Prefer fit_markdown (content-focused) over raw_markdown (includes nav/footer noise)
  const md = result.markdown;
  const content = (
    (typeof md === "object" ? md.fit_markdown || md.raw_markdown : md) || ""
  ).trim();

  if (!content) return `Page fetched but contained no readable text: ${url}`;

  const truncated =
    content.length > MAX_CHARS
      ? content.slice(0, MAX_CHARS) + `\n\n[content truncated at ${MAX_CHARS} chars]`
      : content;

  return [`[Page: ${result.title ?? url}]`, `URL: ${url}`, ``, truncated].join("\n");
}

// LangChain version — used by the CLI
export const crawlTool = new DynamicTool({
  name: "fetch_page",
  description: DESCRIPTION,
  func: fetchPage,
});

// Vercel AI SDK version — used by the web app
export const crawlToolAiSdk = tool({
  description: DESCRIPTION,
  inputSchema: z.object({
    url: z.string().url().describe("The full URL of the page to fetch and read"),
  }),
  execute: ({ url }) => fetchPage(url),
});