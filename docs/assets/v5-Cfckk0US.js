var e=`import { Checkbox } from "@/registry/new-york-v4/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/registry/new-york-v4/ui/field"

export function CheckboxDisabled() {
  return (
    <FieldGroup className="mx-auto w-56">
      <Field orientation="horizontal" data-disabled>
        <Checkbox
          id="toggle-checkbox-disabled"
          name="toggle-checkbox-disabled"
          disabled
        />
        <FieldLabel htmlFor="toggle-checkbox-disabled">
          Enable notifications
        </FieldLabel>
      </Field>
    </FieldGroup>
  )
}


export default function Demo() {
  return <CheckboxDisabled />
}
`;export{e as default};