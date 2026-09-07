export const PROPER_NOUN_GAZETTEER_VERSION = 1;

export interface ProperNounGazetteerPayload {
  version?: number;
  names?: unknown;
}

export function parseProperNounGazetteer(data: unknown): Set<string> {
  let names: unknown[] | null = null;
  if (Array.isArray(data)) {
    names = data;
  } else if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as ProperNounGazetteerPayload).names)
  ) {
    names = (data as ProperNounGazetteerPayload).names as unknown[];
  }
  if (!names) throw new Error("Invalid proper noun gazetteer");

  const gazetteer = new Set<string>();
  for (const name of names) {
    if (typeof name !== "string") continue;
    const key = name.normalize("NFC").trim().toLowerCase();
    if (key.length >= 2) gazetteer.add(key);
  }
  return gazetteer;
}
