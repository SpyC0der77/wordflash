import {
  parseProperNounGazetteer,
  PROPER_NOUN_GAZETTEER_VERSION,
} from "@wordflash/core";

export const PROPER_NOUN_GAZETTEER_URL = "/proper-nouns.json";
export const PROPER_NOUN_GAZETTEER_TIMEOUT_MS = 600;
const STORAGE_KEY = `wordflash.proper-nouns.v${PROPER_NOUN_GAZETTEER_VERSION}`;

type GazetteerListener = (gazetteer: ReadonlySet<string> | null) => void;

let memoryCache: Set<string> | null = null;
let inFlight: Promise<Set<string> | null> | null = null;
const listeners = new Set<GazetteerListener>();

export function peekProperNounGazetteer(): ReadonlySet<string> | null {
  return memoryCache;
}

export function subscribeProperNounGazetteer(
  listener: GazetteerListener,
): () => void {
  listeners.add(listener);
  if (memoryCache) listener(memoryCache);
  return () => {
    listeners.delete(listener);
  };
}

function notify(gazetteer: Set<string> | null) {
  for (const listener of listeners) listener(gazetteer);
}

function readStoredGazetteer(): Set<string> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseProperNounGazetteer(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeStoredGazetteer(payload: unknown, gazetteer: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or private mode. Memory cache still works for this session.
  }
  memoryCache = gazetteer;
  notify(gazetteer);
}

async function fetchGazetteer(
  url: string,
  fetchImpl: typeof fetch,
): Promise<Set<string> | null> {
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    const gazetteer = parseProperNounGazetteer(payload);
    if (gazetteer.size === 0) return null;
    writeStoredGazetteer(payload, gazetteer);
    return gazetteer;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function loadProperNounGazetteer(options?: {
  url?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}): Promise<ReadonlySet<string> | null> {
  if (memoryCache) return memoryCache;

  const stored = readStoredGazetteer();
  if (stored && stored.size > 0) {
    memoryCache = stored;
    notify(stored);
    if (!inFlight) {
      inFlight = fetchGazetteer(
        options?.url ?? PROPER_NOUN_GAZETTEER_URL,
        options?.fetch ?? fetch,
      ).finally(() => {
        inFlight = null;
      });
    }
    return stored;
  }

  const url = options?.url ?? PROPER_NOUN_GAZETTEER_URL;
  const timeoutMs = options?.timeoutMs ?? PROPER_NOUN_GAZETTEER_TIMEOUT_MS;
  const fetchImpl = options?.fetch ?? fetch;

  if (!inFlight) {
    inFlight = fetchGazetteer(url, fetchImpl).finally(() => {
      inFlight = null;
    });
  }

  const fetched = await Promise.race([
    inFlight,
    sleep(timeoutMs).then(() => "timeout" as const),
  ]);
  if (fetched === "timeout") return memoryCache;
  return fetched;
}

/** Test-only: clear in-memory fetch state. */
export function resetProperNounGazetteerForTests() {
  memoryCache = null;
  inFlight = null;
}
