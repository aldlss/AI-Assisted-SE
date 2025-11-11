"use client";
import { useEffect, useRef, useState } from "react";
import { loadAMap } from "@/lib/map/loader";

type MarkerLike = { lng: number; lat: number; title?: string };
type PolylineLike = { path: { lng: number; lat: number }[] };

type Props = {
  className?: string;
  center?: { lng: number; lat: number };
  zoom?: number;
  markers?: MarkerLike[];
  polyline?: PolylineLike | null;
  /** 是否在首次渲染后自动根据标记/折线调整视图，默认为 true */
  autoFit?: boolean;
  /** 当存在标记或折线时覆盖默认缩放级别（适用于单标点更细节展示） */
  singleMarkerZoom?: number;
};

// 简易地图组件：加载 AMap 并渲染 markers / polyline
export function MapView({ className = "h-80 w-full", center, zoom = 11, markers = [], polyline = null, autoFit = true, singleMarkerZoom = 13 }: Props) {
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
  const [ready, setReady] = useState(false);

  // 根据传入标记点推导一个初始中心（优先使用 props.center）
  const hasMarkers = !!(markers && markers.length);
  const hasPolyline = !!(polyline && polyline.path.length);
  const initialCenter: [number, number] | undefined =
    center ? [center.lng, center.lat] : (hasMarkers ? [markers[0].lng, markers[0].lat] : undefined);
  const initialZoom = center ? zoom : (hasMarkers && markers.length === 1 ? singleMarkerZoom : zoom);
  const fittedOnceRef = useRef(false);

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
          zoom: initialZoom,
          center: initialCenter,
        });
        setReady(true);
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

  // 更新标记点（不销毁地图）并在需要时自适应
  useEffect(() => {
  const map = mapRef.current;
  const AMapNs = AMapRef.current;
  if (!map || !AMapNs || !ready) return;
    try {
      // 清除旧标记
      markersRef.current.forEach((mk) => mk.setMap && mk.setMap(null));
      markersRef.current = [];
      if (markers && markers.length) {
        markersRef.current = markers.map((m) => new AMapNs.Marker({ position: [m.lng, m.lat], title: m.title }));
        map.add(markersRef.current as unknown as unknown[]);
        if (autoFit && !fittedOnceRef.current) {
          const elements: unknown[] = [];
          if (lineRef.current) elements.push(lineRef.current as unknown as unknown);
          if (markersRef.current.length) elements.push(...(markersRef.current as unknown as unknown[]));
          if (elements.length) {
            map.setFitView(elements);
            fittedOnceRef.current = true;
          }
        }
      }
    } catch {}
  }, [markers, autoFit, hasPolyline, ready]);

  // 更新折线（不销毁地图）并自适应
  useEffect(() => {
  const map = mapRef.current;
  const AMapNs = AMapRef.current;
  if (!map || !AMapNs || !ready) return;
    try {
      if (lineRef.current && lineRef.current.setMap) lineRef.current.setMap(null);
      lineRef.current = null;
      if (polyline && polyline.path.length) {
        const path: [number, number][] = polyline.path.map((p) => [p.lng, p.lat]);
        lineRef.current = new AMapNs.Polyline({ path, strokeColor: "#1976d2", strokeWeight: 5, showDir: true });
        map.add([lineRef.current] as unknown as unknown[]);
        if (autoFit) {
          const elements: unknown[] = [lineRef.current] as unknown as unknown[];
          if (markersRef.current.length) elements.push(...(markersRef.current as unknown as unknown[]));
          map.setFitView(elements);
          fittedOnceRef.current = true;
        }
      }
    } catch {}
  }, [polyline, autoFit, ready]);

  return <div ref={containerRef} className={className} />;
}
