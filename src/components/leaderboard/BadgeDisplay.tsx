"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BadgeType, NodeScore } from "@/lib/scoring/node-score";
import { getBadgeColor, getBadgeIcon } from "@/lib/scoring/node-score";

interface BadgeDisplayProps {
  badge: BadgeType;
  score?: number;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-0.5",
  lg: "text-base px-3 py-1",
};

export function BadgeDisplay({
  badge,
  score,
  showTooltip = true,
  size = "md",
}: BadgeDisplayProps) {
  const colors = getBadgeColor(badge);
  const icon = getBadgeIcon(badge);

  const badgeContent = (
    <Badge
      variant="outline"
      className={cn(
        colors.bg,
        colors.text,
        colors.border,
        sizeClasses[size],
        "font-medium"
      )}
    >
      <span className="mr-1">{icon}</span>
      {badge}
      {score !== undefined && (
        <span className="ml-1.5 opacity-80">({score})</span>
      )}
    </Badge>
  );

  if (!showTooltip) {
    return badgeContent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{badge} Badge</p>
          <p className="text-xs text-muted-foreground">
            {getBadgeDescription(badge)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getBadgeDescription(badge: BadgeType): string {
  switch (badge) {
    case "Elite":
      return "Top performing node with score >= 95 and 7+ days online";
    case "Reliable":
      return "Consistently reliable node with score >= 85";
    case "Standard":
      return "Good performing node with score >= 70";
    case "New":
      return "Recently joined the network (< 7 days)";
    case "At Risk":
      return "Node needs attention - score below 70";
  }
}

/**
 * Score breakdown display component
 */
interface ScoreBreakdownProps {
  nodeScore: NodeScore;
  compact?: boolean;
}

export function ScoreBreakdown({ nodeScore, compact = false }: ScoreBreakdownProps) {
  const metrics = [
    { label: "Uptime", value: nodeScore.uptime_score, max: 40 },
    { label: "Stability", value: nodeScore.stability_score, max: 20 },
    { label: "Performance", value: nodeScore.performance_score, max: 20 },
    { label: "Longevity", value: nodeScore.longevity_score, max: 10 },
    { label: "Version", value: nodeScore.version_score, max: 10 },
  ];

  if (compact) {
    return (
      <div className="flex gap-4 text-xs">
        {metrics.map((m) => (
          <div key={m.label} className="text-center">
            <div className="text-muted-foreground">{m.label.slice(0, 3)}</div>
            <div className="font-mono">
              {m.value}/{m.max}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {metrics.map((m) => (
        <div key={m.label} className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{m.label}</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(m.value / m.max) * 100}%` }}
              />
            </div>
            <span className="font-mono w-12 text-right">
              {m.value}/{m.max}
            </span>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between text-sm font-medium pt-2 border-t">
        <span>Total Score</span>
        <span className="font-mono">{nodeScore.total}/100</span>
      </div>
    </div>
  );
}

/**
 * Mini badge for table cells
 */
export function MiniBadge({ badge }: { badge: BadgeType }) {
  const colors = getBadgeColor(badge);
  const icon = getBadgeIcon(badge);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium",
        colors.bg,
        colors.text
      )}
    >
      {icon}
    </span>
  );
}

export default BadgeDisplay;
