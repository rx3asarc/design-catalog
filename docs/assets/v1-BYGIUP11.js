var e=`import { Slider } from "@/registry/new-york-v4/ui/slider"

export function SliderRange() {
  return (
    <Slider
      defaultValue={[25, 50]}
      max={100}
      step={5}
      className="mx-auto w-full max-w-xs"
    />
  )
}


export default function Demo() {
  return <SliderRange />
}
`;export{e as default};