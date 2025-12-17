"use client";

import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import type { GeoLocation } from "@/lib/geo/geolocation";

interface NodeGeoData {
  pubkey: string;
  status: "online" | "degraded" | "offline" | "unknown";
  geo: GeoLocation;
}

interface HeatmapLayerProps {
  nodes: NodeGeoData[];
}

export function HeatmapLayer({ nodes }: HeatmapLayerProps) {
  const map = useMap();
  const [heatLayer, setHeatLayer] = useState<any>(null);

  useEffect(() => {
    if (!map) return;

    let isMounted = true;

    const loadHeatmap = async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet.heat");

        if (!isMounted) return;

        // Remove existing heat layer
        if (heatLayer) {
          map.removeLayer(heatLayer);
        }

        // Create heatmap data: [lat, lng, intensity]
        const heatData = nodes
          .filter((n) => n.geo && n.geo.lat !== 0 && n.geo.lon !== 0)
          .map((node) => [
            node.geo.lat,
            node.geo.lon,
            node.status === "online" ? 1 : node.status === "degraded" ? 0.5 : 0.2,
          ]);

        if (heatData.length > 0) {
          // @ts-ignore - leaflet.heat types not available
          const newHeatLayer = L.heatLayer(heatData, {
            radius: 30,
            blur: 20,
            maxZoom: 10,
            max: 1.0,
            gradient: {
              0.0: "#0000ff",
              0.3: "#00ffff",
              0.5: "#00ff00",
              0.7: "#ffff00",
              1.0: "#ff0000",
            },
          });
          newHeatLayer.addTo(map);
          setHeatLayer(newHeatLayer);
        }
      } catch (error) {
        console.error("Error loading heatmap:", error);
      }
    };

    loadHeatmap();

    return () => {
      isMounted = false;
      if (heatLayer && map) {
        try {
          map.removeLayer(heatLayer);
        } catch (e) {
          // Layer might already be removed
        }
      }
    };
  }, [map, nodes]);

  return null;
}
