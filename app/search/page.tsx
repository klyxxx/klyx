"use client";

import { Suspense, useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

// KLYX_SEARCH_COMPATIBILITY_REDIRECT

function SearchCompatibilityRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  useEffect(() => {
    const params = new URLSearchParams(queryString);
    const legacyStart = params.get("start")?.trim() ?? "";
    const time = params.get("time")?.trim() ?? "";

    if (legacyStart && !time) {
      params.set("time", legacyStart);
    }

    const nextQuery = params.toString();
    router.replace(
      nextQuery ? `/recommendations?${nextQuery}` : "/recommendations"
    );
  }, [queryString, router]);

  return (
    <main className="klyx-page">
      <div className="mx-auto grid min-h-64 max-w-4xl place-items-center rounded-3xl border border-border bg-card">
        <LoaderCircle className="animate-spin text-blue-600" />
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="klyx-page">
          <div className="mx-auto grid min-h-64 max-w-4xl place-items-center rounded-3xl border border-border bg-card">
            <LoaderCircle className="animate-spin text-blue-600" />
          </div>
        </main>
      }
    >
      <SearchCompatibilityRedirect />
    </Suspense>
  );
}
