var e=`import * as React from "react"

export function Example() {
  const [checked, setChecked] = React.useState(false)

  return <Checkbox checked={checked} onCheckedChange={setChecked} />
}

export default function Demo() {
  return <Example />
}
`;export{e as default};