"use client";

import Link from "next/link";
import { LoaderCircle } from "lucide-react";

export type AssistantAction = {
  href: string;
  label: string;
};

export type UserTurnModel = {
  id: string;
  role: "user";
  content: string;
};

export type KlyxTurnModel = {
  id: string;
  role: "assistant";
  content: string;
  variant?: "text" | "thinking" | "error" | "groundedAction";
  action?: AssistantAction;
};

export type ReadyTurnModel = {
  id: string;
  role: "ready";
  summary: {
    service: string;
    city: string;
    date: string;
    time: string;
  };
  budget: number | null;
};

export type AssistantTurnModel = UserTurnModel | KlyxTurnModel | ReadyTurnModel;

export function UserTurn({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] rounded-2xl rounded-br-md bg-[#2563EB] px-4 py-3 text-sm leading-6 text-white sm:max-w-[72%]">
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

export function KlyxTurn({
  content,
  variant = "text",
  action,
}: {
  content: string;
  variant?: KlyxTurnModel["variant"];
  action?: AssistantAction;
}) {
  if (variant === "thinking") {
    return (
      <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
        <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
        <span>{content}</span>
      </div>
    );
  }

  return (
    <div className="max-w-[92%] text-sm leading-7 text-foreground sm:max-w-[82%]">
      <p className="whitespace-pre-wrap">{content}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function ClarificationTurn({ content }: { content: string }) {
  return <KlyxTurn content={content} variant="text" />;
}
