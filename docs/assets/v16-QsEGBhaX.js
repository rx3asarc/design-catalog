var e=`import * as React from "react";
export function AppSidebar() {
  const [open, setOpen] = React.useState(false)

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <Sidebar />
    </SidebarProvider>
  )
}

export default function Demo() {
  return <AppSidebar />
}`;export{e as default};