"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Main navigation.
 *
 * Eight flat destinations asked the owner to hold the whole app in her head at
 * once. They are grouped under three headings that match how her day splits —
 * the work of the morning, the money, and the records she looks things up in.
 *
 * The labels say what she gets, not what the data is called: "Money in" rather
 * than "Payments", "Money out" rather than "Inventory" and "Costs" (which were
 * two screens for one idea, one of them permanently badged "soon"). Those
 * labels are plain enough to stand alone, so there is no second line of
 * explanation under each — seven of those was most of the noise in here.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    heading: "Each day",
    items: [
      { href: "/", label: "Today", icon: <SunIcon /> },
      { href: "/distribution", label: "Deliveries", icon: <TruckIcon /> },
      { href: "/orders", label: "Orders", icon: <ClipboardIcon /> },
    ],
  },
  {
    heading: "Money",
    items: [
      { href: "/payments", label: "Money in", icon: <CashIcon /> },
      { href: "/spending", label: "Money out", icon: <BoxIcon /> },
    ],
  },
  {
    heading: "Records",
    items: [
      { href: "/customers", label: "Customers", icon: <PeopleIcon /> },
      { href: "/reports", label: "Reports", icon: <ChartIcon /> },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="w-60 shrink-0 border-r border-stone-200 bg-white px-3 py-8"
    >
      <p className="px-3 pb-8 text-lg font-semibold tracking-tight text-stone-900">
        Bakery
      </p>

      <div className="space-y-8">
        {NAV.map((group) => (
          <div key={group.heading}>
            <h2 className="px-3 pb-2 text-sm font-medium text-stone-500">
              {group.heading}
            </h2>

            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                        active
                          ? "bg-stone-100 font-medium text-stone-900"
                          : "text-stone-600 hover:bg-stone-50 hover:text-stone-900",
                      ].join(" ")}
                    >
                      <span
                        className={active ? "text-stone-900" : "text-stone-400"}
                      >
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

/**
 * "Today" is only current on an exact match — every path starts with "/", so a
 * prefix test would light it up on every screen.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* Simple stroke icons, kept inline so the prototype has no icon dependency. */

function iconProps() {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
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

function ChartIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}
