import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarLayout } from "./components/SidebarLayout";
import Dashboard from "./pages/Dashboard";
import Animals from "./pages/Animals";
import AddAnimal from "./pages/AddAnimal";
import AnimalDetail from "./pages/AnimalDetail";
import Lotes from "./pages/Lotes";
import LoteDetail from "./pages/LoteDetail";
import AddEvent from "./pages/AddEvent";
import FinancialPage from "./pages/FinancialPage";
import Rations from "./pages/Rations";
import Ingredients from "./pages/Ingredients";
import AddRation from "./pages/AddRation";
import AddFeedingLog from "./pages/AddFeedingLog";
import Reports from "./pages/Reports";
import Insemination from "./pages/Insemination";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { store } from "./lib/store";

const queryClient = new QueryClient();

// Componente para proteger rotas privadas
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = store.auth.getCurrentUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const App = () => {
  useEffect(() => {
    store.sync().then(success => {
      if (success) console.log("Dados sincronizados com sucesso");
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Rotas Públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Rotas Protegidas */}
            <Route element={<SidebarLayout />}>
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/animals" element={<ProtectedRoute><Animals /></ProtectedRoute>} />
              <Route path="/animals/new" element={<ProtectedRoute><AddAnimal /></ProtectedRoute>} />
              <Route path="/animals/:id/edit" element={<ProtectedRoute><AddAnimal /></ProtectedRoute>} />
              <Route path="/animals/:id" element={<ProtectedRoute><AnimalDetail /></ProtectedRoute>} />
              <Route path="/lotes" element={<ProtectedRoute><Lotes /></ProtectedRoute>} />
              <Route path="/lotes/:nome" element={<ProtectedRoute><LoteDetail /></ProtectedRoute>} />
              <Route path="/events/new" element={<ProtectedRoute><AddEvent /></ProtectedRoute>} />
              <Route path="/events/:id/edit" element={<ProtectedRoute><AddEvent /></ProtectedRoute>} />
              <Route path="/financial" element={<ProtectedRoute><FinancialPage /></ProtectedRoute>} />
              <Route path="/rations" element={<ProtectedRoute><Rations /></ProtectedRoute>} />
              <Route path="/rations/new" element={<ProtectedRoute><AddRation /></ProtectedRoute>} />
              <Route path="/rations/:id/edit" element={<ProtectedRoute><AddRation /></ProtectedRoute>} />
              <Route path="/ingredients" element={<ProtectedRoute><Ingredients /></ProtectedRoute>} />
              <Route path="/rations/log/new" element={<ProtectedRoute><AddFeedingLog /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/insemination" element={<ProtectedRoute><Insemination /></ProtectedRoute>} />
              <Route path="*" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
