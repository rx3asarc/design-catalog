import { Slider } from "@/registry/new-york-v4/ui/slider"

export function SliderDemo() {
  return (
    <Slider
      defaultValue={[75]}
      max={100}
      step={1}
      className="mx-auto w-full max-w-xs"
    />
  )
}


export default function Demo() {
  return <SliderDemo />
}
