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

  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.title}>
          {item.children ? (
            <div>
              <button
                onClick={() => onToggleSection(item.title)}
                className="w-full flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-sm text-slate-200 hover:bg-[var(--sidebar-surface)]"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </div>
                <span className={cn("text-xs transition-transform", openSections.includes(item.title) && "rotate-180")}>⌄</span>
              </button>
              {openSections.includes(item.title) ? (
                <ul className="ml-2 mt-1 space-y-1 border-l border-[var(--sidebar-border)] pl-3">
                  {item.children.map((child) => (
                    <li key={child.title}>
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
                    </li>
                  ))}
                </ul>
              ) : null}
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
