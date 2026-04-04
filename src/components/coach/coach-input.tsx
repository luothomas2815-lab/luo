"use client";

import { useEffect, useRef, useState } from "react";

type CoachInputProps = {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  focusRequestKey?: number;
};

export function CoachInput({
  onSend,
  disabled = false,
  value,
  onValueChange,
  focusRequestKey,
}: CoachInputProps) {
  const [internalValue, setInternalValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  function setCurrentValue(next: string) {
    if (!isControlled) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  }

  async function submit() {
    const trimmed = currentValue.trim();
    if (!trimmed || disabled) return;
    setCurrentValue("");
    await onSend(trimmed);
  }

  useEffect(() => {
    if (focusRequestKey === undefined) {
      return;
    }
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [focusRequestKey]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <textarea
        ref={textareaRef}
        data-testid="coach-input-textarea"
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
        rows={3}
        placeholder="输入你想问 AI 教练的问题"
        disabled={disabled}
        className="min-h-24 w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 disabled:bg-zinc-50"
      />
      <div className="mt-3 flex justify-end">
        <button
          data-testid="coach-send-button"
          type="button"
          onClick={() => void submit()}
          disabled={disabled || !currentValue.trim()}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {disabled ? "发送中..." : "发送"}
        </button>
      </div>
    </div>
  );
}
