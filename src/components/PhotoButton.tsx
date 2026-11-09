"use client";

import { useId } from "react";
import { Icon } from "./Icon";

type Props = {
  label: string;
  busy: boolean;
  busyLabel: string;
  onPhoto: (file: File) => void;
  variant?: "primary" | "secondary" | "yolk";
};

/**
 * A real file input (so it works with keyboards, screen readers and every phone
 * camera) styled as a big button. `capture` opens the rear camera on phones.
 */
export function PhotoButton({ label, busy, busyLabel, onPhoto, variant = "primary" }: Props) {
  const id = useId();
  const className = `btn ${variant === "primary" ? "" : variant}`;
  return (
    <div>
      <input
        id={id}
        className="file-input"
        type="file"
        accept="image/*"
        capture="environment"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPhoto(file);
        }}
      />
      <label htmlFor={id} className={className} aria-disabled={busy || undefined}>
        <Icon name="camera" size={22} />
        {busy ? busyLabel : label}
      </label>
    </div>
  );
}
