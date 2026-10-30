import {
  AlertTriangle,
  Check,
  LoaderCircle,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Priority, TaskStatus } from "../types";

export function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "text";
  size?: "sm" | "md";
  icon?: LucideIcon;
}) {
  return (
    <button
      className={`button button-${variant} button-${size} ${className}`}
      {...props}
    >
      {Icon ? <Icon size={size === "sm" ? 14 : 16} /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      className="icon-button"
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={18} />
    </button>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  width = "560px",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    setTimeout(() => {
      const firstInput = panelRef.current?.querySelector<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >("input, textarea, select");
      firstInput?.focus();
    }, 40);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth: width }}
        ref={panelRef}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <IconButton icon={X} label="关闭" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title = "确认删除？",
  description,
  onCancel,
  onConfirm,
  confirmText = "删除",
}: {
  open: boolean;
  title?: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      width="440px"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            取消
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="confirm-message">
        <span className="confirm-icon">
          <AlertTriangle size={22} />
        </span>
        <p>{description}</p>
      </div>
    </Modal>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">
        {label}
        {required ? <em>*</em> : null}
        {hint ? <small>{hint}</small> : null}
      </span>
      {children}
    </label>
  );
}

export function ProgressBar({
  value,
  color = "green",
  label,
}: {
  value: number;
  color?: "green" | "orange" | "blue";
  label?: string;
}) {
  return (
    <div
      className="progress"
      aria-label={label || `进度 ${Math.round(value)}%`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <span
        className={`progress-fill ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export const taskStatusLabel: Record<TaskStatus, string> = {
  todo: "待开始",
  doing: "进行中",
  partial: "部分完成",
  done: "已完成",
  abandoned: "已放弃",
};

export const priorityLabel: Record<Priority, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      <i />
      {taskStatusLabel[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`priority-badge priority-${priority}`}>
      {priorityLabel[priority]}优先级
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={22} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function SimulatedTag({ label = "模拟 AI" }: { label?: string }) {
  return (
    <span className="simulated-tag">
      <span />
      {label}
    </span>
  );
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          className={value === option.value ? "active" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined ? (
            <span className="segment-count">{option.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

type Toast = { id: number; message: string };
const ToastContext = createContext<(message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = (message: string) => {
    const id = Date.now();
    setToasts((items) => [...items, { id, message }]);
    window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
    }, 2800);
  };

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id}>
            <Check size={16} />
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

export function LoadingButton({
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading: boolean }) {
  return (
    <Button {...props}>
      {loading ? <LoaderCircle className="spin" size={16} /> : null}
      {children}
    </Button>
  );
}

export function InlineForm({
  onSubmit,
  children,
  className = "",
}: {
  onSubmit: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      className={className}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}
