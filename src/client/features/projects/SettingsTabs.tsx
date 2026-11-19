import { NavTab, NavTabs } from "@/client/components/NavTabs";

const tabs = [
  { to: "/p/$projectId/settings" as const, label: "General", exact: true },
  { to: "/p/$projectId/settings/integrations" as const, label: "Integrations" },
  {
    to: "/p/$projectId/settings/weekly-report" as const,
    label: "Weekly report",
  },
  { to: "/p/$projectId/settings/stores" as const, label: "All stores" },
];

export function SettingsTabs({ projectId }: { projectId: string }) {
  return (
    <NavTabs label="Store settings sections">
      {tabs.map((tab) => (
        <NavTab
          key={tab.to}
          to={tab.to}
          params={{ projectId }}
          activeOptions={{ exact: tab.exact ?? false }}
        >
          {tab.label}
        </NavTab>
      ))}
    </NavTabs>
  );
}
