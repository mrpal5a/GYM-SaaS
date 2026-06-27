import { NavLinks } from "@/components/layout/nav-links";

export function Sidebar({
  canManage = false,
  pendingRequests = 0,
}: {
  canManage?: boolean;
  pendingRequests?: number;
}) {
  return (
    <aside
      className={
        // Desktop: the sidebar stays put while the page content scrolls. `sticky`
        // (not a fixed app-shell) keeps normal page scrolling intact so printing
        // long pages like invoices still works. top-[4.5rem] = topbar height (3.5rem)
        // + the row's p-4 gap; self-start + a viewport-minus-chrome height let it
        // stick and scroll internally if the nav ever outgrows the screen.
        "glass hidden w-56 shrink-0 overflow-y-auto p-4 md:block " +
        "md:sticky md:top-[4.5rem] md:self-start md:h-[calc(100dvh-5.5rem)] print:hidden"
      }
    >
      <NavLinks canManage={canManage} pendingRequests={pendingRequests} />
    </aside>
  );
}
