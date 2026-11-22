import { dismiss, useToast } from "../lib/toast";

/** The app's toast (offline / online, update ready). */
export function ToastView() {
  const toast = useToast();
  if (!toast) return null;
  return (
    <div className="app-toast" role="status" aria-live="polite" key={toast.id}>
      <span>{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            dismiss();
            toast.onAction?.();
          }}
        >
          {toast.action}
        </button>
      )}
    </div>
  );
}
