import type { Register, RegisterField } from "$lib/domain";
import { readPreference, writePreference } from "$lib/preferences";

import { resetRegisterValue, valueMask } from "./register-bits";

export type ValueMode = "binary" | "hex" | "decimal" | "enum";

function savedValueMode(): ValueMode {
  const value = readPreference("peakrdl-value-mode");
  if (value === "binary" || value === "hex" || value === "decimal" || value === "enum") {
    return value;
  }
  return "enum";
}

export class RegisterCalculatorState {
  valueMode = $state<ValueMode>(savedValueMode());
  encodedDraft = $state("");
  encodedError = $state("");
  fieldDrafts = $state<Record<string, string>>({});
  fieldErrors = $state<Record<string, string>>({});
  copiedEncodedValue = $state(false);

  private registerValues = $state(new Map<string, bigint>());

  constructor(registers: ReadonlyArray<Register>) {
    this.registerValues = new Map(
      registers.map((register) => [register.id, resetRegisterValue(register)]),
    );
    if (registers[0]) this.selectRegister(registers[0]);
  }

  registerValue(register: Register): bigint {
    return this.registerValues.get(register.id) ?? resetRegisterValue(register);
  }

  fieldValue(register: Register, field: RegisterField): bigint {
    return (this.registerValue(register) >> BigInt(field.low)) & valueMask(field.width);
  }

  formatNumericValue(value: bigint, width: number, mode: "binary" | "hex" | "decimal"): string {
    if (mode === "decimal") return value.toString(10);
    if (mode === "binary") {
      return `0b${value.toString(2).padStart(Math.max(1, width), "0")}`;
    }
    return `0x${value.toString(16).padStart(Math.max(1, Math.ceil(width / 4)), "0")}`;
  }

  matchingEnumMember(field: RegisterField, value: bigint) {
    return field.enum?.members.find((member) => BigInt(member.value) === value);
  }

  fieldEditorValue(register: Register, field: RegisterField): string {
    return (
      this.fieldDrafts[field.id] ??
      this.formatNumericValue(this.fieldValue(register, field), field.width, this.numericMode())
    );
  }

  fieldResetLabel(field: RegisterField): string {
    if (!field.reset) return "No reset";
    const value = BigInt(field.reset.value);
    if (this.valueMode === "enum") {
      const member = this.matchingEnumMember(field, value);
      if (member) return `Reset: ${member.displayName}`;
    }
    return `Reset: ${this.formatNumericValue(value, field.width, this.numericMode())}`;
  }

  selectRegister(register: Register): void {
    this.encodedDraft = this.formatRegisterValue(register, this.registerValue(register));
    this.encodedError = "";
    this.fieldDrafts = {};
    this.fieldErrors = {};
  }

  setValueMode(mode: ValueMode, register: Register): void {
    this.valueMode = mode;
    writePreference("peakrdl-value-mode", mode);
    this.selectRegister(register);
  }

  updateEncodedValue(register: Register, input: string): void {
    this.encodedDraft = input;
    try {
      const value = this.parseNumericValue(input, register.width);
      this.setRegisterValue(register, value);
      this.encodedError = "";
      this.fieldDrafts = {};
      this.fieldErrors = {};
    } catch (error) {
      this.encodedError = error instanceof Error ? error.message : "Invalid value.";
    }
  }

  updateFieldValue(register: Register, field: RegisterField, value: bigint): void {
    const shiftedMask = valueMask(field.width) << BigInt(field.low);
    const encoded =
      (this.registerValue(register) & ~shiftedMask) |
      ((value & valueMask(field.width)) << BigInt(field.low));
    this.setRegisterValue(register, encoded);
    this.encodedDraft = this.formatRegisterValue(register, encoded);
  }

  updateFieldDraft(register: Register, field: RegisterField, input: string): void {
    this.fieldDrafts = { ...this.fieldDrafts, [field.id]: input };
    try {
      const value = this.parseNumericValue(input, field.width);
      this.updateFieldValue(register, field, value);
      const remaining = { ...this.fieldErrors };
      delete remaining[field.id];
      this.fieldErrors = remaining;
    } catch (error) {
      this.fieldErrors = {
        ...this.fieldErrors,
        [field.id]: error instanceof Error ? error.message : "Invalid value.",
      };
    }
  }

  reset(register: Register): void {
    this.setRegisterValue(register, resetRegisterValue(register));
    this.selectRegister(register);
  }

  async copyEncodedValue(register: Register): Promise<void> {
    const value = this.formatRegisterValue(register, this.registerValue(register));
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    this.copiedEncodedValue = true;
    window.setTimeout(() => (this.copiedEncodedValue = false), 700);
  }

  private numericMode(): "binary" | "hex" | "decimal" {
    if (this.valueMode === "binary" || this.valueMode === "decimal") return this.valueMode;
    return "hex";
  }

  private formatRegisterValue(register: Register, value: bigint): string {
    return this.formatNumericValue(value, register.width, this.numericMode());
  }

  private parseNumericValue(input: string, width: number): bigint {
    const mode = this.numericMode();
    const value = input.trim().replaceAll("_", "");
    const valid =
      mode === "decimal"
        ? /^\d+$/.test(value)
        : mode === "binary"
          ? /^(?:0b)?[01]+$/i.test(value)
          : /^(?:0x)?[\da-f]+$/i.test(value);
    if (!valid) {
      throw new Error(
        mode === "decimal"
          ? "Enter a decimal value."
          : mode === "binary"
            ? "Enter a binary value."
            : "Enter a hexadecimal value.",
      );
    }
    const needsPrefix =
      (mode === "hex" && !value.toLowerCase().startsWith("0x")) ||
      (mode === "binary" && !value.toLowerCase().startsWith("0b"));
    const parsed = BigInt(needsPrefix ? `${mode === "binary" ? "0b" : "0x"}${value}` : value);
    if (parsed > valueMask(width)) throw new Error(`Value exceeds ${width} bits.`);
    return parsed;
  }

  private setRegisterValue(register: Register, value: bigint): void {
    const next = new Map(this.registerValues);
    next.set(register.id, value & valueMask(register.width));
    this.registerValues = next;
  }
}
