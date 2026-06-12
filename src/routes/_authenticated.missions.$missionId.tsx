import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/missions/$missionId')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/missions/$missionId"!</div>
}
