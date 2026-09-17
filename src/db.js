import { supabase } from "./supabaseClient";

/* ------------------------------- Sessions -------------------------------- */

function rowToSession(r) {
  return {
    instanceId: r.instance_id,
    templateId: r.template_id,
    date: r.date,
    day: r.day,
    time: r.time,
    discipline: r.discipline,
    durationMin: r.duration_min,
    distanceKm: r.distance_km,
    zone: r.zone,
    desc: r.description,
    status: r.status,
    actual: r.actual,
    missedReason: r.missed_reason,
    missedNote: r.missed_note,
  };
}

function sessionToRow(s) {
  return {
    instance_id: s.instanceId,
    template_id: s.templateId,
    date: s.date,
    day: s.day,
    time: s.time,
    discipline: s.discipline,
    duration_min: s.durationMin,
    distance_km: s.distanceKm,
    zone: s.zone,
    description: s.desc,
    status: s.status,
    actual: s.actual,
    missed_reason: s.missedReason,
    missed_note: s.missedNote,
  };
}

export async function fetchSessions() {
  const { data, error } = await supabase.from("sessions").select("*").order("date");
  if (error) throw error;
  return (data || []).map(rowToSession);
}

export async function bulkInsertSessions(sessions) {
  const rows = sessions.map(sessionToRow);
  const { error } = await supabase.from("sessions").upsert(rows, { onConflict: "instance_id" });
  if (error) throw error;
}

export async function upsertSession(session) {
  const { error } = await supabase
    .from("sessions")
    .upsert(sessionToRow(session), { onConflict: "instance_id" });
  if (error) throw error;
}

/* ------------------------------- Recovery -------------------------------- */

function rowToRecovery(r) {
  return {
    sleepHours: r.sleep_hours,
    sleepQuality: r.sleep_quality,
    energy: r.energy,
    fatigue: r.fatigue,
    mood: r.mood,
    soreness: r.soreness,
    notes: r.notes,
    isDemo: r.is_demo,
  };
}

function recoveryToRow(date, log) {
  return {
    date,
    sleep_hours: log.sleepHours,
    sleep_quality: log.sleepQuality,
    energy: log.energy,
    fatigue: log.fatigue,
    mood: log.mood,
    soreness: log.soreness,
    notes: log.notes,
    is_demo: log.isDemo || false,
  };
}

export async function fetchRecovery() {
  const { data, error } = await supabase.from("recovery_logs").select("*");
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => {
    map[r.date] = rowToRecovery(r);
  });
  return map;
}

export async function bulkInsertRecovery(recoveryMap) {
  const rows = Object.entries(recoveryMap).map(([date, log]) => recoveryToRow(date, log));
  if (rows.length === 0) return;
  const { error } = await supabase.from("recovery_logs").upsert(rows, { onConflict: "date" });
  if (error) throw error;
}

export async function upsertRecovery(date, log) {
  const { error } = await supabase
    .from("recovery_logs")
    .upsert(recoveryToRow(date, log), { onConflict: "date" });
  if (error) throw error;
}

/* --------------------------------- Photos --------------------------------- */

const PHOTO_BUCKET = "photos";

export async function fetchPhotos() {
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    dataUrl: r.url,
    category: r.category,
    createdAt: r.created_at,
  }));
}

export async function uploadPhoto(blob, category) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `${id}.jpg`;
  const { error: upErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  const createdAt = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("photos")
    .insert({ id, url: pub.publicUrl, category, created_at: createdAt });
  if (error) throw error;
  return { id, dataUrl: pub.publicUrl, category, createdAt };
}

export async function deletePhoto(id) {
  await supabase.storage.from(PHOTO_BUCKET).remove([`${id}.jpg`]);
  const { error } = await supabase.from("photos").delete().eq("id", id);
  if (error) throw error;
}

/* --------------------------------- Plan template --------------------------------- */
// A estrutura-base da semana, agora editável pelo usuário em vez de fixa no código.

function rowToTemplate(r) {
  return {
    id: r.id, day: r.day, time: r.time, discipline: r.discipline,
    durationMin: r.duration_min, distanceKm: r.distance_km, zone: r.zone, desc: r.description,
  };
}
function templateToRow(t) {
  return {
    id: t.id, day: t.day, time: t.time, discipline: t.discipline,
    duration_min: t.durationMin, distance_km: t.distanceKm, zone: t.zone, description: t.desc,
  };
}

export async function fetchTemplate() {
  const { data, error } = await supabase.from("plan_template").select("*").order("day").order("time");
  if (error) throw error;
  return (data || []).map(rowToTemplate);
}

export async function bulkInsertTemplate(entries) {
  if (entries.length === 0) return;
  const { error } = await supabase.from("plan_template").upsert(entries.map(templateToRow), { onConflict: "id" });
  if (error) throw error;
}

export async function upsertTemplateEntry(entry) {
  const { error } = await supabase.from("plan_template").upsert(templateToRow(entry), { onConflict: "id" });
  if (error) throw error;
}

export async function deleteTemplateEntry(id) {
  const { error } = await supabase.from("plan_template").delete().eq("id", id);
  if (error) throw error;
}
