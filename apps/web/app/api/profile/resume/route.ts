import {
  APPLICATION_DOCUMENTS_BUCKET,
  deleteProfileDocumentSchema,
  DEMO_PROFILE_ID,
  MAX_RESUME_FILE_SIZE_BYTES,
  profileDocumentSchema,
} from "@applyqueue/shared";
import { apiError } from "@/lib/server/errors";
import { hasPdfSignature, sanitizeFilename } from "@/lib/server/files";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Choose a PDF resume to upload." }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return Response.json({ error: "Resume must be a PDF file." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_RESUME_FILE_SIZE_BYTES) {
      return Response.json({ error: "Resume must be between 1 byte and 10 MB." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasPdfSignature(bytes)) {
      return Response.json({ error: "The selected file is not a valid PDF." }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const safeFilename = sanitizeFilename(file.name);
    uploadedPath = `profiles/${DEMO_PROFILE_ID}/resume/${crypto.randomUUID()}-${safeFilename}`;

    const { error: uploadError } = await db.storage
      .from(APPLICATION_DOCUMENTS_BUCKET)
      .upload(uploadedPath, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw new Error(`Resume upload failed: ${uploadError.message}`);

    const { data: previousDocuments, error: previousError } = await db.from("documents").select("*")
      .eq("profile_id", DEMO_PROFILE_ID).eq("type", "RESUME");
    if (previousError) throw previousError;

    const previousPrimaryId = previousDocuments?.find((document) => document.is_primary)?.id as string | undefined;
    const { error: demoteError } = await db.from("documents").update({ is_primary: false })
      .eq("profile_id", DEMO_PROFILE_ID).eq("type", "RESUME").eq("is_primary", true);
    if (demoteError) throw demoteError;

    const { data, error: insertError } = await db.from("documents").insert({
      profile_id: DEMO_PROFILE_ID,
      type: "RESUME",
      storage_path: uploadedPath,
      filename: safeFilename,
      mime_type: "application/pdf",
      file_size_bytes: file.size,
      is_primary: true,
    }).select("*").single();

    if (insertError) {
      if (previousPrimaryId) {
        await db.from("documents").update({ is_primary: true }).eq("id", previousPrimaryId);
      }
      throw insertError;
    }

    const document = profileDocumentSchema.parse(data);
    uploadedPath = null;

    const oldPaths = (previousDocuments ?? []).map((item) => String(item.storage_path)).filter(Boolean);
    const oldIds = (previousDocuments ?? []).map((item) => String(item.id));
    let cleanupWarning: string | null = null;
    if (oldPaths.length > 0) {
      const { error: removeError } = await db.storage.from(APPLICATION_DOCUMENTS_BUCKET).remove(oldPaths);
      if (removeError) {
        cleanupWarning = "The new resume is active, but an older stored file could not be removed.";
      } else if (oldIds.length > 0) {
        const { error: metadataError } = await db.from("documents").delete().in("id", oldIds);
        if (metadataError) cleanupWarning = "The new resume is active, but older metadata could not be removed.";
      }
    }

    return Response.json({ document, cleanupWarning }, { status: 201 });
  } catch (error) {
    if (uploadedPath) {
      await getSupabaseAdmin().storage.from(APPLICATION_DOCUMENTS_BUCKET).remove([uploadedPath]).catch(() => undefined);
    }
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = deleteProfileDocumentSchema.parse(await request.json());
    const db = getSupabaseAdmin();
    const { data, error: lookupError } = await db.from("documents").select("*")
      .eq("id", id).eq("profile_id", DEMO_PROFILE_ID).eq("type", "RESUME").single();
    if (lookupError) throw lookupError;
    const document = profileDocumentSchema.parse(data);

    const { error: removeError } = await db.storage.from(APPLICATION_DOCUMENTS_BUCKET)
      .remove([document.storage_path]);
    if (removeError) throw new Error(`Could not delete stored resume: ${removeError.message}`);

    const { error: deleteError } = await db.from("documents").delete()
      .eq("id", document.id).eq("profile_id", DEMO_PROFILE_ID);
    if (deleteError) throw deleteError;
    return Response.json({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
