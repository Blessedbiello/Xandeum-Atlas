"use client";

import { useState } from "react";
import { Header } from "@/components/dashboard/Header";
import { NetworkMap, NetworkHeatmap } from "@/components/map/NetworkMap";
import { ConcentrationStats } from "@/components/map/ConcentrationStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGeoData } from "@/lib/hooks/use-geo";
import { MapPin, Layers, Globe2, Server, AlertTriangle } from "lucide-react";

type MapView = "markers" | "heatmap";

export default function MapPage() {
  const [mapView, setMapView] = useState<MapView>("heatmap");
  const { data: geoData, isLoading, error } = useGeoData();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-6">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Globe2 className="h-8 w-8" />
              Network Map
            </h2>
            <p className="text-muted-foreground">
              Geographic distribution of Xandeum pNodes worldwide
            </p>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={mapView === "markers" ? "default" : "outline"}
              size="sm"
              onClick={() => setMapView("markers")}
              className="gap-2"
            >
              <MapPin className="h-4 w-4" />
              Markers
            </Button>
            <Button
              variant={mapView === "heatmap" ? "default" : "outline"}
              size="sm"
              onClick={() => setMapView("heatmap")}
              className="gap-2"
            >
              <Layers className="h-4 w-4" />
              Heatmap
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        {!isLoading && geoData && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Server className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{geoData.total}</p>
                    <p className="text-xs text-muted-foreground">Total Nodes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <MapPin className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{geoData.geolocated}</p>
                    <p className="text-xs text-muted-foreground">Geolocated</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Globe2 className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {geoData.countryDistribution.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Countries</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Layers className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {geoData.dcConcentration.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Data Centers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Map */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {mapView === "markers" ? (
                <>
                  <MapPin className="h-4 w-4" />
                  Node Locations
                </>
              ) : (
                <>
                  <Layers className="h-4 w-4" />
                  Node Density Heatmap
                </>
              )}
              {geoData && (
                <Badge variant="secondary" className="ml-auto">
                  Last updated: {new Date(geoData.fetched_at).toLocaleTimeString()}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[500px] w-full rounded-lg" />
            ) : error ? (
              <div className="h-[500px] flex items-center justify-center">
                <div className="text-center space-y-2">
                  <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
                  <p className="text-destructive">Failed to load map data</p>
                  <p className="text-sm text-muted-foreground">
                    {error instanceof Error ? error.message : "Unknown error"}
                  </p>
                </div>
              </div>
            ) : geoData ? (
              mapView === "markers" ? (
                <NetworkMap nodes={geoData.nodes} height="h-[500px]" />
              ) : (
                <NetworkHeatmap nodes={geoData.nodes} height="h-[500px]" />
              )
            ) : null}
          </CardContent>
        </Card>

        {/* Concentration Stats */}
        {!isLoading && geoData && (
          <ConcentrationStats
            dcConcentration={geoData.dcConcentration}
            countryDistribution={geoData.countryDistribution}
          />
        )}

        {/* Legend */}
        {mapView === "markers" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500" />
                  <span className="text-sm">Online</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-yellow-500" />
                  <span className="text-sm">Degraded</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500" />
                  <span className="text-sm">Offline</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-gray-500" />
                  <span className="text-sm">Unknown</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {mapView === "heatmap" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Heatmap Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">Low Density</span>
                <div className="flex-1 h-4 rounded bg-gradient-to-r from-blue-500 via-cyan-500 via-lime-500 via-yellow-500 to-red-500" />
                <span className="text-sm text-muted-foreground">High Density</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Heatmap intensity reflects the concentration of nodes in each region.
                Online nodes have higher intensity than degraded or offline nodes.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Xandeum Atlas - pNode Analytics Platform
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Geolocation data powered by IP-API.com</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
