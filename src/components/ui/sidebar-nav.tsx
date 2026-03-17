"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export type NavNode = {
  title: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  children?: NavNode[]
}

type Props = {
  items: NavNode[]
  openSections: string[]
  onToggleSection: (title: string) => void
  onNavigate: () => void
}

export default function SidebarNav({ items, openSections, onToggleSection, onNavigate }: Props) {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  const hasActiveDescendant = (node: NavNode): boolean => {
    if (node.href && isActive(node.href)) return true
    if (!node.children?.length) return false
    return node.children.some((child) => hasActiveDescendant(child))
  }

  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.title} className="group/sidebar-section">
          {item.children ? (
            <div>
              <button
                onClick={() => onToggleSection(item.title)}
                className={cn(
                  "w-full flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-sm text-slate-200 hover:bg-[var(--sidebar-surface)]",
                  hasActiveDescendant(item) && "bg-[var(--sidebar-surface)] text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </div>
                <span
                  className={cn(
                    "text-xs transition-transform",
                    openSections.includes(item.title) && "rotate-180",
                    "lg:group-hover/sidebar-section:rotate-180"
                  )}
                >
                  ⌄
                </span>
              </button>

              <ul
                className={cn(
                  "ml-2 mt-1 space-y-1 border-l border-[var(--sidebar-border)] pl-3",
                  "max-h-0 overflow-hidden opacity-0 transition-all duration-200",
                  openSections.includes(item.title) && "max-h-[1200px] opacity-100",
                  "lg:group-hover/sidebar-section:max-h-[1200px] lg:group-hover/sidebar-section:opacity-100",
                  "lg:group-focus-within/sidebar-section:max-h-[1200px] lg:group-focus-within/sidebar-section:opacity-100"
                )}
              >
                  {item.children.map((child) => (
                    <li key={child.title}>
                      {child.children?.length ? (
                        <div className="group/inventory-category">
                          <div
                            className={cn(
                              "flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-sm text-slate-300 hover:bg-[var(--sidebar-surface)]",
                              hasActiveDescendant(child) && "bg-[var(--sidebar-surface)] text-white"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <child.icon className="h-4 w-4" />
                              <span>{child.title}</span>
                            </div>
                            <span className="text-xs transition-transform group-hover/inventory-category:rotate-180">⌄</span>
                          </div>
                          <ul className="ml-2 mt-1 space-y-1 border-l border-[var(--sidebar-border)] pl-3 max-h-0 overflow-hidden opacity-0 transition-all duration-200 group-hover/inventory-category:max-h-[720px] group-hover/inventory-category:opacity-100 group-focus-within/inventory-category:max-h-[720px] group-focus-within/inventory-category:opacity-100">
                            {child.children.map((grandChild) => (
                              <li key={grandChild.title}>
                                <Link
                                  href={grandChild.href!}
                                  onClick={onNavigate}
                                  className={cn(
                                    "flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm text-slate-300 hover:bg-[var(--sidebar-surface)]",
                                    isActive(grandChild.href!) && "bg-[var(--brand)] text-white"
                                  )}
                                >
                                  <grandChild.icon className="h-4 w-4" />
                                  <span>{grandChild.title}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <Link
                          href={child.href!}
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm text-slate-300 hover:bg-[var(--sidebar-surface)]",
                            isActive(child.href!) && "bg-[var(--brand)] text-white"
                          )}
                        >
                          <child.icon className="h-4 w-4" />
                          <span>{child.title}</span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
            </div>
          ) : (
            <Link
              href={item.href!}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm text-slate-200 hover:bg-[var(--sidebar-surface)]",
                isActive(item.href!) && "bg-[var(--brand)] text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}
