import { Link, useLocation } from "react-router-dom";
import { Home, DollarSign, Beef, Target, FileText, Settings, Wheat, Baby, Calculator } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
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
  { title: "Simulador", url: "/simulator", icon: Calculator },
  { title: "Relatórios", url: "/reports", icon: FileText },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar className="border-r border-sidebar-border/30">
      <SidebarContent className="flex flex-col h-full bg-sidebar">
        {/* Logo Section */}
        <div className="px-5 pt-8 pb-6 flex items-center gap-3 border-b border-sidebar-border/40">
          <div className="h-9 w-9 rounded-lg bg-white p-1 shadow-sm ring-1 ring-black/5 flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base text-sidebar-foreground tracking-tight leading-none">FazendaControl</span>
            <span className="text-[9px] text-emerald-600/70 font-bold uppercase tracking-[0.1em] mt-1">Gestão Pecuária</span>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 px-3 py-4">
          <div className="px-3 mb-3">
            <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/30">Navegação</p>
          </div>
          <SidebarMenu className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="h-auto p-0 rounded-lg transition-all"
                  >
                    <Link
                      to={item.url}
                      onClick={() => setOpenMobile(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 ${
                        isActive
                          ? "bg-emerald-500/20 text-emerald-900 shadow-sm"
                          : "text-sidebar-foreground/60 hover:text-emerald-800 hover:bg-emerald-500/5"
                      }`}
                    >
                      <div className={`h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
                        isActive ? "bg-emerald-500/10" : "bg-transparent"
                      }`}>
                        <item.icon className={`h-4 w-4 ${isActive ? "text-emerald-700" : "text-sidebar-foreground/40"}`} />
                      </div>
                      <span className={`text-[13px] font-semibold tracking-tight ${isActive ? "text-emerald-900" : ""}`}>
                        {item.title}
                      </span>
                      {isActive && (
                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500/40" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>

        {/* Footer Section */}
        <div className="px-5 py-4 border-t border-sidebar-border/30">
          <div className="flex flex-col gap-0.5 opacity-40">
            <p className="text-[8px] text-sidebar-foreground font-bold uppercase tracking-widest text-center">v1.4.4</p>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
