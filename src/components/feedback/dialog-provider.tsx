"use client";

import { AlertCircle, Check, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type DialogVariant = "success" | "info" | "warning" | "danger" | "loading";
type DialogOptions = {
  variant: DialogVariant;
  title: string;
  description: string;
  primaryAction?: { label: string; onClick?: () => void };
  secondaryAction?: { label: string; onClick?: () => void };
  children?: ReactNode;
  dismissible?: boolean;
};
type DialogApi = {
  show: (options: DialogOptions) => void;
  close: () => void;
  confirm: (options: Omit<DialogOptions, "variant"> & { variant?: DialogVariant }) => Promise<boolean>;
};

const DialogContext = createContext<DialogApi | null>(null);

export function useStatusDialog(): DialogApi {
  const context = useContext(DialogContext);
  if (!context) throw new Error("useStatusDialog must be used within DialogProvider.");
  return context;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolverRef = useRef<((result: boolean) => void) | null>(null);
  const [options, setOptions] = useState<DialogOptions | null>(null);

  useEffect(() => {
    const element = dialogRef.current;
    if (options && element && !element.open) element.showModal();
    if (!options && element?.open) element.close();
  }, [options]);

  const closeWithResult = useCallback((result: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOptions(null);
    resolve?.(result);
  }, []);

  const api: DialogApi = {
    show: (next) => {
      resolverRef.current = null;
      setOptions(next);
    },
    close: () => closeWithResult(false),
    confirm: (next) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setOptions({ ...next, variant: next.variant ?? "warning" });
      }),
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="status-dialog-title"
        aria-describedby="status-dialog-description"
        className="fixed inset-0 m-auto max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[440px] overflow-y-auto rounded-[28px] border border-[var(--ps-grey-200)] bg-white p-0 text-[var(--ps-green-900)] shadow-2xl backdrop:bg-[rgb(17_43_0_/_40%)] backdrop:backdrop-blur-md"
        onCancel={(event) => {
          if (options?.variant === "loading" || options?.dismissible === false) event.preventDefault();
          else closeWithResult(false);
        }}
        onClose={() => {
          if (resolverRef.current) closeWithResult(false);
        }}
        aria-live="polite"
      >
        {options ? (
          <div className="relative p-6 sm:p-8">
            {options.variant !== "loading" ? (
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => closeWithResult(false)}
                className="absolute top-5 right-5 inline-flex size-10 items-center justify-center rounded-full hover:bg-[var(--ps-grey-200)]/40"
              >
                <X size={18} />
              </button>
            ) : null}
            <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-[var(--ps-green-400)] text-[var(--ps-green-900)]">
              {options.variant === "success" ? <Check size={26} /> : null}
              {options.variant === "info" ? <Info size={26} /> : null}
              {options.variant === "warning" ? <TriangleAlert size={26} /> : null}
              {options.variant === "danger" ? <AlertCircle size={26} className="text-[var(--ps-danger)]" /> : null}
              {options.variant === "loading" ? <LoaderCircle size={26} className="animate-spin" /> : null}
            </div>
            <h2 id="status-dialog-title" className="font-display pr-8 text-3xl leading-tight">
              {options.title}
            </h2>
            <p id="status-dialog-description" className="mt-2 text-[var(--ps-grey-600)]">
              {options.description}
            </p>
            {options.children}
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {options.secondaryAction ? (
                <button
                  type="button"
                  className="min-h-12 rounded-full border border-[var(--ps-grey-200)] px-5"
                  onClick={() => {
                    options.secondaryAction?.onClick?.();
                    closeWithResult(false);
                  }}
                >
                  {options.secondaryAction.label}
                </button>
              ) : null}
              {options.primaryAction ? (
                <button
                  type="button"
                  className="min-h-12 rounded-full bg-[var(--ps-green-400)] px-5 text-[var(--ps-green-900)]"
                  onClick={() => {
                    options.primaryAction?.onClick?.();
                    closeWithResult(true);
                  }}
                >
                  {options.primaryAction.label}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </DialogContext.Provider>
  );
}
