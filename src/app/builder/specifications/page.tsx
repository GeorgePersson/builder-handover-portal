import Link from "next/link";
import { Bot, FileUp, ScrollText } from "lucide-react";
import { StatusBanner } from "@/components/status-banner";
import { PageHeader } from "@/components/layout/page-header";
import { getProjects, getSpecificationUploads } from "@/lib/server/queries";
import { formatDate } from "@/lib/utils";

export default async function SpecificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; storage?: string; error?: string }>;
}) {
  const params = await searchParams;
  const [specifications, projects] = await Promise.all([getSpecificationUploads(), getProjects()]);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          actions={
            <>
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                href="/builder/specifications/review"
              >
                <Bot className="size-4" />
                Review extracted
              </Link>
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white"
                href="/builder/specifications/new"
              >
                <FileUp className="size-4" />
                Upload spec PDF
              </Link>
            </>
          }
          description="Upload the project specification PDF, extract products/documents/maintenance with AI, then review the generated handover package."
          eyebrow="Specification intelligence"
          icon={ScrollText}
          title="Specification intake"
        />
        <StatusBanner draft={params.draft} error={params.error} storage={params.storage} />

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Specification</th>
                  <th className="px-5 py-3">Project</th>
                  <th className="px-5 py-3">Extracted</th>
                  <th className="px-5 py-3">Matched</th>
                  <th className="px-5 py-3">New</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {specifications.map((specification) => {
                  const project = projects.find((item) => item.id === specification.projectId);

                  return (
                    <tr key={specification.id}>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-950">{specification.fileName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Uploaded {formatDate(specification.uploadedAt)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{project?.name || "Unknown project"}</td>
                      <td className="px-5 py-4 font-medium text-slate-950">{specification.extractedCount}</td>
                      <td className="px-5 py-4 text-emerald-700">{specification.matchedItemCount}</td>
                      <td className="px-5 py-4 text-amber-700">{specification.newItemCount}</td>
                      <td className="px-5 py-4 capitalize text-slate-600">
                        {specification.status.replaceAll("_", " ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
