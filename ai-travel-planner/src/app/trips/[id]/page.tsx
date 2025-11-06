export default function TripDetailPage({ params }: { params: { id: string } }) {
  // 详情页占位：后续将展示每日行程与地图
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="mb-4 text-2xl font-semibold">行程详情</h1>
        <p className="text-sm text-gray-600">ID：{params.id}</p>
        <p className="mt-2 text-sm text-gray-600">详细页正在建设中，稍后将展示每日行程、地点与地图。</p>
      </div>
    </div>
  );
}
