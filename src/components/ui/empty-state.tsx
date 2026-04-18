import { ReactNode } from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary";
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  actions?: EmptyStateAction[];
  className?: string;
  compact?: boolean;
}

const EmptyState = ({
  icon: Icon,
  title,
  description,
  actions,
  className,
  compact = false,
}: EmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    className={cn(
      "rounded-xl border-2 border-dashed border-border bg-card text-center",
      compact ? "py-8 px-4 space-y-2" : "py-16 px-6 space-y-3",
      className,
    )}
  >
    {Icon && (
      <Icon
        className={cn(
          "text-muted-foreground/40 mx-auto",
          compact ? "w-6 h-6" : "w-10 h-10",
        )}
      />
    )}
    <h3
      className={cn(
        "font-semibold text-foreground",
        compact ? "text-body-sm" : "text-body font-bold",
      )}
    >
      {title}
    </h3>
    {description && (
      <p className="text-body-sm text-muted-foreground max-w-md mx-auto">
        {description}
      </p>
    )}
    {actions && actions.length > 0 && (
      <div className="flex items-center justify-center gap-2 pt-1">
        {actions.map((a, i) => {
          const base =
            "inline-flex items-center gap-1.5 h-10 px-5 rounded-md text-sm font-semibold transition-all";
          const cls =
            a.variant === "secondary"
              ? `${base} border border-border bg-background text-foreground hover:bg-muted`
              : `${base} bg-primary text-primary-foreground hover:brightness-110`;
          const AIcon = a.icon;
          const content = (
            <>
              {AIcon && <AIcon className="w-4 h-4" />}
              {a.label}
            </>
          );
          if (a.href) {
            return (
              <a key={i} href={a.href} className={cls}>
                {content}
              </a>
            );
          }
          return (
            <button key={i} onClick={a.onClick} className={cls}>
              {content}
            </button>
          );
        })}
      </div>
    )}
  </motion.div>
);

export default EmptyState;
