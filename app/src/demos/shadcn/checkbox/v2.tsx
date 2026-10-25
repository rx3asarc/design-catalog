import { Checkbox } from "@/registry/new-york-v4/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/registry/new-york-v4/ui/field"

export function CheckboxInvalid() {
  return (
    <FieldGroup className="mx-auto w-56">
      <Field orientation="horizontal" data-invalid>
        <Checkbox
          id="terms-checkbox-invalid"
          name="terms-checkbox-invalid"
          aria-invalid
        />
        <FieldLabel htmlFor="terms-checkbox-invalid">
          Accept terms and conditions
        </FieldLabel>
      </Field>
    </FieldGroup>
  )
}


export default function Demo() {
  return <CheckboxInvalid />
}
