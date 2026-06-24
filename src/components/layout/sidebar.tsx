import Link from "next/link";

const items = [
  { href: "/dashboard", label: "Dashboard" },
];

export function Sidebar() {
  return (
    <aside className="glass hidden w-56 shrink-0 p-4 md:block">
      <nav className="space-y-1">
        {items.map((i) => (
          <Link key={i.href} href={i.href}
            className="block rounded-md px-3 py-2 text-sm hover:bg-white/10">
            {i.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
