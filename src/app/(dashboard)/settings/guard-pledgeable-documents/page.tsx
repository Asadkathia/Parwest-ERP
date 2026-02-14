import MasterDataManager from "@/components/shared/MasterDataManager"

export default function GuardPledgeableDocumentsPage() {
  return (
    <MasterDataManager
      title="Settings: Guard Pledgeable Document Types"
      label="Document Type"
      includeDescription
      rows={[
        { id: "1", name: "Matric/Inter Results", description: "Academic proof", createdAt: "2026-02-01", createdBy: "ADMIN" },
        { id: "2", name: "CNIC", description: "Identity document", createdAt: "2026-02-01", createdBy: "ADMIN" },
      ]}
      columns={["Document Type", "Description", "Created At", "Created By", "Action"]}
    />
  )
}
