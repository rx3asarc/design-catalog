"use client"

import { Calendar } from "@/registry/new-york-v4/ui/calendar"

export function CalendarCaption() {
  return (
    <Calendar
      mode="single"
      captionLayout="dropdown"
      className="rounded-lg border"
    />
  )
}


export default function Demo() {
  return <CalendarCaption />
}
