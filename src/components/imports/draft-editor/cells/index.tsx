import { TextCell, type CellProps } from "./TextCell"
import { CnicCell } from "./CnicCell"
import { DateCell } from "./DateCell"
import { EnumCell } from "./EnumCell"
import { FkCell } from "./FkCell"
import type { DraftColumn } from "@/lib/imports/client/useDraft"

type CellEditorProps = CellProps & { column: DraftColumn }

export function CellEditor({ column, ...rest }: CellEditorProps) {
  switch (column.kind) {
    case "date":
      return <DateCell {...rest} />
    case "enum":
      return <EnumCell {...rest} enumValues={column.enumValues ?? []} />
    case "fk":
      return <FkCell {...rest} fkOptions={column.fkOptions ?? []} />
    case "cnic":
      return <CnicCell {...rest} />
    case "number":
    case "text":
    default:
      return <TextCell {...rest} />
  }
}

export { TextCell, CnicCell, DateCell, EnumCell, FkCell }
