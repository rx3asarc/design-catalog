var e=`import { Slider } from "@/registry/new-york-v4/ui/slider"

export function SliderDisabled() {
  return (
    <Slider
      defaultValue={[50]}
      max={100}
      step={1}
      disabled
      className="mx-auto w-full max-w-xs"
    />
  )
}


export default function Demo() {
  return <SliderDisabled />
}
`;export{e as default};