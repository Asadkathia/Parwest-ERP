import MasterDataManager from "@/components/shared/MasterDataManager"

export default function GuardBankNamesPage() {
  return (
    <MasterDataManager
      title="Settings: Guard Bank Names"
      label="Bank Name"
      rows={[
        { id: "1", name: "HBL", createdAt: "2026-02-01", createdBy: "ADMIN" },
        { id: "2", name: "Meezan", createdAt: "2026-02-01", createdBy: "ADMIN" },
      ]}
      columns={["Bank Name", "Created At", "Created By", "Action"]}
    />
  )
}
