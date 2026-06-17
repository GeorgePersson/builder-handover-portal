import Link from "next/link";
import { FileText, Upload } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { StatusBanner } from "@/components/status-banner";
import { getDocuments, getProjects } from "@/lib/server/queries";
import { formatDate } from "@/lib/utils";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; storage?: string; error?: string }>;
}) {
  const params = await searchParams;
  const [documents, projects] = await Promise.all([getDocuments(), getProjects()]);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-700">Phase 3</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Documents</h1>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white"
            href="/builder/documents/new"
          >
            <Upload className="size-4" />
            Upload document
          </Link>
        </header>
        <StatusBanner draft={params.draft} error={params.error} storage={params.storage} />

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4 text-cyan-700" />
              Project document register
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Document</th>
                  <th className="px-5 py-3">Project</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Visibility</th>
                  <th className="px-5 py-3">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((document) => {
                  const project = projects.find((item) => item.id === document.projectId);

                  return (
                    <tr key={document.id}>
                      <td className="px-5 py-4">
                        <p className="font-medium">{document.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{document.size}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{project?.name}</td>
                      <td className="px-5 py-4 text-slate-600">{document.type.replaceAll("_", " ")}</td>
                      <td className="px-5 py-4">
                        <StatusPill variant={document.visibleToClient ? "client_visible" : "private"} />
                      </td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(document.uploadedAt)}</td>
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
