"use client";

import { useEffect, useState } from "react";
import {
  loadProperNounGazetteer,
  peekProperNounGazetteer,
  subscribeProperNounGazetteer,
} from "@/lib/proper-noun-gazetteer";

export function useProperNounGazetteer(): ReadonlySet<string> | null {
  const [gazetteer, setGazetteer] = useState<ReadonlySet<string> | null>(
    peekProperNounGazetteer,
  );

  useEffect(() => {
    const unsubscribe = subscribeProperNounGazetteer(setGazetteer);
    void loadProperNounGazetteer();
    return unsubscribe;
  }, []);

  return gazetteer;
}
