import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ExpenseProvider, useExpenses } from "@/lib/ExpenseContext";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Expenses from "@/pages/Expenses";
import Analytics from "@/pages/Analytics";
import SpendingAnalysis from "@/pages/SpendingAnalysis";
import Budgets from "@/pages/Budgets";
import Insights from "@/pages/Insights";
import NotFound from "./pages/NotFound";
import SplashScreen from "@/components/SplashScreen";

const queryClient = new QueryClient();

function AppRoutes() {
  const { isLoading } = useExpenses();
  return (
    <>
      <SplashScreen show={isLoading} />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/spending" element={<SpendingAnalysis />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ExpenseProvider>
          <AppRoutes />
        </ExpenseProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
