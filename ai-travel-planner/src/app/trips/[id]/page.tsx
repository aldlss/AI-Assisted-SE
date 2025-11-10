import TripDetailClient from "@/components/trips/trip-detail-client";
import { notFound } from "next/navigation";
import { isUuidV4 } from "@/lib/uuid";
import { use } from "react";

// Server Component: 使用 React.use() 解包 params Promise（Next.js 15+/React 19）
export default function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // 基于服务器的早期校验，避免无效 ID 触发客户端请求与 Postgres 22P02 错误
  if (!isUuidV4(id)) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <TripDetailClient id={id} />
      </div>
    </div>
  );
}
