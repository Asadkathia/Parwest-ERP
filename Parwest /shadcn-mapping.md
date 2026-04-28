# Parwest ERP — v1.0 Component → shadcn/ui Mapping

Every v1.0 component has a named shadcn counterpart below.
Run the full install command list at the bottom to add all components at once.

---

## Component Map

| v1.0 Component | shadcn/ui Component | Radix Primitive | Notes |
|---|---|---|---|
| `.btn` / `.tb-btn` | `Button` | — | Use `variant`: `default` (primary), `secondary`, `ghost`, `destructive`, `outline`. `size`: `sm`, `default`, `lg`. |
| `.inp` / `.form-input` | `Input` | — | Wrap in shadcn `Form` → `FormField` → `FormControl` → `Input`. Error via `FormMessage`. |
| `.filter-select` / `<select>` | `Select` | `@radix-ui/react-select` | Use `SelectTrigger`, `SelectContent`, `SelectItem`. |
| Search combobox | `Combobox` | `cmdk` via `Command` | Use `Command` inside `Popover` for searchable selects. |
| `<input type="checkbox">` | `Checkbox` | `@radix-ui/react-checkbox` | Indeterminate state via `checked="indeterminate"`. |
| Radio cards / `.radio-card` | `RadioGroup` + `RadioGroupItem` | `@radix-ui/react-radio-group` | Wrap each card in `Label` + `RadioGroupItem`. |
| `.switch` toggle | `Switch` | `@radix-ui/react-switch` | `checked` + `onCheckedChange`. |
| `.chip` status chip | `Badge` | — | `variant`: `default`, `secondary`, `destructive`, `outline`. Custom variants via `cva()`. |
| `.guard-avatar` / `.avatar` | `Avatar` | `@radix-ui/react-avatar` | `AvatarImage` + `AvatarFallback` with initials. |
| `.tooltip` | `Tooltip` | `@radix-ui/react-tooltip` | Wrap `TooltipProvider` at root. Use `TooltipTrigger` + `TooltipContent`. |
| Popover / flyout panels | `Popover` | `@radix-ui/react-popover` | `PopoverTrigger` + `PopoverContent`. |
| `.tabs-underline` (18-tab guard) | `Tabs` | `@radix-ui/react-tabs` | `TabsList`, `TabsTrigger`, `TabsContent`. |
| `.tabs-pill` (density toggle) | `Tabs` | same | Use `className` to apply pill styling. |
| `.progress-bar` | `Progress` | `@radix-ui/react-progress` | `value={74}` — `Progress` handles ARIA. |
| `.spinner` | `Skeleton` (loading) or custom SVG | — | No shadcn Spinner; use animated `Loader2` from lucide-react inside `Button`. |
| `.skeleton` shimmer | `Skeleton` | — | `<Skeleton className="h-4 w-[200px]" />`. |
| `.data-table` | `DataTable` (TanStack Table wrapper) | — | shadcn ships a DataTable recipe. See below. |
| `.card` | `Card` | — | `CardHeader`, `CardContent`, `CardFooter`. |
| `.modal` / confirm dialog | `Dialog` | `@radix-ui/react-dialog` | `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`. |
| Destructive confirm | `AlertDialog` | `@radix-ui/react-alert-dialog` | Use for terminate/delete — requires explicit confirmation. |
| Right-side drawer / sheet | `Sheet` | `@radix-ui/react-dialog` | `SheetTrigger`, `SheetContent side="right"`. |
| `.toast` notification | `Sonner` (via `sonner` package) | — | `import { toast } from 'sonner'`. `toast.success()`, `toast.error()`, `toast.warning()`. |
| `.alert` inline banner | `Alert` | — | `AlertTitle` + `AlertDescription`. `variant`: `default`, `destructive`. |
| `.dropdown-menu` | `DropdownMenu` | `@radix-ui/react-dropdown-menu` | `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`. |
| `.breadcrumb` | `Breadcrumb` | — | `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`. |
| Command palette (⌘K) | `Command` | `cmdk` | `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem`. Wrap in `Dialog` for overlay. |
| Form layouts | `Form` | `react-hook-form` + `zod` | `useForm`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`. |
| Date input | `Calendar` + `DatePicker` | `react-day-picker` | Combine `Popover` + `Calendar`. Use `date-fns` for formatting. |
| **Stepper wizard** | **Custom — see stepper.tsx spec** | — | shadcn has no Stepper. Use the spec in `stepper.tsx`. |
| `.kpi-card` | `Card` + custom content | — | No shadcn KPI card; use `Card` + `CardContent` with `cn()` styling. |
| Sidebar | `Sheet` (mobile) + CSS-sticky (desktop) | — | shadcn ships a sidebar recipe in v2. Use it or the CSS-sticky pattern from v1.0. |
| Permission gate | `Alert` + `disabled` attr | — | Disabled button with `Alert` explanation. No Radix primitive needed. |
| Region selector | `Select` (Super User) / `Badge` (Regional Admin) | — | See `region-scope.html`. |

---

## TanStack Table (DataTable) setup

```tsx
// components/ui/data-table.tsx — shadcn recipe
import {
  ColumnDef, flexRender,
  getCoreRowModel, getSortedRowModel, getPaginationRowModel,
  getFilteredRowModel, useReactTable,
  SortingState, ColumnFiltersState, VisibilityState,
} from '@tanstack/react-table'

