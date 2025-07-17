import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = cookies();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const clientTest: { success: boolean; error: string | null; data: any } = {
    success: false,
    error: null,
    data: null,
  };

  try {
    const { data, error } = await supabase
      .from("audio_files")
      .select("count", { count: "exact" })
      .limit(0);

    if (error) {
      clientTest.error = error.message;
    } else {
      clientTest.success = true;
      clientTest.data = data;
    }
  } catch (err: any) {
    clientTest.error = err.message || "Unknown client-side error";
  }

  const adminTest: { success: boolean; error: string | null; data: any } = {
    success: false,
    error: null,
    data: null,
  };

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/audio_files?limit=0`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
      }
    );

    if (!res.ok) throw new Error(`Response not ok: ${res.status}`);
    const data = await res.json();
    adminTest.success = true;
    adminTest.data = data;
  } catch (err: any) {
    adminTest.error = err.message || "Unknown admin-side error";
  }

  const storageTest: { success: boolean; error: string | null; data: any } = {
    success: false,
    error: null,
    data: null,
  };

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/bucket`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
      }
    );

    if (!res.ok) throw new Error(`Response not ok: ${res.status}`);
    const data = await res.json();
    storageTest.success = true;
    storageTest.data = data;
  } catch (err: any) {
    storageTest.error = err.message || "Unknown storage error";
  }

  const insertTest: { success: boolean; error: string | null; data: any } = {
    success: false,
    error: null,
    data: null,
  };

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/test_table`,
      {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ message: "ok" }),
      }
    );

    if (!res.ok) throw new Error(`Response not ok: ${res.status}`);
    const data = await res.json();
    insertTest.success = true;
    insertTest.data = data;
  } catch (err: any) {
    insertTest.error = err.message || "Unknown insert error";
  }

  return NextResponse.json({
    clientTest,
    adminTest,
    storageTest,
    insertTest,
  });
}
