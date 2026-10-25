var e=`import { Tabs, TabsList, TabsTrigger } from "@/registry/new-york-v4/ui/tabs"

export function TabsVertical() {
  return (
    <Tabs defaultValue="account" orientation="vertical">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}


export default function Demo() {
  return <TabsVertical />
}
`;export{e as default};