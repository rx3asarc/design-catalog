var e=`import { useSidebar } from "@/registry/new-york-v4/ui/sidebar"

export function CustomTrigger() {
  const { toggleSidebar } = useSidebar()

  return <button onClick={toggleSidebar}>Toggle Sidebar</button>
}

export default function Demo() {
  return <CustomTrigger />
}
`;export{e as default};