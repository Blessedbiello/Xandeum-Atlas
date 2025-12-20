'use client';

/**
 * Network Health Chart Component
 * Displays network-wide health trends over time
 */

import {
  AreaChart,
  Area,
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

interface NetworkHistoryPoint {
  timestamp: string;
  total_nodes: number;
  online_nodes: number;
  degraded_nodes: number;
  offline_nodes: number;
  health_percent: number;
  avg_cpu: number | null;
  avg_ram: number | null;
}

interface NetworkHealthChartProps {
  data: NetworkHistoryPoint[];
  type?: 'health' | 'nodes' | 'performance';
  height?: number;
}

export function NetworkHealthChart({
  data,
  type = 'health',
  height = 300,
}: NetworkHealthChartProps) {
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
    timestamp: point.timestamp,
    total_nodes: point.total_nodes,
    online_nodes: point.online_nodes,
    degraded_nodes: point.degraded_nodes,
    offline_nodes: point.offline_nodes,
    health_percent: point.health_percent,
    avg_cpu: point.avg_cpu,
    avg_ram: point.avg_ram,
  }));

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return format(date, 'HH:mm');
    } else if (diffHours < 168) {
      return format(date, 'EEE HH:mm');
    } else {
      return format(date, 'MMM d');
    }
  };

  if (type === 'health') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTime}
            className="text-xs fill-muted-foreground"
          />
          <YAxis
            domain={[0, 100]}
            className="text-xs fill-muted-foreground"
            label={{
              value: 'Health %',
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
            formatter={(value: any) => `${value.toFixed(1)}%`}
          />
          <Legend wrapperStyle={{ color: 'hsl(var(--muted-foreground))' }} />
          <Area
            type="monotone"
            dataKey="health_percent"
            stroke="#10b981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#healthGradient)"
            name="Network Health"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'nodes') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTime}
            className="text-xs fill-muted-foreground"
          />
          <YAxis
            className="text-xs fill-muted-foreground"
            label={{
              value: 'Node Count',
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
          />
          <Legend wrapperStyle={{ color: 'hsl(var(--muted-foreground))' }} />
          <Line
            type="monotone"
            dataKey="online_nodes"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            name="Online"
          />
          <Line
            type="monotone"
            dataKey="degraded_nodes"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            name="Degraded"
          />
          <Line
            type="monotone"
            dataKey="offline_nodes"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            name="Offline"
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Performance chart (CPU & RAM)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="time"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={formatTime}
          className="text-xs fill-muted-foreground"
        />
        <YAxis
          domain={[0, 100]}
          className="text-xs fill-muted-foreground"
          label={{
            value: 'Usage %',
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
            value !== null ? `${value.toFixed(1)}%` : 'N/A'
          }
        />
        <Legend wrapperStyle={{ color: 'hsl(var(--muted-foreground))' }} />
        <Line
          type="monotone"
          dataKey="avg_cpu"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          name="Avg CPU"
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="avg_ram"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={false}
          name="Avg RAM"
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
