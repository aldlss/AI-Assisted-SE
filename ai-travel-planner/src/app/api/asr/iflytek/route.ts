import crypto from "node:crypto";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import WebSocket from "ws";

export const runtime = "nodejs";

function toBase64(buf: ArrayBuffer | Uint8Array<ArrayBufferLike>) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Buffer.from(b).toString("base64");
}

function stripWavHeaderIfAny<T extends ArrayBufferLike>(bytes: Uint8Array<T>): Uint8Array<T> {
  // Very naive WAV header check: starts with 'RIFF' and contains 'WAVE' at 8..12
  if (bytes.length > 44 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
    return bytes.subarray(44);
  }
  return bytes;
}

export async function POST(req: Request) {
  try {
    // 先校验登录（防止未登录滥用云端 ASR）
    try {
      const supabase = await createSupabaseRouteHandlerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "未登录，无法使用语音识别" }), { status: 401 });
      }
    } catch {
      // 忽略内部错误，继续后续统一错误处理
    }
    const appId = process.env.IFLYTEK_APPID?.trim();
    const apiKey = process.env.IFLYTEK_API_KEY?.trim();
    if (!appId || !apiKey) {
      return new Response(JSON.stringify({ error: "Server ASR is not configured (missing IFLYTEK_APPID/IFLYTEK_API_KEY)" }), { status: 500 });
    }

  const arrayBuffer = await req.arrayBuffer();
  let bytes = new Uint8Array(arrayBuffer);
    // Accept WAV or raw PCM16; if WAV, strip 44B header
    bytes = stripWavHeaderIfAny(bytes);

    const audioBase64 = toBase64(bytes);
    // 优先尝试 WebAPI v2 (WebSocket)。失败则回退 v1 HTTP。
    const tryV2 = async (): Promise<string | null> => {
      const apiSecret = process.env.IFLYTEK_API_SECRET?.trim();
      if (!apiSecret) return null; // 无 secret 不走 v2
      return new Promise((resolve) => {
        let resolved = false;
        const host = "iat-api.xfyun.cn";
        const path = "/v2/iat";
        const date = new Date().toUTCString();
        const requestLine = `GET ${path} HTTP/1.1`;
        const signatureOrigin = `host: ${host}\ndate: ${date}\n${requestLine}`;
        const signatureSha = crypto.createHmac("sha256", apiSecret).update(signatureOrigin).digest("base64");
        const authorization = `api_key=\"${apiKey}\", algorithm=\"hmac-sha256\", headers=\"host date request-line\", signature=\"${signatureSha}\"`;
        const query = new URLSearchParams({ authorization: Buffer.from(authorization).toString("base64"), date, host }).toString();
        const wsUrl = `wss://${host}${path}?${query}`;
        const ws = new WebSocket(wsUrl);
        let finalText = "";
        ws.on("open", () => {
          const frame = {
            common: { app_id: appId },
            business: { language: "zh_cn", domain: "iat", accent: "mandarin", vad_eos: 5000 },
            data: { status: 2, format: "audio/L16;rate=16000", encoding: "raw", audio: audioBase64 },
          };
          ws.send(JSON.stringify(frame));
        });
        ws.on("message", (raw: unknown) => {
          try {
            let textPayload = "";
            if (typeof raw === "string") textPayload = raw;
            else if (raw instanceof Buffer) textPayload = raw.toString();
            else textPayload = String(raw);
            const msg = JSON.parse(textPayload);
            if (msg.code !== 0) {
              if (!resolved) { resolved = true; resolve(null); }
              ws.close();
              return;
            }
            const wsArr = msg?.data?.result?.ws as Array<{ cw: Array<{ w: string }> }> | undefined;
            if (Array.isArray(wsArr)) {
              finalText += wsArr.map(seg => seg.cw?.[0]?.w || "").join("");
            }
            if (msg.data?.status === 2) { // 结束
              if (!resolved) { resolved = true; resolve(finalText); }
              ws.close();
            }
          } catch {
            // 忽略解析错误
          }
        });
        ws.on("error", () => {
          if (!resolved) { resolved = true; resolve(null); }
        });
        ws.on("close", () => {
          if (!resolved) { resolved = true; resolve(finalText || null); }
        });
        // 超时保护
        setTimeout(() => {
          if (!resolved) { resolved = true; resolve(null); ws.close(); }
        }, 12000);
      });
    };

    const v2Result = await tryV2();
    if (v2Result !== null) {
      return new Response(JSON.stringify({ text: v2Result }), { headers: { "Content-Type": "application/json" } });
    }
    // 回退 v1 HTTP
    const curTime = Math.floor(Date.now() / 1000).toString();
    const paramObj = { engine_type: "sms16k", aue: "raw", sample_rate: "16000" } as const;
    const xParam = Buffer.from(JSON.stringify(paramObj)).toString("base64");
    const checksum = crypto.createHash("md5").update(apiKey + curTime + xParam).digest("hex");
    const resp = await fetch("https://api.xfyun.cn/v1/service/v1/iat", {
      method: "POST",
      headers: { "X-Appid": appId, "X-CurTime": curTime, "X-Param": xParam, "X-CheckSum": checksum, "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      body: `audio=${encodeURIComponent(audioBase64)}`,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const desc = (data?.desc as string | undefined) || resp.statusText || "iFlytek request failed";
      const hint = /illegal access|no appid/i.test(desc) ? "讯飞返回：缺少或无效的 AppId。请确认使用 WebAPI 应用的 AppID/APIKey/APISecret（若走 v2），并重启服务。" : undefined;
      return new Response(JSON.stringify({ error: desc, hint, detail: data }), { status: 502 });
    }
    if (data.code !== "0" && data.code !== 0) {
      const desc = (data?.desc as string | undefined) || "ASR failed";
      const hint = /illegal access|no appid/i.test(desc) ? "讯飞返回：缺少或无效的 AppId。请确认使用 WebAPI 应用的 AppID/APIKey/APISecret（若走 v2），并重启服务。" : undefined;
      return new Response(JSON.stringify({ error: desc, detail: data, hint }), { status: 502 });
    }
    const text = typeof data.data === "string" ? data.data : (data?.data?.result || "");
    return new Response(JSON.stringify({ text }), { headers: { "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}
