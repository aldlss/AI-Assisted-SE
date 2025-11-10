import { NextResponse } from "next/server";

// 占位实现：仅回显一个固定文本，后续接入阿里云百炼 ASR
export async function POST() {
  return NextResponse.json({ text: "（占位）语音识别结果" });
}
