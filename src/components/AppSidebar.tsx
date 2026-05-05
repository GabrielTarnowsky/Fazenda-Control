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
    <Sidebar className="border-r-0">
      <SidebarContent
        className="flex flex-col h-full"
        style={{
          background: "linear-gradient(180deg, #0d1f18 0%, #0f2720 60%, #0a1a14 100%)",
        }}
      >
        {/* Logo */}
        <div className="px-5 pt-8 pb-6 flex items-center gap-3 border-b border-white/5">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center overflow-hidden shadow-lg ring-1 ring-white/10">
            <img src="/logo.png" alt="Logo" className="h-full w-full object-cover" />
          </div>
          <div>
            <span className="font-black text-lg text-white tracking-tight leading-none">FazendaControl</span>
            <p className="text-[10px] text-emerald-400/70 font-semibold uppercase tracking-widest mt-0.5">Gestão Pecuária</p>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 px-3 py-4">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 px-3 mb-3">Menu Principal</p>
          <SidebarMenu className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="h-auto p-0 rounded-xl hover:bg-transparent"
                  >
                    <Link
                      to={item.url}
                      onClick={() => setOpenMobile(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                        isActive
                          ? "bg-emerald-500/20 text-emerald-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] ring-1 ring-emerald-500/30"
                          : "text-white/50 hover:text-white/80 hover:bg-white/5"
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                        isActive ? "bg-emerald-500/30" : "bg-white/5"
                      }`}>
                        <item.icon className={`h-4 w-4 ${isActive ? "text-emerald-300" : "text-white/40"}`} />
                      </div>
                      <span className={`text-sm font-semibold ${isActive ? "text-emerald-200" : ""}`}>
                        {item.title}
                      </span>
                      {isActive && (
                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/5">
          <p className="text-[9px] text-white/20 text-center font-medium">v1.4.0 · Fazenda Control</p>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
