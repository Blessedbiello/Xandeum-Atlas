"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { GeoLocation } from "@/lib/geo/geolocation";
import "leaflet/dist/leaflet.css";

// Dynamically import Leaflet components (SSR incompatible)
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((mod) => mod.CircleMarker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);
const HeatmapLayer = dynamic(
  () => import("./HeatmapLayer").then((mod) => mod.HeatmapLayer),
  { ssr: false }
);

interface NodeGeoData {
  pubkey: string;
  status: "online" | "degraded" | "offline" | "unknown";
  geo: GeoLocation;
}

interface NetworkMapProps {
  nodes: NodeGeoData[];
  showHeatmap?: boolean;
  height?: string;
}

// Status colors
const STATUS_COLORS = {
  online: "#10B981",
  degraded: "#F59E0B",
  offline: "#EF4444",
  unknown: "#6B7280",
};

function MapLoading({ height }: { height: string }) {
  return (
    <div className={`${height} w-full rounded-lg overflow-hidden`}>
      <Skeleton className="h-full w-full" />
    </div>
  );
}

export function NetworkMap({
  nodes,
  showHeatmap = false,
  height = "h-[500px]",
}: NetworkMapProps) {
  const [mounted, setMounted] = useState(false);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <MapLoading height={height} />;
  }

  const validNodes = nodes.filter(
    (n) => n.geo && n.geo.lat !== 0 && n.geo.lon !== 0
  );

  return (
    <div className={`${height} w-full rounded-lg overflow-hidden border`}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ height: "100%", width: "100%" }}
        ref={mapRef}
      >
        {/* Dark theme map tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* Node markers */}
        {validNodes.map((node) => (
          <CircleMarker
            key={node.pubkey}
            center={[node.geo.lat, node.geo.lon]}
            radius={8}
            fillColor={STATUS_COLORS[node.status]}
            fillOpacity={0.8}
            color={STATUS_COLORS[node.status]}
            weight={2}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-mono font-bold">
                  {node.pubkey.slice(0, 8)}...{node.pubkey.slice(-4)}
                </p>
                <p className="text-gray-600">
                  {node.geo.city}, {node.geo.country}
                </p>
                <p className="text-gray-600">ISP: {node.geo.isp}</p>
                <p className="text-gray-600">DC: {node.geo.dataCenter}</p>
                <p
                  className={`font-medium ${
                    node.status === "online"
                      ? "text-green-600"
                      : node.status === "degraded"
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  Status: {node.status}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}


// Heatmap variant using leaflet.heat
export function NetworkHeatmap({
  nodes,
  height = "h-[500px]",
}: NetworkMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <MapLoading height={height} />;
  }

  const validNodes = nodes.filter(
    (n) => n.geo && n.geo.lat !== 0 && n.geo.lon !== 0
  );

  return (
    <div className={`${height} w-full rounded-lg overflow-hidden border`}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        <HeatmapLayer nodes={validNodes} />
      </MapContainer>
    </div>
  );
}

export default NetworkMap;
