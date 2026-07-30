import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "sonner";
import { PhotoCaptureSheet } from "@/components/photo-capture";

interface CameraContextValue {
  openCamera: (projectId?: string | null) => void;
  /** Increments after each successful upload batch so galleries can refresh. */
  uploadTick: number;
  enabled: boolean;
}

const CameraContext = createContext<CameraContextValue>({
  openCamera: () => {},
  uploadTick: 0,
  enabled: false,
});

export function useCamera() {
  return useContext(CameraContext);
}

export function CameraProvider({
  workspaceId,
  userId,
  canUpload,
  children,
}: {
  workspaceId: string | null;
  userId: string | null;
  canUpload: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [uploadTick, setUploadTick] = useState(0);

  const enabled = Boolean(workspaceId && userId && canUpload);

  const openCamera = useCallback(
    (id?: string | null) => {
      if (!enabled) {
        toast.error("You don't have permission to upload photos.");
        return;
      }
      setProjectId(id ?? null);
      setOpen(true);
    },
    [enabled],
  );

  const value = useMemo(
    () => ({ openCamera, uploadTick, enabled }),
    [openCamera, uploadTick, enabled],
  );

  return (
    <CameraContext.Provider value={value}>
      {children}
      {enabled && workspaceId && userId && (
        <PhotoCaptureSheet
          open={open}
          onClose={() => setOpen(false)}
          workspaceId={workspaceId}
          userId={userId}
          initialProjectId={projectId}
          onUploaded={() => setUploadTick((t) => t + 1)}
        />
      )}
    </CameraContext.Provider>
  );
}
