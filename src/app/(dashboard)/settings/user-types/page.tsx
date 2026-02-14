import MasterDataManager from "@/components/shared/MasterDataManager"

export default function UserTypesPage() {
  return (
    <MasterDataManager
      title="Settings: User Types"
      subtitle="Manage roles such as Super User, Admin, Supervisor, Manager."
      label="Role Name"
      includeDescription
      rows={[
        { id: "1", name: "Super User", description: "Full system access", createdAt: "2026-02-01", createdBy: "ADMIN" },
        { id: "2", name: "Admin", description: "Administrative access", createdAt: "2026-02-01", createdBy: "ADMIN" },
      ]}
      columns={["Role", "Description", "Created At", "Created By", "Action"]}
    />
  )
}
