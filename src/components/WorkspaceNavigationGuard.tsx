import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { useLinkStore } from "@/store/useLinkStore";
import {
  WorkspaceNavigationGuardContext,
  type NavigationAction,
} from "@/hooks/useWorkspaceNavigationGuard";

export function WorkspaceNavigationGuardProvider({
  children,
}: {
  children: ReactNode;
}) {
  const hasUnsavedChanges = useLinkStore((state) => state.hasUnsavedChanges);
  const saveCurrentFile = useLinkStore((state) => state.saveCurrentFile);
  const [pendingAction, setPendingAction] = useState<NavigationAction | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runAction = useCallback(async (action: NavigationAction) => {
    await action();
  }, []);

  const guardNavigation = useCallback(
    (action: NavigationAction) => {
      if (isResolving) return;

      if (!hasUnsavedChanges) {
        void runAction(action).catch((error) => {
          console.error("Failed to navigate workspace", error);
        });
        return;
      }

      setErrorMessage(null);
      setPendingAction(() => action);
    },
    [hasUnsavedChanges, isResolving, runAction],
  );

  const closeDialog = useCallback(() => {
    if (isResolving) return;
    setErrorMessage(null);
    setPendingAction(null);
  }, [isResolving]);

  const handleSave = useCallback(async () => {
    if (!pendingAction || isResolving) return;

    setIsResolving(true);
    try {
      await saveCurrentFile();
      const action = pendingAction;
      setErrorMessage(null);
      await runAction(action);
      setPendingAction(null);
    } catch (error) {
      console.error("Failed to save before navigation", error);
      setErrorMessage("Could not save changes. Try again or discard them.");
    } finally {
      setIsResolving(false);
    }
  }, [isResolving, pendingAction, runAction, saveCurrentFile]);

  const handleDiscard = useCallback(async () => {
    if (!pendingAction || isResolving) return;

    setIsResolving(true);
    try {
      const action = pendingAction;
      setErrorMessage(null);
      await runAction(action);
      setPendingAction(null);
    } catch (error) {
      console.error("Failed to discard changes before navigation", error);
      setErrorMessage("Could not switch documents. Try again.");
    } finally {
      setIsResolving(false);
    }
  }, [isResolving, pendingAction, runAction]);

  const contextValue = useMemo(
    () => ({
      guardNavigation,
      isNavigationBlocked: Boolean(pendingAction) || isResolving,
    }),
    [guardNavigation, isResolving, pendingAction],
  );

  return (
    <WorkspaceNavigationGuardContext.Provider value={contextValue}>
      {children}
      <DialogPrimitive.Root
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-xs" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-border bg-popover p-5 text-popover-foreground shadow-lg">
            <div className="space-y-1">
              <DialogPrimitive.Title className="text-base font-medium text-foreground">
                Unsaved canvas changes
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                Save changes to this PDF canvas before switching, or discard them.
              </DialogPrimitive.Description>
            </div>
            {errorMessage && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeDialog}
                disabled={isResolving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleDiscard()}
                disabled={isResolving}
              >
                Discard
              </Button>
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={isResolving}
              >
                {isResolving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </WorkspaceNavigationGuardContext.Provider>
  );
}
