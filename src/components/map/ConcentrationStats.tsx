"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { DCConcentration, CountryDistribution } from "@/lib/geo/geolocation";
import { cn } from "@/lib/utils";

interface ConcentrationStatsProps {
  dcConcentration: DCConcentration[];
  countryDistribution: CountryDistribution[];
}

function RiskBadge({ risk }: { risk: "LOW" | "MEDIUM" | "HIGH" }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs",
        risk === "LOW" && "border-green-500 text-green-500",
        risk === "MEDIUM" && "border-yellow-500 text-yellow-500",
        risk === "HIGH" && "border-red-500 text-red-500"
      )}
    >
      {risk}
    </Badge>
  );
}

export function ConcentrationStats({
  dcConcentration,
  countryDistribution,
}: ConcentrationStatsProps) {
  // Calculate overall network diversity score
  const avgScore =
    dcConcentration.length > 0
      ? dcConcentration.reduce((sum, dc) => sum + dc.score, 0) /
        dcConcentration.length
      : 0;

  const diversityRating =
    avgScore >= 1.5 ? "Excellent" : avgScore >= 1.0 ? "Good" : "Needs Improvement";

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Data Center Concentration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Data Center Distribution
            <Badge
              variant="outline"
              className={cn(
                avgScore >= 1.5
                  ? "border-green-500 text-green-500"
                  : avgScore >= 1.0
                  ? "border-yellow-500 text-yellow-500"
                  : "border-red-500 text-red-500"
              )}
            >
              {diversityRating}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {dcConcentration.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data available</p>
          ) : (
            dcConcentration.slice(0, 6).map((dc) => (
              <div key={dc.dataCenter} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{dc.dataCenter}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {dc.count} ({dc.percentage}%)
                    </span>
                    <RiskBadge risk={dc.risk} />
                  </div>
                </div>
                <Progress
                  value={dc.percentage}
                  className="h-2"
                  indicatorClassName={cn(
                    dc.risk === "LOW" && "bg-green-500",
                    dc.risk === "MEDIUM" && "bg-yellow-500",
                    dc.risk === "HIGH" && "bg-red-500"
                  )}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Decentralization Score</span>
                  <span>{dc.score.toFixed(2)} / 2.00</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Country Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Geographic Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {countryDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data available</p>
          ) : (
            countryDistribution.slice(0, 8).map((country) => (
              <div key={country.countryCode} className="flex items-center gap-3">
                {/* Country flag emoji */}
                <span className="text-lg">
                  {countryCodeToFlag(country.countryCode)}
                </span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span>{country.country}</span>
                    <span className="text-muted-foreground">
                      {country.count} ({country.percentage}%)
                    </span>
                  </div>
                  <Progress
                    value={country.percentage}
                    className="h-1.5 mt-1"
                    indicatorClassName="bg-primary"
                  />
                </div>
              </div>
            ))
          )}

          {/* Summary */}
          <div className="pt-3 border-t text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Total Countries</span>
              <span className="font-medium text-foreground">
                {countryDistribution.length}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Convert country code to flag emoji
 */
function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return "🌍";
  const codePoints = code
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export default ConcentrationStats;
