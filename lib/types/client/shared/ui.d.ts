import type { ReactNode } from 'react';
import type { Translate } from '../shared/locales.ts';
/** Button variants. `primary` for the main action, `danger` for destructive,
 * `success` for a state-dependent positive action (e.g. re-migrate). */
export type ButtonVariant = 'default' | 'primary' | 'danger' | 'active' | 'success';
export interface ButtonProps {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: ButtonVariant;
    /** Rendered title (tooltip) / aria-label when the label is an icon. */
    title?: string;
}
/** A single styled button; `type=button` so it never submits a form. */
export declare function Button({ children, onClick, disabled, variant, title }: ButtonProps): import("react").JSX.Element;
export interface ConfirmButtonProps {
    /** Label while idle (e.g. 删除). */
    label: string;
    /** Label once armed (e.g. 再次点击确认删除). */
    confirmLabel: string;
    onConfirm: () => void;
    disabled?: boolean;
    variant?: ButtonVariant;
}
/**
 * A destructive button that needs two clicks, and forgets the first one as
 * soon as the pointer goes anywhere else.
 *
 * The arming state lives here rather than in the panel hooks: three panels need
 * it and each had grown its own copy, which also meant an armed button stayed
 * armed until it was clicked again — leaving a red "click again to confirm" on
 * screen while the user went off and did something else entirely. Clicking
 * anywhere but this button now disarms it, so the row always falls back to its
 * ordinary label.
 */
export declare function ConfirmButton({ label, confirmLabel, onConfirm, disabled, variant, }: ConfirmButtonProps): import("react").JSX.Element;
export interface FieldProps {
    /** Field caption (may include the key name in both languages). */
    label: string;
    children: ReactNode;
}
/** A labelled form row (label wraps the control so clicks focus it). */
export declare function Field({ label, children }: FieldProps): import("react").JSX.Element;
export interface StateRowProps {
    label: string;
    /** Undefined renders as an em dash. */
    value?: string;
}
/** A read-only `label: value` row used by the CLI probe detail pane. */
export declare function StateRow({ label, value }: StateRowProps): import("react").JSX.Element;
export interface SwitchProps {
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
    /** Caption shown next to the track. */
    label: ReactNode;
}
/** Checkbox styled as a toggle switch. */
export declare function Switch({ checked, onChange, disabled, label }: SwitchProps): import("react").JSX.Element;
export interface BadgeProps {
    children: ReactNode;
}
/** Small pill for source labels and subcommand chips. */
export declare function Badge({ children }: BadgeProps): import("react").JSX.Element;
export interface EmptyStateProps {
    /** Primary line (why the list is empty). */
    title: string;
    /** Optional secondary hint. */
    hint?: ReactNode;
}
/** Placeholder shown when a list has no rows. */
export declare function EmptyState({ title, hint }: EmptyStateProps): import("react").JSX.Element;
export interface ErrorTextProps {
    children: ReactNode;
}
/** Inline failure message. */
export declare function ErrorText({ children }: ErrorTextProps): import("react").JSX.Element;
/** Inline loading placeholder. `t` keeps the copy in the plugin dictionary. */
export declare function Loading({ t }: {
    t: Translate;
}): import("react").JSX.Element;
export interface CollapsibleProps {
    /** Caption on the toggle row (what is hidden inside). */
    label: string;
    /** The translated 展开 / 收起 captions. */
    expandLabel: string;
    collapseLabel: string;
    children: ReactNode;
}
/**
 * Long explanatory copy folded into one toggle row, collapsed by default: the
 * reader sees one quiet line until they ask for the details. The toggle keeps
 * a stable two-state caption (展开 → 收起) so the row never reflows when the
 * label text differs in length between languages.
 */
export declare function Collapsible({ label, expandLabel, collapseLabel, children }: CollapsibleProps): import("react").JSX.Element;
//# sourceMappingURL=ui.d.ts.map