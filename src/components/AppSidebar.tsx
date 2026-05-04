import { Link, useLocation } from "react-router-dom";
import { Home, DollarSign, Beef, Target, FileText, Settings, Wheat, Baby, RefreshCw, Calculator } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Gastos", url: "/financial", icon: DollarSign },
  { title: "Animais", url: "/animals", icon: Beef },
  { title: "Lotes", url: "/lotes", icon: Target },
  { title: "Rações", url: "/rations", icon: Wheat },
  { title: "Reprodução", url: "/insemination", icon: Baby },
  { title: "Relatórios", url: "/reports", icon: FileText },
  { title: "Simulador", url: "/simulator", icon: Calculator },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar className="border-r border-border/50 bg-sidebar text-sidebar-foreground">
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <div className="px-5 py-8 mb-4 flex items-center gap-3">
            <div className="h-12 w-12 bg-white rounded-sm flex items-center justify-center overflow-hidden shadow-sm border border-border/50">
               <img src="/logo.png" alt="Logo" className="h-full w-full object-cover" />
            </div>
            <span className="font-display font-black text-2xl text-sidebar-foreground tracking-tighter">FazendaControl</span>
          </div>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 space-y-1">
              {navItems.map((item) => {
                const isActive = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} className={`py-5 px-3 rounded-lg transition-colors ${isActive ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted"}`}>
                      <Link to={item.url} className="flex items-center gap-3" onClick={() => setOpenMobile(false)}>
                        <item.icon className="h-5 w-5" />
                        <span className="text-[15px]">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
