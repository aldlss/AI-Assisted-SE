"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isUuidV4 } from "@/lib/uuid";
// MUI 组件引入增强 Material Design 风格
import { Box, Paper, Typography, Divider, TextField, Button as MUIButton, Chip, LinearProgress, MenuItem } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";

const MapView = dynamic(() => import("@/components/map/MapView").then((m) => m.MapView), { ssr: false });

// Lightweight row types matching our Supabase tables
type TripRow = {
    id: string;
    title: string | null;
    destination: string | null;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    budget_total: number | null;
};

type ItineraryRow = {
  id: string;
  trip_id: string;
  day_index: number;
  note: string | null;
};

type ItemRow = {
  id: string;
  itinerary_id: string;
  type: string | null;
  name: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  start_time: string | null;
  end_time: string | null;
  estimated_cost: number | null;
  transport_mode: string | null;
};

export default function TripDetailClient({ id }: { id: string }) {
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [days, setDays] = useState<ItineraryRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
    const [budgetEdit, setBudgetEdit] = useState<string>("");
  const [savingBudget, setSavingBudget] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [expenseForm, setExpenseForm] = useState<{
      amount: string;
      category: string;
      note: string;
  }>({
      amount: "",
      category: "other",
      note: "",
  });
  const [savingExpense, setSavingExpense] = useState(false);

  type ExpenseRow = {
      id: string;
      trip_id: string;
      item_id: string | null;
      category: string | null;
      amount: number | null;
      occurred_at: string | null;
      note: string | null;
  };

  useEffect(() => {
    // 服务器已经校验过 UUID；这里的校验只作为双保险（理论上不会触发 notFound 之后的渲染）
    if (!isUuidV4(id)) {
      setError("无效的行程 ID");
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    (async () => {
      try {
        setLoading(true);
        // Trip
        const { data: tripData, error: e1 } = await supabase
            .from("trips")
            .select(
                "id,title,destination,start_date,end_date,created_at,budget_total"
            )
            .eq("id", id)
            .single();
        if (e1) throw e1;
        setTrip(tripData as TripRow);
        if (tripData?.budget_total != null)
            setBudgetEdit(String(tripData.budget_total));

        // Itineraries
        const { data: its, error: e2 } = await supabase
            .from("itineraries")
            .select("id,trip_id,day_index,note")
            .eq("trip_id", id)
            .order("day_index", { ascending: true });
        if (e2) throw e2;
        const itsList = (its ?? []) as ItineraryRow[];
        setDays(itsList);

        // Items
        if (itsList.length > 0) {
            const ids = itsList.map((i) => i.id);
            const { data: itemsData, error: e3 } = await supabase
                .from("itinerary_items")
                .select(
                    "id,itinerary_id,type,name,description,lat,lng,start_time,end_time,estimated_cost,transport_mode"
                )
                .in("itinerary_id", ids);
            if (e3) throw e3;
            setItems((itemsData ?? []) as ItemRow[]);
        }

        // expenses
        const { data: expData, error: e4 } = await supabase
            .from("expenses")
            .select("id,trip_id,item_id,category,amount,occurred_at,note")
            .eq("trip_id", id)
            .order("occurred_at", { ascending: false });
        if (e4) throw e4;
        setExpenses((expData ?? []) as ExpenseRow[]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const markers = useMemo(() => {
    return items
      .filter((it) => typeof it.lat === "number" && typeof it.lng === "number")
      .map((it) => ({ lat: it.lat as number, lng: it.lng as number, title: it.name ?? undefined }));
  }, [items]);

  const itemsByItinerary = useMemo(() => {
    const map = new Map<string, ItemRow[]>();
    for (const it of items) {
      const arr = map.get(it.itinerary_id) || [];
      arr.push(it);
      map.set(it.itinerary_id, arr);
    }
    return map;
  }, [items]);

  const estimatedTotal = useMemo(() => {
      return items.reduce(
          (sum, it) =>
              sum +
              (typeof it.estimated_cost === "number" ? it.estimated_cost : 0),
          0
      );
  }, [items]);

  const expenseSum = useMemo(() => {
      return expenses.reduce(
          (s, e) => s + (typeof e.amount === "number" ? e.amount : 0),
          0
      );
  }, [expenses]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      const key = (e.category || "other").toLowerCase();
      const v = typeof e.amount === "number" ? e.amount : 0;
      map.set(key, (map.get(key) || 0) + v);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

    async function saveBudget() {
      if (!trip) return;
      const value = Number(budgetEdit.trim());
      if (!Number.isFinite(value) || value < 0) return;
      setSavingBudget(true);
      try {
          const res = await fetch(`/api/budget?tripId=${trip.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  tripId: trip.id,
                  amount_total: value,
                  currency: "CNY",
              }),
          });
          if (!res.ok) throw new Error("保存预算失败");
          setTrip((t) => (t ? { ...t, budget_total: value } : t));
      } catch (e) {
          console.error(e);
      } finally {
          setSavingBudget(false);
      }
  }

    async function addExpense() {
      if (!trip) return;
      const amountNum = Number(expenseForm.amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) return;
      setSavingExpense(true);
      try {
          const res = await fetch(`/api/expenses`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  trip_id: trip.id,
                  category: expenseForm.category || "other",
                  amount: amountNum,
                  note: expenseForm.note || null,
              }),
          });
          if (!res.ok) throw new Error("添加支出失败");
          const created = await res.json();
          setExpenses((prev) => [created, ...prev]);
          setExpenseForm({ amount: "", category: "other", note: "" });
      } catch (e) {
          console.error(e);
      } finally {
          setSavingExpense(false);
      }
  }

  const transportLabel = (mode: string | null | undefined): string | null => {
    if (!mode) return null;
    const m = mode.toLowerCase();
    if (m === "drive") return "驾车";
    if (m === "walk") return "步行";
    if (m === "transit") return "公共交通";
    return mode; // 兜底显示原值
  };

  const typeLabel = (type: string | null | undefined): string => {
    switch (type) {
      case "sight":
        return "景点";
      case "food":
        return "美食";
      case "hotel":
        return "酒店";
      case "transport":
        return "交通";
      default:
        return type ?? "条目";
    }
  };

  return (
    <Box>
      <Paper elevation={0} sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={600} gutterBottom>
          {trip?.title ?? "行程详情"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          目的地：{trip?.destination ?? "-"} ｜ 日期：{trip?.start_date ?? "?"} ~ {trip?.end_date ?? "?"}
        </Typography>
      </Paper>

      {/* 顶部栅格：预算 + 支出 + 地图 */}
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, mb: 4 }}>
        <Box>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>预算概览</Typography>
            {typeof trip?.budget_total === "number" ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: 14 }}>
                <Typography variant="body2">总预算：¥{trip!.budget_total!.toFixed(0)}</Typography>
                <Typography variant="body2">当前估算花费：¥{estimatedTotal.toFixed(0)}</Typography>
                <Typography variant="body2">真实支出：¥{expenseSum.toFixed(0)}</Typography>
                <Typography variant="body2">
                  相对预算结余：
                  <Box component="span" sx={{ color: trip!.budget_total! - expenseSum < 0 ? 'error.main' : 'success.main' }}>
                    ¥{(trip!.budget_total! - expenseSum).toFixed(0)}
                  </Box>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  实际-估算差额：{(expenseSum - estimatedTotal) >= 0 ? '+' : ''}¥{(expenseSum - estimatedTotal).toFixed(0)}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary">估算占比</Typography>
                <LinearProgress variant="determinate" value={Math.min(100, (estimatedTotal / (trip!.budget_total! || 1)) * 100)} />
                <Typography variant="caption" color="text.secondary">实际占比</Typography>
                <LinearProgress variant="determinate" value={Math.min(100, (expenseSum / (trip!.budget_total! || 1)) * 100)} />
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">未设置总预算。当前估算花费：¥{estimatedTotal.toFixed(0)}</Typography>
            )}
            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField size="small" label="总预算" placeholder="数字" value={budgetEdit} onChange={(e) => setBudgetEdit(e.target.value)} sx={{ flexGrow: 1 }} />
              <MUIButton size="small" variant="contained" startIcon={<SaveIcon />} onClick={saveBudget} disabled={savingBudget}>
                {savingBudget ? '保存中' : '保存'}
              </MUIButton>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              说明：总预算用于衡量花费控制；“当前估算”来自行程项的预估费用。“真实支出”记录实际发生的金额，可与估算对比。
            </Typography>
          </Paper>
  </Box>
  <Box>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="h6" gutterBottom>支出记录</Typography>
            {expenseByCategory.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {expenseByCategory.map(([cat, sum]) => (
                  <Chip key={cat} size="small" label={`${cat} ¥${sum.toFixed(0)}`} />
                ))}
              </Box>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <TextField size="small" label="金额" value={expenseForm.amount} onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))} />
              <TextField size="small" select label="类别" value={expenseForm.category} onChange={(e) => setExpenseForm(f => ({ ...f, category: e.target.value }))}>
                <MenuItem value="food">美食</MenuItem>
                <MenuItem value="transport">交通</MenuItem>
                <MenuItem value="hotel">住宿</MenuItem>
                <MenuItem value="sight">门票/景点</MenuItem>
                <MenuItem value="shopping">购物</MenuItem>
                <MenuItem value="other">其他</MenuItem>
              </TextField>
              <TextField size="small" label="备注" value={expenseForm.note} onChange={(e) => setExpenseForm(f => ({ ...f, note: e.target.value }))} />
              <MUIButton size="small" variant="contained" startIcon={<AddIcon />} onClick={addExpense} disabled={savingExpense}>{savingExpense ? '提交中' : '添加支出'}</MUIButton>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.secondary">
              已记录支出合计：¥{expenseSum.toFixed(0)} {typeof trip?.budget_total === 'number' && trip.budget_total > 0 && (
                <>
                  （占总预算 {(expenseSum / trip.budget_total * 100).toFixed(1)}% ，差额 ¥{(trip.budget_total - expenseSum).toFixed(0)}）
                </>
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              与估算相比：{(expenseSum - estimatedTotal) >= 0 ? '超出' : '低于'} ¥{Math.abs(expenseSum - estimatedTotal).toFixed(0)}
            </Typography>
            <Box sx={{ maxHeight: 180, overflowY: 'auto', mt: 1, pr: 1 }}>
              {expenses.length === 0 && <Typography variant="body2" color="text.secondary">暂无记录</Typography>}
              {expenses.map(ex => (
                <Paper key={ex.id} variant="outlined" sx={{ p: 1, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>¥{ex.amount?.toFixed(2)} <Chip size="small" label={ex.category || 'other'} sx={{ ml: 0.5 }} /></Typography>
                    {ex.note && <Typography variant="caption" color="text.secondary">{ex.note}</Typography>}
                  </Box>
                  <Typography variant="caption" color="text.disabled">{ex.occurred_at?.slice(0,16).replace('T',' ')}</Typography>
                </Paper>
              ))}
            </Box>
          </Paper>
  </Box>
  <Box>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>地图总览</Typography>
            {markers.length === 0 ? (
              <Typography variant="body2" color="text.secondary">暂无可定位的地点</Typography>
            ) : (
              <MapView className="h-64 w-full rounded-md" markers={markers} />
            )}
          </Paper>
        </Box>
      </Box>

      {/* 行程分日详情 */}
      <Box>
        {loading && <Typography variant="body2" color="text.secondary">加载中...</Typography>}
        {error && <Typography variant="body2" color="error.main">{error}</Typography>}
        {!loading && !error && days.map(d => {
                      const list = (itemsByItinerary.get(d.id) ?? []).slice();
                      // 让景点优先，其余保持原有顺序稳定（稳定排序的简易实现）
                      list.sort((a, b) => {
                          const aSight = a.type === "sight";
                          const bSight = b.type === "sight";
                          if (aSight === bSight) return 0;
                          return aSight ? -1 : 1;
                      });
                      const dayMarkers = list
                          .filter(
                              (it) =>
                                  typeof it.lat === "number" &&
                                  typeof it.lng === "number"
                          )
                          .map((it) => ({
                              lat: it.lat as number,
                              lng: it.lng as number,
                              title: it.name ?? undefined,
                          }));
                      return (
                        <Paper key={d.id} variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                          <Typography variant="h6" gutterBottom>第 {d.day_index} 天 {d.note ? `· ${d.note}` : ''}</Typography>
                          {dayMarkers.length > 0 && <MapView className="h-56 w-full rounded-md" markers={dayMarkers} />}
                          <Divider sx={{ my: 1.5 }} />
                          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                            {list.map(it => (
                              <Box key={it.id}>
                                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: '100%' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <Chip size="small" label={typeLabel(it.type)} color="primary" />
                                    <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>{it.name ?? '-'}</Typography>
                                  </Box>
                                  {it.description && <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{it.description}</Typography>}
                                  <Typography variant="caption" color="text.secondary">
                                    {it.start_time || it.end_time ? `时间：${it.start_time ?? '?'} ~ ${it.end_time ?? '?'} ｜ ` : ''}
                                    {typeof it.estimated_cost === 'number' ? `预算：¥${it.estimated_cost}` : '预算：—'}
                                    {transportLabel(it.transport_mode) ? ` ｜ 交通：${transportLabel(it.transport_mode)}` : ''}
                                  </Typography>
                                </Paper>
                              </Box>
                            ))}
                          </Box>
                        </Paper>
                      );
                  })}
      </Box>
    </Box>
  );
}
