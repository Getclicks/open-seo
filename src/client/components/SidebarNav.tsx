import { useEffect, useRef, type ComponentType } from "react";
import type { LinkOptions } from "@tanstack/react-router";
import { Link, useLocation, useMatches } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
import { cn } from "cn";
import {
  findActiveModule,
  type NavModule,
  type NavSubItem,
} from "@/client/navigation/items";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/client/components/ui/sidebar";

export const navButtonClass =
  "relative h-10 rounded-lg border border-transparent px-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground data-active:border-sidebar-border data-active:bg-sidebar-accent data-active:font-semibold data-active:text-sidebar-foreground data-active:shadow-xs";

export function SidebarNavLink({
  icon: Icon,
  label,
  linkProps,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  linkProps: LinkOptions;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <Link
        {...linkProps}
        activeOptions={{ exact: false, includeSearch: false }}
        onClick={() => setOpenMobile(false)}
      >
        {({ isActive }) => (
          <SidebarMenuButton
            render={<span />}
            isActive={isActive}
            className={navButtonClass}
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </SidebarMenuButton>
        )}
      </Link>
    </SidebarMenuItem>
  );
}

export function ModuleNav({
  modules,
  placeholder,
  filter,
}: {
  modules: NavModule[];
  placeholder: boolean;
  filter: string;
}) {
  const { setOpenMobile } = useSidebar();
  const matches = useMatches();
  const location = useLocation();
  const routeIds = matches.map((match) => match.routeId as string);
  const needle = filter.trim().toLowerCase();
  const searchParams = new URLSearchParams(location.searchStr);
  const activeKey = findActiveModule(modules, routeIds)?.key ?? null;

  const visible = modules
    .map((module) => {
      if (!needle) return { module, subs: module.subs, open: false };
      const own = module.label.toLowerCase().includes(needle);
      const subs = module.subs.filter((sub) =>
        sub.label.toLowerCase().includes(needle),
      );
      return own || subs.length > 0
        ? { module, subs: own ? module.subs : subs, open: subs.length > 0 }
        : null;
    })
    .filter((entry) => entry !== null);

  if (visible.length === 0) {
    return (
      <p className="px-2.5 py-2 text-sm text-muted-foreground">
        Nothing matches “{filter}”.
      </p>
    );
  }

  return (
    <SidebarMenu className="gap-0.5">
      {visible.map(({ module, subs, open }) => {
        const Icon = module.icon;
        const isActive = module.key === activeKey;
        const expanded = (isActive || open) && subs.length > 0;
        return (
          <SidebarMenuItem key={module.key}>
            {placeholder ? (
              <SidebarMenuButton
                render={<span />}
                aria-disabled
                className={navButtonClass}
              >
                <Icon className="size-4" />
                <span>{module.label}</span>
              </SidebarMenuButton>
            ) : (
              <Link
                {...module.link}
                aria-current={isActive ? "page" : undefined}
                activeOptions={{ exact: true, includeSearch: false }}
                onClick={() => setOpenMobile(false)}
              >
                <SidebarMenuButton
                  render={<span />}
                  isActive={isActive}
                  className={navButtonClass}
                >
                  <Icon className="size-4" />
                  <span>{module.label}</span>
                </SidebarMenuButton>
              </Link>
            )}
            {expanded && !placeholder ? (
              <ul className="mt-0.5 mb-1.5 ml-5 flex flex-col border-l border-input pl-3">
                {subs.map((sub) => (
                  <li key={sub.label}>
                    <SubLink
                      sub={sub}
                      routeIds={routeIds}
                      searchParams={searchParams}
                      siblings={subs}
                      onNavigate={() => setOpenMobile(false)}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function SubLink({
  sub,
  routeIds,
  searchParams,
  siblings,
  onNavigate,
}: {
  sub: NavSubItem;
  routeIds: string[];
  searchParams: URLSearchParams;
  siblings: NavSubItem[];
  onNavigate: () => void;
}) {
  const to = String(sub.link.to);
  const deepest = routeIds.at(-1) ?? "";
  const onRoute = deepest === `/_app${to}` || deepest === `/_app${to}/`;
  const searchMatches = (entry: NavSubItem) =>
    Object.entries(entry.matchSearch ?? {}).every(
      ([key, value]) => searchParams.get(key) === value,
    );
  // A tabbed page with no tab in the URL shows its first tab.
  const firstTabbed = siblings.find(
    (entry) => String(entry.link.to) === to && entry.matchSearch,
  );
  const noTabChosen = siblings.every(
    (entry) => !entry.matchSearch || !searchMatches(entry),
  );
  const isActive =
    onRoute &&
    (sub.matchSearch
      ? searchMatches(sub) || (noTabChosen && firstTabbed === sub)
      : true);
  return (
    <Link
      {...sub.link}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex min-h-8 items-center rounded-md px-2 text-[13px] no-underline hover:text-foreground",
        isActive ? "font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute -left-[16px] size-[7px] rounded-full",
          isActive ? "bg-primary" : "bg-transparent",
        )}
      />
      {sub.label}
    </Link>
  );
}

export function NavSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return (
    <label className="flex h-9 items-center gap-2 rounded-lg border border-sidebar-border bg-card px-2.5">
      <SearchIcon className="size-4 text-muted-foreground" aria-hidden />
      <span className="sr-only">Search the app</span>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onChange("");
        }}
        placeholder="Search"
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
      />
      <kbd className="rounded border border-input bg-sidebar px-1.5 text-[11px] text-muted-foreground">
        ⌘K
      </kbd>
    </label>
  );
}
