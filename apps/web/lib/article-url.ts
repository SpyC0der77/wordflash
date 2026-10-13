/** Accept pasted browser addresses while rejecting non-web links before loading. */
export function normalizeArticleUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter an article link to read.");
  const candidate = trimmed.startsWith("//") ? `https:${trimmed}`
    : /^[^\s/?#:@]+[.\u3002\uff0e\uff61][^\s/?#:@]+(?::\d+)?(?:[/?#]|$)/u.test(trimmed) ? `https://${trimmed}` : trimmed;
  let url: URL;
  try { url = new URL(candidate); }
  catch { throw new Error("Enter a website address, such as example.com/article."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Use an http or https article link without login details.");
  return url.href;
}
