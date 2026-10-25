import { useSidebar } from "@/registry/new-york-v4/ui/sidebar"

export function AppSidebar() {
  const {
    state,
    open,
    setOpen,
    openMobile,
    setOpenMobile,
    isMobile,
    toggleSidebar,
  } = useSidebar()
}

export default function Demo() {
  return <AppSidebar />
}
