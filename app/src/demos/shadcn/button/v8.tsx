import { CircleFadingArrowUpIcon } from "lucide-react"

import { Button } from "@/registry/new-york-v4/ui/button"

export function ButtonIcon() {
  return (
    <Button variant="outline" size="icon">
      <CircleFadingArrowUpIcon />
    </Button>
  )
}


export default function Demo() {
  return <ButtonIcon />
}
