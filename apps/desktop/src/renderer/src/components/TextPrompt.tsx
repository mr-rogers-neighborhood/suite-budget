import { Button } from "@suite/ui";
import { useEffect, useState } from "react";
import { Field, TextInput } from "../components/Field";
import { Modal } from "../components/Modal";

export function TextPrompt({
  open,
  title,
  description,
  label,
  initialValue,
  confirmLabel = "Save",
  confirmDisabled,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  initialValue: string;
  confirmLabel?: string;
  confirmDisabled?: (value: string) => boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      width="sm"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={value.trim().length === 0 || (confirmDisabled?.(value.trim()) ?? false)}
            onClick={() => {
              onConfirm(value.trim());
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Field label={label}>
        <TextInput
          value={value}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && value.trim().length > 0) {
              onConfirm(value.trim());
              onOpenChange(false);
            }
          }}
        />
      </Field>
    </Modal>
  );
}
