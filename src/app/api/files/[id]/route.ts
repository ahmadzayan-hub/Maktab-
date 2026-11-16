import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/db/supabase-server";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Next 15: route params are asynchronous.
  const { id } = await params;
  const { user, supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data: file } = await supabase
    .from("private_files")
    .select("storage_path, user_id")
    .eq("id", id)
    .single();

  if (!file || file.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (file.storage_path) {
    await supabase.storage.from("private-files").remove([file.storage_path]);
  }

  await supabase.from("document_chunks").delete().eq("file_id", id);
  await supabase.from("private_files").delete().eq("id", id);

  return new NextResponse(null, { status: 204 });
}
