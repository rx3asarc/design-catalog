var e=`import { IconGitBranch, IconGitFork } from "@tabler/icons-react"

import { Button } from "@/registry/new-york-v4/ui/button"

export function ButtonWithIcon() {
  return (
    <div className="flex gap-2">
      <Button variant="outline">
        <IconGitBranch data-icon="inline-start" /> New Branch
      </Button>
      <Button variant="outline">
        Fork
        <IconGitFork data-icon="inline-end" />
      </Button>
    </div>
  )
}


export default function Demo() {
  return <ButtonWithIcon />
}
`;export{e as default};