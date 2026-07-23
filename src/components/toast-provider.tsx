"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { createId } from "@/lib/utils";

type ToastTone = "success" | "info" | "danger";

interface ToastMessage {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const dismiss = useCallback((id: string) => setMessages((current) => current.filter((message) => message.id !== id)), []);
  const notify = useCallback((message: string, tone: ToastTone = "success") => {
    const id = createId("toast");
    setMessages((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), 3_500);
  }, [dismiss]);
  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-label="Benachrichtigungen">
        {messages.map((message) => {
          const Icon = message.tone === "danger" ? XCircle : message.tone === "info" ? Info : CheckCircle2;
          return (
            <div className={`toast toast-${message.tone}`} role="status" key={message.id}>
              <Icon size={17} aria-hidden="true" />
              <span>{message.message}</span>
              <Button variant="ghost" size="icon" onClick={() => dismiss(message.id)} aria-label="Benachrichtigung schließen"><X size={15} /></Button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast muss innerhalb des ToastProvider verwendet werden.");
  return context;
}
