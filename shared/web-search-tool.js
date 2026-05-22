import { DynamicTool } from "@langchain/core/tools";
import { tool } from "ai";
import { z } from "zod";

const DESCRIPTION =
  "Search the web for current information. Use this for news, HBAR price data, Hedera ecosystem projects, account or contract lookups, documentation, or any topic requiring up-to-date data not available on-chain.";

async function searchSearxng(query) {
  const url = new URL("/search", process.env.SEARXNG_URL || "http://localhost:8080");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`SearXNG search failed: ${res.statusText}`);
  const data = await res.json();

  const results = (data.results ?? []).slice(0, 5);
  if (!results.length) return "No results found.";

  const formatted = results
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content ?? ""}`.trim())
    .join("\n\n");

  return [
    `[Search results — current year: ${new Date().getFullYear()}]`,
    `IMPORTANT: Base your response strictly on the sources below. Do not add, infer, or fabricate any information not explicitly present in these results. If the results do not contain enough information to answer the question, say so. Always cite the source URL(s) you drew from at the end of your response under a "Sources:" heading, formatting each link as an HTML anchor tag that opens in a new tab, like: <a href="URL" target="_blank" rel="noopener noreferrer">Title</a>`,
    ``,
    formatted,
  ].join("\n");
}

// LangChain version — used by the CLI (cli/index.js)
export const webSearchTool = new DynamicTool({
  name: "web_search",
  description: DESCRIPTION,
  func: searchSearxng,
});

// Vercel AI SDK version — used by the web app (web/src/features/chat-hedera/server/toolkit.js)
export const webSearchToolAiSdk = tool({
  description: DESCRIPTION,
  inputSchema: z.object({
    query: z.string().describe("The search query"),
  }),
  execute: ({ query }) => searchSearxng(query),
});