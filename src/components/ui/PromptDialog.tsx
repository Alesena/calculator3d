"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({ open, initialValue = "", ...rest }: Props) {
  // El contenido se monta recién al abrir: así el input arranca siempre con
  // initialValue sin tener que sincronizarlo desde un efecto.
  if (!open || typeof document === "undefined") return null;
  return <Dialog key={initialValue} initialValue={initialValue} {...rest} />;
}

function Dialog({
  title,
  description,
  label,
  placeholder,
  initialValue = "",
  confirmLabel = "Guardar",
  onConfirm,
  onCancel,
}: Omit<Props, "open">) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Portal: el diálogo trae su propio <form> y el selector de categoría vive
  // dentro del formulario de la calculadora — anidar forms es HTML inválido.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(value);
        }}
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95"
      >
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {label}
          </label>
          <input
            autoFocus
            onFocus={(e) => e.target.select()}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            maxLength={40}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-shadow"
          />
        </div>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-semibold text-white active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
