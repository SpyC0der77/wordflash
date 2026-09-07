import { onRequest } from "firebase-functions/v2/https";
import { extractArticle } from "../../apps/web/lib/extract-article";

export const extract = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "512MiB",
    invoker: "public",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const result = await extractArticle(req.body?.url);
    res.status(result.status).json(result.body);
  },
);
