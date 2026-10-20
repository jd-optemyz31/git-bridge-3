import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Blast Reports — Lead Hero Health Check" },
      {
        name: "description",
        content: "Every saved Blast Analyzer run, stored as a report you can reopen anytime.",
      },
      { property: "og:title", content: "Blast Reports — Lead Hero Health Check" },
      {
        property: "og:description",
        content: "Every saved Blast Analyzer run, stored as a report you can reopen anytime.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsLayout,
});

function ReportsLayout() {
  return <Outlet />;
}
