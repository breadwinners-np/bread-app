"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Sections not yet built are shown but visibly marked. */
  comingSoon?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Today", icon: <SunIcon /> },
  { href: "/distribution", label: "Deliveries", icon: <TruckIcon /> },
  { href: "/orders", label: "Orders", icon: <ClipboardIcon /> },
  { href: "/customers", label: "Customers", icon: <PeopleIcon /> },
  { href: "/inventory", label: "Inventory", icon: <BoxIcon /> },
  { href: "/payments", label: "Payments", icon: <CashIcon /> },
  { href: "/costs", label: "Costs", icon: <ReceiptIcon />, comingSoon: true },
  { href: "/reports", label: "Reports", icon: <ChartIcon /> },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="w-64 shrink-0 border-r border-stone-200 bg-white px-4 py-6"
    >
      <div className="px-3 pb-6">
        <p className="text-xl font-bold tracking-tight text-stone-900">Bakery</p>
        <p className="text-sm text-stone-500">Daily operations</p>
      </div>

      <ul className="space-y-1">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium transition-colors",
                  active
                    ? "bg-amber-100 text-amber-900"
                    : "text-stone-700 hover:bg-stone-100",
                ].join(" ")}
              >
                <span className={active ? "text-amber-700" : "text-stone-400"}>
                  {item.icon}
                </span>
                {item.label}
                {item.comingSoon && (
                  <span className="ml-auto rounded-full bg-stone-100 px-2 py-0.5 text-xs font-normal text-stone-500">
                    soon
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* Simple stroke icons, kept inline so the prototype has no icon dependency. */

function iconProps() {
  return {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

function SunIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M9 4h6v3H9zM7 5H5v16h14V5h-2" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M18 20a5 5 0 0 0-2-4" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
      <path d="M3 7l9 4 9-4M12 11v10" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}
