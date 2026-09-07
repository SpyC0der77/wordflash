import { NextRequest, NextResponse } from "next/server";
import { extractArticle } from "@/lib/extract-article";

export async function POST(request: NextRequest) {
  let url: unknown;
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }
  const result = await extractArticle(url);
  return NextResponse.json(result.body, { status: result.status });
}
