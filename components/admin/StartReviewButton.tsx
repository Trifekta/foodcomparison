"use client";

import { useTransition } from "react";
import { PlayCircle } from "lucide-react";
import { startReview } from "@/lib/admin/actions";
import { Button } from "@/components/ui/Button";

export function StartReviewButton({ submissionId }: { submissionId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="md"
      loading={pending}
      loadingLabel="Starting…"
      onClick={() => startTransition(async () => void (await startReview(submissionId)))}
    >
      <PlayCircle aria-hidden="true" className="h-4 w-4" />
      Start review
    </Button>
  );
}