// Standard shadcn DataTable — see https://ui.shadcn.com/docs/components/data-table
// Add column-visibility toggle, sorting, pagination, and row-selection
// checkboxes per the v1.0 Guards table spec.
```

---

## Form pattern (react-hook-form + zod)

```tsx
// Guard create form — step 1 schema
import { z } from 'zod'

const cnicRegex = /^\d{5}-\d{7}-\d$/

export const personalInfoSchema = z.object({
  fullName:    z.string().min(2, 'Full name is required.'),
  fatherName:  z.string().min(2, 'Father name is required.'),
  cnic:        z.string().regex(cnicRegex, 'Enter a valid CNIC: XXXXX-XXXXXXX-X'),
  dob:         z.date({ required_error: 'Date of birth is required.' }),
  gender:      z.enum(['MALE', 'FEMALE', 'OTHER']),
  marital:     z.enum(['SINGLE', 'MARRIED', 'WIDOWED', 'DIVORCED']),
  religion:    z.enum(['ISLAM', 'CHRISTIANITY', 'HINDUISM', 'OTHER']),
  bloodGroup:  z.string().optional(),
  isExService: z.boolean().default(false),
  // Ex-service fields (conditional)
  serviceType: z.string().optional(),
  rank:        z.string().optional(),
  regiment:    z.string().optional(),
})
.refine(data => {
  if (data.isExService && !data.serviceType) return false
  return true
}, { message: 'Service type is required for ex-servicemen.', path: ['serviceType'] })
```

---

## Badge (chip) custom variants

```tsx
// Extend shadcn Badge with Parwest status variants
import { cva } from 'class-variance-authority'

const guardStatusVariants = cva('badge', {
  variants: {
    status: {
      ACTIVE:            'bg-success-50 text-success-700',
      PENDING:           'bg-warning-50 text-warning-700',
      INACTIVE:          'bg-muted text-muted-foreground',
      TERMINATED:        'bg-danger-50 text-danger-700',
      GLOBAL_FINALIZED:  'bg-success-50 text-success-700',
      REGIONAL_LOCKED:   'bg-warning-50 text-warning-700',
      HOLD:              'bg-danger-50 text-danger-700',
      DRAFT:             'bg-muted text-muted-foreground',
      DAY:               'bg-blue-50 text-blue-700',
      NIGHT:             'bg-indigo-50 text-indigo-700',
      BOTH:              'bg-purple-50 text-purple-700',
    },
  },
})

export function GuardStatusBadge({ status }: { status: string }) {
  return (
    <span className={guardStatusVariants({ status: status as any })}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {status.replace('_', ' ')}
    </span>
  )
}
```

---

## Full install command

Run once after `npx shadcn@latest init`:

```bash
npx shadcn@latest add \
  button \
  input \
  label \
  select \
  checkbox \
  radio-group \
  switch \
  badge \
  avatar \
  tooltip \
  popover \
  tabs \
  progress \
  skeleton \
  table \
  card \
  dialog \
  sheet \
  alert-dialog \
  alert \
  dropdown-menu \
  breadcrumb \
  command \
  form \
  calendar \
  date-picker \
  separator \
  scroll-area \
  collapsible \
  textarea \
  sonner
```

> **Note:** `date-picker` is a shadcn recipe (not a primitive) — run
> `npx shadcn@latest add date-picker` and it scaffolds the Popover+Calendar pattern.

---

## Not in shadcn — build from spec

| Component | Spec location |
|---|---|
| Stepper wizard | `stepper.tsx` |
| KPI card | Build with `Card` + custom className |
| Sidebar (desktop) | CSS-sticky + v1.0 token pattern |
| Guard lifecycle progress | Custom CSS (see v1.0 `.lifecycle`) |
| Payroll workflow bar | Custom CSS (see v1.0 `.workflow-bar`) |
| RBAC permission matrix | Custom table (no shadcn equivalent) |
| Attendance heatmap | Custom grid (see v1.0 Guard Profile) |
