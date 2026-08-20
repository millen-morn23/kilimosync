import { BadgeCheck, Clock, ShieldAlert, ShieldX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { VerificationStatus } from "@/lib/supabase/types";

const CONFIG: Record<VerificationStatus, { label: string; variant: "success" | "warning" | "destructive" | "outline"; icon: typeof BadgeCheck }> = {
  verified: { label: "Verified", variant: "success", icon: BadgeCheck },
  pending: { label: "Pending review", variant: "warning", icon: Clock },
  rejected: { label: "Not approved", variant: "destructive", icon: ShieldX },
  suspended: { label: "Suspended", variant: "destructive", icon: ShieldAlert },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const { label, variant, icon: Icon } = CONFIG[status];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="size-3.5" />
      {label}
    </Badge>
  );
}
