"use client";
import { useEffect, useRef } from "react";
import { loadAMap } from "@/lib/map/loader";

type MarkerLike = { lng: number; lat: number; title?: string };
type PolylineLike = { path: { lng: number; lat: number }[] };

type Props = {
  className?: string;
  center?: { lng: number; lat: number };
  zoom?: number;
  markers?: MarkerLike[];
  polyline?: PolylineLike | null;
};

// 简易地图组件：加载 AMap 并渲染 markers / polyline
export function MapView({ className = "h-80 w-full", center, zoom = 11, markers = [], polyline = null }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  type AMapMarker = { setMap?: (m: unknown) => void };
  type AMapPolyline = { setMap?: (m: unknown) => void };
  type AMapMap = {
    add: (arr: unknown[]) => void;
    setFitView: (arr: unknown[]) => void;
    destroy?: () => void;
    setCenter?: (lnglat: [number, number]) => void;
    setZoom?: (z: number) => void;
  };
  type AMapNS = {
    Map: new (
      el: HTMLElement,
      opts: { viewMode?: string; zoom?: number; center?: [number, number] }
    ) => AMapMap;
    Marker: new (opts: { position: [number, number]; title?: string }) => AMapMarker;
    Polyline: new (opts: { path: [number, number][]; strokeColor?: string; strokeWeight?: number; showDir?: boolean }) => AMapPolyline;
  };
  const mapRef = useRef<AMapMap | null>(null);
  const AMapRef = useRef<AMapNS | null>(null);
  const markersRef = useRef<AMapMarker[]>([]);
  const lineRef = useRef<AMapPolyline | null>(null);

  // 初始化地图（仅一次）
  useEffect(() => {
    let disposed = false;
    loadAMap()
      .then(() => {
        if (disposed || !containerRef.current) return;
        const AMapNs = (window as unknown as { AMap: AMapNS }).AMap;
        AMapRef.current = AMapNs;
        mapRef.current = new AMapNs.Map(containerRef.current, {
          viewMode: "3D",
          zoom,
          center: center ? [center.lng, center.lat] : undefined,
        });
      })
      .catch((e) => console.error("AMap 加载失败", e));
    return () => {
      disposed = true;
      try {
        markersRef.current.forEach((mk) => mk.setMap && mk.setMap(null));
        if (lineRef.current && lineRef.current.setMap) lineRef.current.setMap(null);
        if (mapRef.current && mapRef.current.destroy) mapRef.current.destroy();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 更新中心/缩放（不重建地图）
  useEffect(() => {
    if (!mapRef.current) return;
    try {
      if (center && mapRef.current.setCenter) mapRef.current.setCenter([center.lng, center.lat]);
      if (zoom && mapRef.current.setZoom) mapRef.current.setZoom(zoom);
    } catch {}
  }, [center, zoom]);

  // 更新标记点（不销毁地图）
  useEffect(() => {
    const map = mapRef.current;
    const AMapNs = AMapRef.current;
    if (!map || !AMapNs) return;
    try {
      // 清除旧标记
      markersRef.current.forEach((mk) => mk.setMap && mk.setMap(null));
      markersRef.current = [];
      if (markers && markers.length) {
        markersRef.current = markers.map((m) => new AMapNs.Marker({ position: [m.lng, m.lat], title: m.title }));
        map.add(markersRef.current as unknown as unknown[]);
        map.setFitView(markersRef.current as unknown as unknown[]);
      }
    } catch {}
  }, [markers]);

  // 更新折线（不销毁地图）
  useEffect(() => {
    const map = mapRef.current;
    const AMapNs = AMapRef.current;
    if (!map || !AMapNs) return;
    try {
      if (lineRef.current && lineRef.current.setMap) lineRef.current.setMap(null);
      lineRef.current = null;
      if (polyline && polyline.path.length) {
        const path: [number, number][] = polyline.path.map((p) => [p.lng, p.lat]);
        lineRef.current = new AMapNs.Polyline({ path, strokeColor: "#1976d2", strokeWeight: 5, showDir: true });
        map.add([lineRef.current] as unknown as unknown[]);
        map.setFitView([lineRef.current] as unknown as unknown[]);
      }
    } catch {}
  }, [polyline]);

  return <div ref={containerRef} className={className} />;
}
