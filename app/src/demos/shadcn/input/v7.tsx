import { Button } from "@/registry/new-york-v4/ui/button"
import { Field } from "@/registry/new-york-v4/ui/field"
import { Input } from "@/registry/new-york-v4/ui/input"

export function InputInline() {
  return (
    <Field orientation="horizontal">
      <Input type="search" placeholder="Search..." />
      <Button>Search</Button>
    </Field>
  )
}


export default function Demo() {
  return <InputInline />
}
