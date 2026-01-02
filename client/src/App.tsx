import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import AdminDashboard from "@/pages/admin-dashboard";
import BranchDashboard from "@/pages/branch-dashboard";
import StudentDashboard from "@/pages/student-dashboard";
import ParentDashboard from "@/pages/parent-dashboard";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function RoleBasedDashboard() {
  const { user } = useAuth();

  switch (user?.role) {
    case "admin":
      return <AdminDashboard />;
    case "branch":
      return <BranchDashboard />;
    case "student":
      return <StudentDashboard />;
    case "parent":
      return <ParentDashboard />;
    default:
      return <NotFound />;
  }
}

function Router() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && location === "/login") {
    return <Redirect to="/" />;
  }

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        <ProtectedRoute>
          <RoleBasedDashboard />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
