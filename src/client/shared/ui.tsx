/**
 * Primitive UI atoms shared by the three panels.
 *
 * These are deliberately dumb: no API access, no data fetching, no knowledge of
 * skills/MCP/CLI. They exist so the panels stay declarative and the class-name
 * vocabulary lives in exactly one place per widget.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Translate } from '../shared/locales.ts'
import css from '../shared/settings-card.module.css'

/** Button variants. `primary` for the main action, `danger` for destructive,
 * `success` for a state-dependent positive action (e.g. re-migrate). */
export type ButtonVariant = 'default' | 'primary' | 'danger' | 'active' | 'success'

export interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: ButtonVariant
  /** Rendered title (tooltip) / aria-label when the label is an icon. */
  title?: string
}

/** A single styled button; `type=button` so it never submits a form. */
export function Button({ children, onClick, disabled, variant = 'default', title }: ButtonProps) {
  const cls = variant === 'primary' ? css.btnPrimary
    : variant === 'danger' ? css.btnDanger
      : variant === 'active' ? css.btnActive
        : variant === 'success' ? css.btnSuccess
          : css.btn
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  )
}

export interface FieldProps {
  /** Field caption (may include the key name in both languages). */
  label: string
  children: ReactNode
}

/** A labelled form row (label wraps the control so clicks focus it). */
export function Field({ label, children }: FieldProps) {
  return (
    <label className={css.fieldLabel}>
      <span className={css.fieldName}>{label}</span>
      {children}
    </label>
  )
}

export interface StateRowProps {
  label: string
  /** Undefined renders as an em dash. */
  value?: string
}

/** A read-only `label: value` row used by the CLI probe detail pane. */
export function StateRow({ label, value }: StateRowProps) {
  return (
    <div className={css.inline}>
      <div className={css.desc} style={{ minWidth: 92 }}>{label}:</div>
      <div className={css.desc}>{value || '—'}</div>
    </div>
  )
}

export interface SwitchProps {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  /** Caption shown next to the track. */
  label: ReactNode
}

/** Checkbox styled as a toggle switch. */
export function Switch({ checked, onChange, disabled, label }: SwitchProps) {
  return (
    <label className={css.switch}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} role="switch" />
      <span>{label}</span>
    </label>
  )
}

export interface BadgeProps {
  children: ReactNode
}

/** Small pill for source labels and subcommand chips. */
export function Badge({ children }: BadgeProps) {
  return <span className={css.badge}>{children}</span>
}

export interface EmptyStateProps {
  /** Primary line (why the list is empty). */
  title: string
  /** Optional secondary hint. */
  hint?: ReactNode
}

/** Placeholder shown when a list has no rows. */
export function EmptyState({ title, hint }: EmptyStateProps) {
  return (
    <div className={css.empty}>
      <div className={css.emptyTitle}>{title}</div>
      {hint ? <div className={css.emptyHint}>{hint}</div> : null}
    </div>
  )
}

export interface ErrorTextProps {
  children: ReactNode
}

/** Inline failure message. */
export function ErrorText({ children }: ErrorTextProps) {
  return <div className={css.error}>{children}</div>
}

/** Inline loading placeholder. `t` keeps the copy in the plugin dictionary. */
export function Loading({ t }: { t: Translate }) {
  return <div className={css.loading}>{t('loading')}</div>
}

export interface CollapsibleProps {
  /** Caption on the toggle row (what is hidden inside). */
  label: string
  /** The translated 展开 / 收起 captions. */
  expandLabel: string
  collapseLabel: string
  children: ReactNode
}

/**
 * Long explanatory copy folded into one toggle row, collapsed by default: the
 * reader sees one quiet line until they ask for the details. The toggle keeps
 * a stable two-state caption (展开 → 收起) so the row never reflows when the
 * label text differs in length between languages.
 */
export function Collapsible({ label, expandLabel, collapseLabel, children }: CollapsibleProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className={css.collapsible}>
      <button
        type="button"
        className={css.collapsibleHead}
        onClick={() => { setOpen((v) => !v) }}
        aria-expanded={open}
      >
        <span className={css.collapsibleChev} aria-hidden>{open ? '▾' : '▸'}</span>
        <span className={css.collapsibleLabel}>{label}</span>
        <span className={css.collapsibleAction}>{open ? collapseLabel : expandLabel}</span>
      </button>
      {open ? <div className={css.collapsibleBody}>{children}</div> : null}
    </div>
  )
}
