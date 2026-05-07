import { Link, useLocation } from "react-router-dom";
import { Home, DollarSign, Beef, Target, FileText, Settings, Wheat, Baby, Calculator, User, LogOut } from "lucide-react";
import { store } from "@/lib/store";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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
    <Sidebar className="border-r border-sidebar-border/60 bg-sidebar">
      <SidebarContent className="flex flex-col h-full bg-sidebar">
        {/* Logo */}
        <div className="px-6 py-10 flex items-center gap-3">
          <div className="h-9 w-9 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20 shadow-sm">
             <img src="/logo.png" alt="Logo" className="h-6 w-6 object-contain" />
          </div>
          <span className="font-display font-black text-xl text-sidebar-foreground tracking-tight leading-none">FazendaControl</span>
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
                    className={`group relative h-10 px-4 rounded-xl transition-all duration-200 ${
                      isActive 
                        ? "bg-white text-zinc-900 shadow-sm ring-1 ring-black/5" 
                        : "text-sidebar-foreground/70 hover:text-zinc-900 hover:bg-white/40"
                    }`}
                  >
                    <Link to={item.url} onClick={() => setOpenMobile(false)} className="flex items-center gap-3">
                      <item.icon className={`h-4.5 w-4.5 transition-colors ${isActive ? "text-blue-600" : "group-hover:text-zinc-800"}`} />
                      <span className={`text-[13px] font-semibold ${isActive ? "font-bold text-zinc-900" : ""}`}>
                        {item.title}
                      </span>
                      {isActive && (
                        <div className="absolute left-0 top-2.5 bottom-2.5 w-1 bg-blue-600 rounded-r-full" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>

        <div className="mt-auto p-4 border-t border-white/5">
          <button 
            onClick={() => {
              store.auth.logout();
              window.location.reload();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-xs">Sair da Conta</span>
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
