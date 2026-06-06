import { createFileRoute, redirect } from "@tanstack/react-router";

// Meeting detail merged into the /calendar side sheet.
// /meetings/$id?... lands on /calendar?meeting=$id with the sheet open.
export const Route = createFileRoute("/_authenticated/meetings/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/calendar", search: { meeting: params.id } });
  },
});
