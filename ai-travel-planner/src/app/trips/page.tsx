"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type TripRow = {
  id: string;
  title: string | null;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export default function TripsPage() {
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        setEmail(session?.user?.email ?? null);
        if (!session) {
          setTrips([]);
          setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from("trips")
          .select("id, title, destination, start_date, end_date, created_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setTrips(data as TripRow[]);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-semibold">我的行程</h1>
        {loading && <p className="text-sm text-gray-600">加载中...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !email && (
          <p className="text-sm text-gray-600">
            请先<Link className="text-blue-600 hover:underline px-1" href="/auth/sign-in">登录</Link>以查看你的行程。
          </p>
        )}
        {!loading && email && trips && trips.length === 0 && (
          <p className="text-sm text-gray-600">还没有保存的行程，快去首页生成一个吧。</p>
        )}
        <ul className="grid gap-4 sm:grid-cols-2">
          {trips?.map((t) => (
            <li key={t.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-medium">{t.title ?? `${t.destination ?? "行程"}`}</h2>
                <Link href={`/trips/${t.id}`} className="text-blue-600 hover:underline">
                  查看详情
                </Link>
              </div>
              <p className="text-sm text-gray-600">目的地：{t.destination ?? "-"}</p>
              <p className="text-sm text-gray-600">
                日期：{t.start_date ?? "?"} - {t.end_date ?? "?"}
              </p>
              <p className="text-xs text-gray-400 mt-1">创建于 {new Date(t.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
