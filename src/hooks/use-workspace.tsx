import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Workspace = {
  id: string;
  name: string;
  owner_id: string;
  slug: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  workspace_id: string;
  created_at: string;
};

type WorkspaceContextType = {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeWorkspace: Workspace | null;
  products: Product[];
  activeProductId: string | null;
  activeProduct: Product | null;
  isLoading: boolean;
  setActiveWorkspaceId: (id: string | null) => void;
  setActiveProductId: (id: string | null) => void;
  refreshWorkspaces: () => void;
  refreshProducts: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const WORKSPACE_STORAGE_KEY = "cadence.workspace.active";
const PRODUCT_STORAGE_KEY = "cadence.product.active";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkspaceId, setActiveWorkspaceState] = useState<string | null>(null);
  const [activeProductId, setActiveProductState] = useState<string | null>(null);

  // 1. Fetch workspaces the user is a member of (RLS handles membership filtering)
  const {
    data: workspaces = [],
    isLoading: isLoadingWorkspaces,
    refetch: refreshWorkspaces,
  } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // 2. Fetch products for the active workspace
  const {
    data: products = [],
    isLoading: isLoadingProducts,
    refetch: refreshProducts,
  } = useQuery<Product[]>({
    queryKey: ["products", activeWorkspaceId],
    queryFn: async () => {
      if (!activeWorkspaceId) return [];
      const { data, error } = await supabase
        .from("projects") // the physical table name is projects (represents products)
        .select("id, name, workspace_id, created_at")
        .eq("workspace_id", activeWorkspaceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Product[];
    },
    enabled: !!activeWorkspaceId,
  });

  // Initialize workspace and product from localStorage or defaults
  useEffect(() => {
    if (isLoadingWorkspaces) return;

    const storedWorkspace = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (storedWorkspace && workspaces.some((w) => w.id === storedWorkspace)) {
      setActiveWorkspaceState(storedWorkspace);
    } else if (workspaces.length > 0) {
      const defaultWorkspace = workspaces[0].id;
      setActiveWorkspaceState(defaultWorkspace);
      localStorage.setItem(WORKSPACE_STORAGE_KEY, defaultWorkspace);
    } else {
      setActiveWorkspaceState(null);
    }
  }, [workspaces, isLoadingWorkspaces]);

  // Initialize product when products change
  useEffect(() => {
    if (isLoadingProducts || !activeWorkspaceId) return;

    const storedProduct = localStorage.getItem(`${PRODUCT_STORAGE_KEY}.${activeWorkspaceId}`);
    if (storedProduct && products.some((p) => p.id === storedProduct)) {
      setActiveProductState(storedProduct);
    } else if (products.length > 0) {
      const defaultProduct = products[0].id;
      setActiveProductState(defaultProduct);
      localStorage.setItem(`${PRODUCT_STORAGE_KEY}.${activeWorkspaceId}`, defaultProduct);
    } else {
      setActiveProductState(null);
    }
  }, [products, isLoadingProducts, activeWorkspaceId]);

  const setActiveWorkspaceId = (id: string | null) => {
    setActiveWorkspaceState(id);
    if (id) {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    }
    // Clear product when workspace switches
    setActiveProductState(null);
  };

  const setActiveProductId = (id: string | null) => {
    setActiveProductState(id);
    if (id && activeWorkspaceId) {
      localStorage.setItem(`${PRODUCT_STORAGE_KEY}.${activeWorkspaceId}`, id);
    } else if (activeWorkspaceId) {
      localStorage.removeItem(`${PRODUCT_STORAGE_KEY}.${activeWorkspaceId}`);
    }
  };

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;
  const activeProduct = products.find((p) => p.id === activeProductId) || null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspaceId,
        activeWorkspace,
        products,
        activeProductId,
        activeProduct,
        isLoading: isLoadingWorkspaces || isLoadingProducts,
        setActiveWorkspaceId,
        setActiveProductId,
        refreshWorkspaces,
        refreshProducts,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
