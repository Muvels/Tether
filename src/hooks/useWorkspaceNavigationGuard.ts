import { createContext, useContext } from "react";

export type NavigationAction = () => Promise<void> | void;

export interface WorkspaceNavigationGuardValue {
  guardNavigation: (action: NavigationAction) => void;
  isNavigationBlocked: boolean;
}

export const WorkspaceNavigationGuardContext =
  createContext<WorkspaceNavigationGuardValue | null>(null);

export function useWorkspaceNavigationGuard() {
  const context = useContext(WorkspaceNavigationGuardContext);
  if (!context) {
    throw new Error(
      "useWorkspaceNavigationGuard must be used within WorkspaceNavigationGuardProvider",
    );
  }
  return context;
}
