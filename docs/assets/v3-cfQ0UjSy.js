var e=`import { Skeleton } from "@/registry/new-york-v4/ui/skeleton"

export function SkeletonText() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}


export default function Demo() {
  return <SkeletonText />
}
`;export{e as default};