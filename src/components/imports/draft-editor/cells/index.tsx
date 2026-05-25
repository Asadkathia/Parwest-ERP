import { TextCell, type CellProps } from "./TextCell"
import { CnicCell } from "./CnicCell"
import { PhoneCell } from "./PhoneCell"
import { DateCell } from "./DateCell"
import { EnumCell } from "./EnumCell"
import { FkCell } from "./FkCell"
import { ReadOnlyCell } from "./ReadOnlyCell"
import type { DraftColumn } from "@/lib/imports/client/useDraft"

type CellEditorProps = CellProps & { column: DraftColumn }

export function CellEditor({ column, ...rest }: CellEditorProps) {
  // Display-only columns (e.g. joining date) are never editable, regardless of kind.
  if (column.readOnly) return <ReadOnlyCell {...rest} kind={column.kind} />
  switch (column.kind) {
    case "date":
      return <DateCell {...rest} />
    case "enum":
      return <EnumCell {...rest} enumValues={column.enumValues ?? []} />
    case "fk":
      return <FkCell {...rest} fkOptions={column.fkOptions ?? []} />
    case "cnic":
      return <CnicCell {...rest} />
    case "phone":
      return <PhoneCell {...rest} />
    case "number":
    case "text":
    default:
      return <TextCell {...rest} />
  }
}

export { TextCell, CnicCell, PhoneCell, DateCell, EnumCell, FkCell, ReadOnlyCell }
