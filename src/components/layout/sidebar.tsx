import { NavLinks } from "@/components/layout/nav-links";

export function Sidebar({
  canManage = false,
  pendingRequests = 0,
}: {
  canManage?: boolean;
  pendingRequests?: number;
}) {
  return (
    <aside className="glass hidden w-56 shrink-0 p-4 md:block print:hidden">
      <NavLinks canManage={canManage} pendingRequests={pendingRequests} />
    </aside>
  );
}
