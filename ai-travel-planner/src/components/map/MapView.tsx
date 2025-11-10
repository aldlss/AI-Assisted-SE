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
  const ref = useRef<HTMLDivElement | null>(null);
  const markersKey = JSON.stringify(markers);
  const polylineKey = JSON.stringify(polyline);

  useEffect(() => {
    type AMapMarker = { setMap?: (m: unknown) => void };
    type AMapPolyline = { setMap?: (m: unknown) => void };
    type AMapMap = {
      add: (arr: unknown[]) => void;
      setFitView: (arr: unknown[]) => void;
      destroy?: () => void;
    };
    type AMapNS = {
      Map: new (
        el: HTMLElement,
        opts: { viewMode?: string; zoom?: number; center?: [number, number] }
      ) => AMapMap;
      Marker: new (opts: { position: [number, number]; title?: string }) => AMapMarker;
      Polyline: new (opts: { path: [number, number][]; strokeColor?: string; strokeWeight?: number; showDir?: boolean }) => AMapPolyline;
    };

    let map: AMapMap | undefined;
    let markerInstances: AMapMarker[] = [];
    let lineInstance: AMapPolyline | undefined;
    loadAMap()
      .then(() => {
        if (!ref.current) return;
        const AMapNs = (window as unknown as { AMap: AMapNS }).AMap;
        map = new AMapNs.Map(ref.current, {
          viewMode: "3D",
          zoom,
          center: center ? [center.lng, center.lat] : undefined,
        });
        if (markers.length) {
          markerInstances = markers.map((m) =>
            new AMapNs.Marker({ position: [m.lng, m.lat], title: m.title })
          );
          map.add(markerInstances as unknown as unknown[]);
          map.setFitView(markerInstances as unknown as unknown[]);
        }
        if (polyline && polyline.path.length > 0) {
          const path: [number, number][] = polyline.path.map(p => [p.lng, p.lat]);
          lineInstance = new AMapNs.Polyline({ path, strokeColor: "#1976d2", strokeWeight: 5, showDir: true });
          map.add([lineInstance] as unknown as unknown[]);
          map.setFitView([lineInstance] as unknown as unknown[]);
        }
      })
      .catch((e) => {
        console.error("AMap 加载失败", e);
      });
    return () => {
      try {
        markerInstances.forEach((mk) => mk.setMap && mk.setMap(null));
        if (lineInstance && lineInstance.setMap) lineInstance.setMap(null);
        if (map && map.destroy) map.destroy();
      } catch {}
    };
  }, [center, zoom, markers, polyline, markersKey, polylineKey]);

  return <div ref={ref} className={className} />;
}
