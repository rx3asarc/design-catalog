import { Bar, BarChart } from "recharts"

import { ChartContainer, ChartTooltipContent } from "@/registry/new-york-v4/ui/chart"

export function MyChart() {
  return (
    <ChartContainer>
      <BarChart data={data}>
        <Bar dataKey="value" />
        <ChartTooltip content={<ChartTooltipContent />} />
      </BarChart>
    </ChartContainer>
  )
}

export default function Demo() {
  return <MyChart />
}
