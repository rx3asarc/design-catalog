import { ArrowUpRightIcon } from "lucide-react"

import { Badge } from "@/registry/new-york-v4/ui/badge"

export function BadgeAsLink() {
  return (
    <Badge render={<a href="#link" />}>
      Open Link <ArrowUpRightIcon data-icon="inline-end" />
    </Badge>
  )
}


export default function Demo() {
  return <BadgeAsLink />
}
