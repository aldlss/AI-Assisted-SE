"use client";
import * as React from "react";
import createCache, { EmotionCache } from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { useServerInsertedHTML } from "next/navigation";

// 基于 MUI 官方 next-app-router Emotion SSR 示例
export function EmotionCacheProvider({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = React.useState(() => {
  const cache: EmotionCache & { inserted: Record<string, string | true | undefined> } = createCache({ key: "css", prepend: true });
    cache.compat = true;
    const prevInsert = cache.insert;
    let insertedArr: string[] = [];
    cache.insert = (
      selector: string,
      serialized: { name: string; styles: string },
      sheet: unknown,
      shouldInsert: boolean,
    ) => {
      if (cache.inserted[serialized.name] === undefined) {
        insertedArr.push(serialized.name);
      }
      return (prevInsert as unknown as (
        s: string,
        ser: { name: string; styles: string },
        sh: unknown,
        si: boolean,
      ) => void)(selector, serialized, sheet, shouldInsert);
    };
    const flush = () => {
      const prev = insertedArr;
      insertedArr = [];
      return prev;
    };
    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;
    let styles = "";
    for (const name of names) {
      const val = cache.inserted[name];
      if (typeof val === "string") styles += val;
    }
    return (
      <style
        data-emotion={`${cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
