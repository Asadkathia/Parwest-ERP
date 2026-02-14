import MasterDataManager from "@/components/shared/MasterDataManager"

export default function SettingsRegionsPage() {
  return (
    <MasterDataManager
      title="Settings: Regions"
      subtitle="Manage broad geographical regions."
      label="Region Name"
      rows={[
        { id: "1", name: "Lahore", createdAt: "2026-02-01", createdBy: "ADMIN" },
        { id: "2", name: "Sindh", createdAt: "2026-02-01", createdBy: "ADMIN" },
      ]}
      columns={["Region", "Created At", "Created By", "Action"]}
    />
  )
}
