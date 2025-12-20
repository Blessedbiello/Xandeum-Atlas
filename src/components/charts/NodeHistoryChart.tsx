'use client';

/**
 * Node History Chart Component
 * Displays historical metrics for a specific node
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface NodeHistoryPoint {
  timestamp: string;
  status: string;
  cpu_percent: number | null;
  ram_percent: number | null;
  uptime_seconds: number | null;
  packets_sent: number | null;
  packets_received: number | null;
}

interface NodeHistoryChartProps {
  data: NodeHistoryPoint[];
  metric: 'cpu' | 'ram' | 'uptime' | 'packets';
  height?: number;
}

export function NodeHistoryChart({
  data,
  metric,
  height = 300,
}: NodeHistoryChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-muted/50 rounded-lg border border-border"
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">No historical data available</p>
      </div>
    );
  }

  // Format data for the chart
  const chartData = data.map((point) => ({
    time: new Date(point.timestamp).getTime(),
    value:
      metric === 'cpu'
        ? point.cpu_percent
        : metric === 'ram'
        ? point.ram_percent
        : metric === 'uptime'
        ? point.uptime_seconds ? point.uptime_seconds / 3600 : null // Convert to hours
        : (point.packets_sent || 0) + (point.packets_received || 0),
    status: point.status,
  }));

  const metricConfig = {
    cpu: {
      label: 'CPU Usage (%)',
      color: '#3b82f6',
      unit: '%',
    },
    ram: {
      label: 'RAM Usage (%)',
      color: '#8b5cf6',
      unit: '%',
    },
    uptime: {
      label: 'Uptime (hours)',
      color: '#10b981',
      unit: 'h',
    },
    packets: {
      label: 'Total Packets',
      color: '#f59e0b',
      unit: '',
    },
  };

  const config = metricConfig[metric];

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(timestamp) => format(new Date(timestamp), 'HH:mm')}
            className="text-xs fill-muted-foreground"
          />
          <YAxis
            className="text-xs fill-muted-foreground"
            label={{
              value: config.label,
              angle: -90,
              position: 'insideLeft',
              className: 'fill-muted-foreground text-xs',
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
            }}
            labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
            itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
            labelFormatter={(timestamp) =>
              format(new Date(timestamp), 'MMM d, yyyy HH:mm')
            }
            formatter={(value: any) =>
              value !== null ? `${value.toFixed(2)}${config.unit}` : 'N/A'
            }
          />
          <Legend
            wrapperStyle={{ color: 'hsl(var(--muted-foreground))' }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={config.color}
            strokeWidth={2}
            dot={false}
            name={config.label}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
