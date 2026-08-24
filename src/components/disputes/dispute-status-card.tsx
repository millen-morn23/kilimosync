import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DisputeRow } from "@/lib/data/disputes";

export function DisputeStatusCard({ dispute }: { dispute: DisputeRow }) {
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-center justify-between">
          <p className="font-medium text-foreground">Reported: {dispute.reason}</p>
          <Badge variant="outline" className="capitalize">
            {dispute.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{dispute.description}</p>
        {dispute.admin_response && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Response:</span> {dispute.admin_response}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
