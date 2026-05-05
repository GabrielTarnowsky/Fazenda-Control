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
    <Sidebar className="border-r border-sidebar-border/50">
      <SidebarContent className="flex flex-col h-full bg-sidebar">
        {/* Logo Section */}
        <div className="px-6 pt-10 pb-8 flex items-center gap-4 border-b border-sidebar-border/30">
          <div className="h-11 w-11 rounded-xl bg-white p-1.5 shadow-2xl ring-1 ring-white/20 flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl text-sidebar-foreground tracking-tight leading-none">FazendaControl</span>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.2em] mt-1.5 opacity-80">Gestão Pecuária</span>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 px-3 py-6">
          <div className="px-4 mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-sidebar-foreground/30">Navegação</p>
          </div>
          <SidebarMenu className="space-y-1">
            {navItems.map((item) => {
              const isActive = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="h-auto p-0 rounded-xl transition-all"
                  >
                    <Link
                      to={item.url}
                      onClick={() => setOpenMobile(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                        isActive
                          ? "bg-emerald-500/15 text-white shadow-lg ring-1 ring-emerald-500/40"
                          : "text-sidebar-foreground/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                        isActive ? "bg-emerald-500/30 shadow-inner" : "bg-white/5"
                      }`}>
                        <item.icon className={`h-4.5 w-4.5 ${isActive ? "text-emerald-300" : "text-current opacity-70"}`} />
                      </div>
                      <span className={`text-[15px] font-bold tracking-tight ${isActive ? "text-white" : ""}`}>
                        {item.title}
                      </span>
                      {isActive && (
                        <div className="ml-auto h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>

        {/* Footer Section */}
        <div className="px-6 py-6 border-t border-sidebar-border/30 bg-black/10">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-sidebar-foreground/20 font-black uppercase tracking-widest">Plataforma Oficial</p>
            <p className="text-[10px] text-sidebar-foreground/40 font-medium italic">v1.4.2 · Fazenda Control</p>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
