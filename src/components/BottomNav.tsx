import { Home, List, Plus, DollarSign } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const items = [
  { path: "/", icon: Home, label: "Início" },
  { path: "/animals", icon: List, label: "Rebanho" },
  { path: "/animals/new", icon: Plus, label: "Novo" },
  { path: "/financial", icon: DollarSign, label: "Finanças" },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t flex justify-around items-center h-16 shadow-lg">
      {items.map((item) => {
        const active = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            {item.path === "/animals/new" ? (
              <div className="bg-primary rounded-full p-2 -mt-4 shadow-md">
                <item.icon className="h-5 w-5 text-primary-foreground" />
              </div>
            ) : (
              <item.icon className="h-5 w-5" />
            )}
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
