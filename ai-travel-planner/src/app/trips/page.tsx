"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";

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
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>我的行程</Typography>
      {loading && <Typography variant="body2" color="text.secondary">加载中...</Typography>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!loading && !email && (
        <Typography variant="body2" color="text.secondary">
          请先
          <Button component={Link} href="/auth/sign-in" variant="text" sx={{ px: 0, minWidth: 0 }}>登录</Button>
          以查看你的行程。
        </Typography>
      )}
      {!loading && email && trips && trips.length === 0 && (
        <Typography variant="body2" color="text.secondary">还没有保存的行程，快去首页生成一个吧。</Typography>
      )}
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none", display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
        {trips?.map((t) => (
          <Box component="li" key={t.id}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>{t.title ?? `${t.destination ?? "行程"}`}</Typography>
                  <Button component={Link} href={`/trips/${t.id}`} variant="text">查看详情</Button>
                </Box>
                <Typography variant="body2" color="text.secondary">目的地：{t.destination ?? "-"}</Typography>
                <Typography variant="body2" color="text.secondary">日期：{t.start_date ?? "?"} - {t.end_date ?? "?"}</Typography>
                <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>创建于 {new Date(t.created_at).toLocaleString()}</Typography>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>
    </Container>
  );
}
