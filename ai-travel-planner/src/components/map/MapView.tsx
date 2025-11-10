"use client";
import { useEffect, useRef } from "react";
import { loadAMap } from "@/lib/map/loader";

type MarkerLike = { lng: number; lat: number; title?: string };

type Props = {
  className?: string;
  center?: { lng: number; lat: number };
  zoom?: number;
  markers?: MarkerLike[];
};

// 简易地图组件：加载 AMap 并渲染 markers（占位实现，后续可扩展路线渲染）
export function MapView({ className = "h-80 w-full", center, zoom = 11, markers = [] }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    type AMapMarker = { setMap?: (m: unknown) => void };
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
    };

    let map: AMapMap | undefined;
    let markerInstances: AMapMarker[] = [];
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
      })
      .catch((e) => {
        console.error("AMap 加载失败", e);
      });
    return () => {
      try {
        markerInstances.forEach((mk) => mk.setMap && mk.setMap(null));
        if (map && map.destroy) map.destroy();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className={className} />;
}
