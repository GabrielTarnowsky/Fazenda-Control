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
    <Sidebar className="border-r border-sidebar-border/60">
      <SidebarContent className="flex flex-col h-full bg-sidebar">
        {/* Logo */}
        <div className="px-6 py-10 flex items-center gap-3">
          <div className="h-9 w-9 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20 shadow-sm">
             <img src="/logo.png" alt="Logo" className="h-6 w-6 object-contain" />
          </div>
          <div>
            <span className="font-display font-black text-lg text-sidebar-foreground tracking-tight block leading-none">FazendaControl</span>
            <span className="text-[9px] font-bold text-primary/60 uppercase tracking-[0.15em] mt-1.5">Administração</span>
          </div>
        </div>

        {/* Menu */}
        <div className="flex-1 px-3">
          <SidebarMenu className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className={`group relative h-11 px-4 rounded-xl transition-all duration-200 ${
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                    }`}
                  >
                    <Link to={item.url} onClick={() => setOpenMobile(false)} className="flex items-center gap-3">
                      <item.icon className={`h-5 w-5 transition-colors ${isActive ? "text-primary" : "group-hover:text-sidebar-foreground"}`} />
                      <span className={`text-[14px] font-semibold ${isActive ? "font-bold" : ""}`}>
                        {item.title}
                      </span>
                      {isActive && (
                        <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r-full" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>

        {/* User / Footer */}
        <div className="p-4 mt-auto">
          <div className="bg-sidebar-accent/30 rounded-2xl p-4 border border-sidebar-border/50">
            <p className="text-[10px] font-black text-sidebar-foreground/40 uppercase tracking-widest text-center">Gestão Inteligente</p>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
