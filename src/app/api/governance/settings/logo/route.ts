// src/app/api/governance/settings/logo/route.ts
import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GovernanceTechnicalRole } from "@/types/governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGO_BUCKET = "organization-logos";
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

function canManageSettings(technicalRole: GovernanceTechnicalRole | string) {
  return ["owner", "admin", "manager"].includes(technicalRole);
}

function getLogoExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";

  const originalExtension = file.name.split(".").pop()?.toLowerCase();

  return originalExtension || "png";
}

async function ensureLogoBucket() {
  const admin = createSupabaseAdminClient();

  const { error } = await admin.storage.createBucket(LOGO_BUCKET, {
    public: true,
    fileSizeLimit: MAX_LOGO_SIZE_BYTES,
    allowedMimeTypes: Array.from(allowedMimeTypes),
  });

  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.warn("[governance/settings/logo] Bucket não criado:", error.message);
  }

  return admin;
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Sessão expirada. Faça login novamente." },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const organizationId = String(formData.get("organizationId") ?? "");
    const logo = formData.get("logo");

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organização não informada." },
        { status: 400 },
      );
    }

    if (!(logo instanceof File)) {
      return NextResponse.json(
        { error: "Arquivo da logo não enviado." },
        { status: 400 },
      );
    }

    if (!allowedMimeTypes.has(logo.type)) {
      return NextResponse.json(
        { error: "Formato inválido. Use PNG, JPG, WEBP ou SVG." },
        { status: 400 },
      );
    }

    if (logo.size > MAX_LOGO_SIZE_BYTES) {
      return NextResponse.json(
        { error: "A logo deve ter no máximo 2 MB." },
        { status: 400 },
      );
    }

    const admin = await ensureLogoBucket();

    const { data: membership, error: membershipError } = await admin
      .from("organization_members")
      .select("id, organization_id, user_id, technical_role, status")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle<{
        id: string;
        organization_id: string;
        user_id: string;
        technical_role: GovernanceTechnicalRole;
        status: string;
      }>();

    if (membershipError) {
      console.error(
        "[governance/settings/logo] Erro ao validar permissão:",
        membershipError,
      );

      return NextResponse.json(
        { error: "Não foi possível validar sua permissão." },
        { status: 500 },
      );
    }

    if (!membership || !canManageSettings(membership.technical_role)) {
      return NextResponse.json(
        { error: "Você não tem permissão para alterar a logo deste órgão." },
        { status: 403 },
      );
    }

    const extension = getLogoExtension(logo);
    const storagePath = `${organizationId}/logo-${Date.now()}.${extension}`;
    const fileBuffer = Buffer.from(await logo.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from(LOGO_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: logo.type,
        upsert: true,
      });

    if (uploadError) {
      console.error(
        "[governance/settings/logo] Erro ao enviar arquivo:",
        uploadError,
      );

      return NextResponse.json(
        { error: "Não foi possível enviar a logo para o storage." },
        { status: 500 },
      );
    }

    const { data: publicUrlData } = admin.storage
      .from(LOGO_BUCKET)
      .getPublicUrl(storagePath);

    const logoUrl = publicUrlData.publicUrl;

    const { error: updateError } = await admin
      .from("organizations")
      .update({
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);

    if (updateError) {
      console.error(
        "[governance/settings/logo] Erro ao atualizar organization.logo_url:",
        updateError,
      );

      return NextResponse.json(
        { error: "Logo enviada, mas não foi possível atualizar o cadastro." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      logoUrl,
    });
  } catch (error) {
    console.error("[governance/settings/logo] Erro inesperado:", error);

    return NextResponse.json(
      { error: "Erro inesperado ao atualizar a logo." },
      { status: 500 },
    );
  }
}
