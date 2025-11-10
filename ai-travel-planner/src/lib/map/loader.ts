"use client";
// 统一封装高德地图 JS API 的加载逻辑
// 说明：
// - JS API 的 key 必须在浏览器中使用，无法完全隐藏；建议配合“Referer 白名单”和安全码（securityJsCode）一起使用。
// - 服务端调用高德 Web Service（路线、地理编码等）应使用 AMAP_REST_KEY，并通过服务器路由代理，避免在前端暴露。

import AMapLoader from "@amap/amap-jsapi-loader";

declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode?: string };
  }
}

let loaderPromise: Promise<unknown> | null = null;

export function loadAMap() {
  if (!loaderPromise) {
    // 优先从环境变量读取浏览器 Key；若无，则尝试从设置页写入的 localStorage 读取（开发便捷）。
    const publicKey =
      process.env.NEXT_PUBLIC_AMAP_KEY ||
      (typeof window !== "undefined" ? localStorage.getItem("amap_key") || "" : "");
    const securityJsCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE || "";

    if (securityJsCode && typeof window !== "undefined") {
      // 参考高德文档：需在加载 JS SDK 之前设置
      window._AMapSecurityConfig = { securityJsCode };
    }

    loaderPromise = AMapLoader.load({
      key: publicKey,
      version: "2.0",
      plugins: [], // 按需再添加，例如 "AMap.Scale"
    });
  }
  return loaderPromise;
}
