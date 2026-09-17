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
  const { error } = await
