import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  CircleHelp,
  CreditCard,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import { organizationContextQueryOptions } from "@/client/features/team/organizationQueries";
import { switchOrganization } from "@/serverFunctions/organization";
import { clearLastProjectId } from "@/client/lib/active-project";
import {
  connectNavModules,
  getProjectNavModules,
} from "@/client/navigation/items";
import { ProjectSwitcher } from "@/client/features/projects/ProjectSwitcher";
import {
  SamChatListSkeleton,
  SamSidebarPanel,
} from "@/client/features/sam/SamSidebarPanel";
import { ThemePreferenceRadio } from "@/client/components/ThemePreferenceMenuItems";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { signOutAndRedirect, useSession } from "@/lib/auth-client";
import {
  isEveryAppClientAuthMode,
  isHostedClientAuthMode,
} from "@/lib/auth-mode";
import { everyAppAccountQueryOptions } from "@/client/features/every-app/everyAppAccountQueries";
import { BILLING_ROUTE } from "@/shared/billing";
import {
  Sidebar as UiSidebar,
  SidebarContent,
  SidebarFooter as UiSidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/client/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import {
  ModuleNav,
  NavSearch,
  navButtonClass,
  SidebarNavLink,
} from "@/client/components/SidebarNav";

export function Sidebar({
  projectId,
  projectPending,
  ready,
}: {
  projectId: string | null;
  /** No project is known yet, but the projects list may still name one. */
  projectPending: boolean;
  /** The session is confirmed, so the sidebar's own data can load. */
  ready: boolean;
}) {
  // Until a project is known, show the project nav as rows without links, so
  // the sidebar has its full shape from the first paint instead of growing
  // once projects load.
  const navPlaceholder = projectId === null && projectPending;
  const modules =
    projectId !== null || navPlaceholder
      ? getProjectNavModules(projectId ?? "")
      : connectNavModules;
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();
  const [filter, setFilter] = useState("");
  // SAM is hidden from navigation: the chat route is only reachable by URL,
  // and while it is open its chat list takes the nav's place.
  const onSamRoute = pathname.includes("/sam");

  return (
    <UiSidebar
      variant="inset"
      collapsible="offcanvas"
      className="md:!top-3 md:!bottom-3 md:!left-3 md:!h-auto md:!p-0"
    >
      <SidebarHeader className={cn("gap-3 px-3.5", everyApp ? "pt-2" : "pt-4")}>
        {everyApp ? <EveryAppLink /> : null}
        <ProjectSwitcher
          activeProjectId={projectId}
          ready={ready}
          onCloseDrawer={() => setOpenMobile(false)}
        />
        {onSamRoute ? null : <NavSearch value={filter} onChange={setFilter} />}
      </SidebarHeader>

      <SidebarContent className="px-1.5">
        {onSamRoute && projectId ? (
          ready ? (
            <SamSidebarPanel
              projectId={projectId}
              onNavigate={() => setOpenMobile(false)}
            />
          ) : (
            <div className="px-2 py-1">
              <SamChatListSkeleton />
            </div>
          )
        ) : (
          <nav
            aria-label="Main navigation"
            aria-busy={navPlaceholder || undefined}
          >
            <SidebarGroup className="py-1">
              <SidebarGroupContent>
                <ModuleNav
                  modules={modules}
                  placeholder={navPlaceholder}
                  filter={filter}
                />
              </SidebarGroupContent>
            </SidebarGroup>
          </nav>
        )}
      </SidebarContent>
      <AccountFooter ready={ready} />
    </UiSidebar>
  );
}

// Behind an Every App gateway, which owns sign-in, organizations, teams and
// billing: the sidebar's first row links back to the gateway, and the footer
// holds help and OpenSEO settings.
const everyApp = isEveryAppClientAuthMode();

/**
 * The way back up, first in the sidebar as in every Every App app. The row
 * keeps its height while the gateway's URL loads so the header doesn't jump.
 */
function EveryAppLink() {
  const accountQuery = useQuery(everyAppAccountQueryOptions());
  const gatewayUrl = accountQuery.data?.gatewayUrl;
  if (!accountQuery.isPending && !gatewayUrl) return null;
  return (
    <a
      href={gatewayUrl ?? undefined}
      aria-label="Back to Every App"
      className={cn(
        "mb-1 inline-flex h-7 w-fit items-center gap-0.5 rounded-md pl-0.5 pr-2 text-sm text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground",
        accountQuery.isPending && "invisible",
      )}
    >
      <ChevronLeft className="size-4" aria-hidden />
      <span>Every App</span>
    </a>
  );
}

function AccountFooter({ ready }: { ready: boolean }) {
  const { data: session } = useSession();
  const { setOpenMobile } = useSidebar();
  const everyAppAccountQuery = useQuery({
    ...everyAppAccountQueryOptions(),
    enabled: everyApp,
  });
  const email = everyApp
    ? everyAppAccountQuery.data?.email
    : session?.user?.email;
  const [isSwitching, setIsSwitching] = useState(false);
  const orgContextQuery = useQuery({
    ...organizationContextQueryOptions(),
    enabled: Boolean(email) && !everyApp,
  });
  const organizations = everyApp
    ? []
    : (orgContextQuery.data?.organizations ?? []);
  const activeOrganizationId = orgContextQuery.data?.organizationId;

  async function handleSwitchOrganization(organizationId: string) {
    if (isSwitching || organizationId === activeOrganizationId) return;
    setIsSwitching(true);
    try {
      await switchOrganization({ data: { organizationId } });
      // The remembered project belongs to the old workspace; without this,
      // "/" would open it before the access check bounces back.
      clearLastProjectId();
      window.location.assign("/");
    } catch (error) {
      toast.error(getStandardErrorMessage(error));
      setIsSwitching(false);
    }
  }

  return (
    <UiSidebarFooter className="mx-1.5 gap-0 border-t border-sidebar-border px-1.5 pb-safe">
      <SidebarMenu>
        <SidebarNavLink
          icon={CircleHelp}
          label="Help & knowledge base"
          linkProps={{ to: "/support" }}
        />
        {everyApp ? (
          <SidebarNavLink
            icon={Settings}
            label="Settings"
            linkProps={{ to: "/settings" }}
          />
        ) : email ? (
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    className={navButtonClass}
                    aria-label="Open account menu"
                  />
                }
              >
                <User className="size-4" />
                <span className="truncate" data-ph-mask>
                  {email}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-56">
                {organizations.length > 1 ? (
                  <>
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="flex items-center gap-1.5">
                        <ArrowLeftRight className="size-3" />
                        Organization
                      </DropdownMenuLabel>
                      {organizations.map((organization) => (
                        <DropdownMenuItem
                          key={organization.organizationId}
                          disabled={isSwitching}
                          onClick={() =>
                            void handleSwitchOrganization(
                              organization.organizationId,
                            )
                          }
                        >
                          <span className="truncate">
                            {organization.organizationName}
                          </span>
                          {organization.organizationId ===
                          activeOrganizationId ? (
                            <Check className="ml-auto size-4" />
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <DropdownMenuItem
                  render={
                    <Link to="/settings" onClick={() => setOpenMobile(false)} />
                  }
                >
                  <Settings className="size-4" />
                  Settings
                </DropdownMenuItem>
                {isHostedClientAuthMode() ? (
                  <DropdownMenuItem
                    render={
                      <Link
                        to={BILLING_ROUTE}
                        onClick={() => setOpenMobile(false)}
                      />
                    }
                  >
                    <CreditCard className="size-4" />
                    Billing
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Theme</DropdownMenuLabel>
                  <div className="px-1 pb-1">
                    <ThemePreferenceRadio />
                  </div>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => signOutAndRedirect()}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ) : ready ? (
          <SidebarNavLink
            icon={Settings}
            label="Settings"
            linkProps={{ to: "/settings" }}
          />
        ) : (
          // The account row's slot while the session loads.
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon />
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </UiSidebarFooter>
  );
}
