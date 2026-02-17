export type OcrFieldMatch = {
  field: string
  value: string
  confidence: number
}

export type OcrExtraction = {
  documentType: "CNIC" | "PASSPORT" | "CLIENT_FORM"
  fields: OcrFieldMatch[]
}

export function simulateOcrExtraction(fileName: string, target: "guard" | "client"): OcrExtraction {
  const lower = fileName.toLowerCase()
  const documentType = lower.includes("passport") ? "PASSPORT" : lower.includes("client") ? "CLIENT_FORM" : "CNIC"

  if (target === "guard") {
    return {
      documentType,
      fields: [
        { field: "name", value: "Muhammad Usman", confidence: 0.94 },
        { field: "cnic", value: "35202-7833617-5", confidence: 0.98 },
        { field: "fatherName", value: "Muhammad Hanif", confidence: 0.88 },
        { field: "dateOfBirth", value: "1988-02-06", confidence: 0.82 },
      ],
    }
  }

  return {
    documentType,
    fields: [
      { field: "name", value: "National Bank of Pakistan", confidence: 0.91 },
      { field: "email", value: "nbp@example.com", confidence: 0.87 },
      { field: "city", value: "Lahore", confidence: 0.92 },
      { field: "headOfficeAddress", value: "Mall Road Lahore", confidence: 0.8 },
    ],
  }
}
