'use client';

import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/shadcn/chart';

export type ViewsChartPoint = { day: string; views: number };

const config: ChartConfig = {
  views: { label: 'Kunjungan', color: 'var(--chart-1)' },
};

/** 'YYYY-MM-DD' (a calendar date, not a timestamp) → short Indonesian label. */
function dayLabel(day: string): string {
  return format(new Date(`${day}T00:00:00`), 'd MMM', { locale: id });
}

/** Bar chart of daily article page views over the last 14 days (single series). */
export function ViewsChart({ data }: { data: ViewsChartPoint[] }) {
  return (
    <ChartContainer config={config} className="h-[240px] w-full">
      <BarChart data={data} margin={{ left: 0, right: 0, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={dayLabel}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
          fontSize={11}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload
                  ? dayLabel((payload[0].payload as ViewsChartPoint).day)
                  : ''
              }
              formatter={(value) => [
                `${Number(value).toLocaleString('id-ID')} kunjungan`,
                '',
              ]}
            />
          }
        />
        <Bar
          dataKey="views"
          fill="var(--color-views)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ChartContainer>
  );
}
