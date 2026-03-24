"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocalAuth } from "@/lib/local-auth";
import { useCallback, useEffect, useState } from "react";
import {
  bookPatientPortalSlot,
  getPatientPortalMe,
  listDoctorAvailability,
  listDoctors,
  reschedulePatientPortalAppointment,
  type DoctorAvailabilitySlot,
  type DoctorListItem,
} from "@/services/api";
import { Button } from "@/components/ui/button";
import { CalendarClock, Loader2 } from "lucide-react";

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function PatientBookingPage() {
  const { user, isAuthenticated, isLoading } = useLocalAuth();
  const searchParams = useSearchParams();
  const authUserId = user?.sub ?? "";
  const appointmentId = searchParams.get("appointmentId") || "";

  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [slots, setSlots] = useState<DoctorAvailabilitySlot[]>([]);
  const [consultationType, setConsultationType] = useState("video");
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const loadSlots = useCallback(async (doctorId: string) => {
    const data = await listDoctorAvailability(doctorId);
    setSlots(data);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !authUserId) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    Promise.all([getPatientPortalMe(authUserId), listDoctors()])
      .then(async ([profile, doctorRows]) => {
        if (!active) return;

        if (!profile) {
          setStatus({ type: "info", text: "Complete patient registration first in the portal." });
          setDoctors(doctorRows);
          if (doctorRows[0]) {
            setSelectedDoctorId(doctorRows[0].id);
            await loadSlots(doctorRows[0].id);
          }
          return;
        }

        setDoctors(doctorRows);
        const primaryDoctor = doctorRows.find((d) => d.id === profile.doctor_id) || doctorRows[0];
        if (primaryDoctor) {
          setSelectedDoctorId(primaryDoctor.id);
          await loadSlots(primaryDoctor.id);
        }
      })
      .catch((err) => {
        const text = err instanceof Error ? err.message : "Failed to load booking data.";
        if (active) setStatus({ type: "error", text });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authUserId, isAuthenticated, loadSlots]);

  useEffect(() => {
    if (!selectedDoctorId) return;
    loadSlots(selectedDoctorId).catch(() => {
      setStatus({ type: "error", text: "Could not load doctor availability." });
    });
  }, [selectedDoctorId, loadSlots]);

  const handleBook = useCallback(async (slotId: string) => {
    if (!authUserId) return;

    setBookingSlotId(slotId);
    setStatus(null);
    try {
      if (appointmentId) {
        await reschedulePatientPortalAppointment(appointmentId, {
          auth_user_id: authUserId,
          new_slot_id: slotId,
          consultation_type: consultationType,
        });
        setStatus({ type: "success", text: "Appointment rescheduled successfully." });
      } else {
        await bookPatientPortalSlot(slotId, {
          auth_user_id: authUserId,
          consultation_type: consultationType,
        });
        setStatus({ type: "success", text: "Appointment booked. Confirmation notification created." });
      }
      if (selectedDoctorId) {
        const refreshed = await listDoctorAvailability(selectedDoctorId);
        setSlots(refreshed);
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : "Booking failed.";
      setStatus({ type: "error", text });
    } finally {
      setBookingSlotId(null);
    }
  }, [appointmentId, authUserId, consultationType, selectedDoctorId]);

  if (isLoading || loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading booking flow...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-serif text-4xl tracking-tight md:text-5xl">Book Appointment</h1>
        <p className="text-sm text-muted-foreground">Login to continue your booking.</p>
        <Link href="/patient-signIn"><Button>Patient Login</Button></Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Phase 2</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight">Self-service Appointment Booking</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {appointmentId
              ? "Choose a new slot to reschedule your appointment."
              : "Select a doctor and book any available slot."}
          </p>
        </div>
        <Link href="/patient"><Button variant="outline">Back to Portal</Button></Link>
      </div>

      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-2">
        <select
          value={selectedDoctorId}
          onChange={(e) => setSelectedDoctorId(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.name} - {doctor.specialty}
            </option>
          ))}
        </select>

        <select
          value={consultationType}
          onChange={(e) => setConsultationType(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="video">Video</option>
          <option value="chat">Chat</option>
          <option value="in_person">In-person</option>
        </select>
      </div>

      {status && (
        <div className={`mt-4 rounded-lg px-3 py-2 text-sm ${status.type === "success" ? "border border-emerald-300 bg-emerald-50 text-emerald-700" : status.type === "error" ? "border border-destructive/40 bg-destructive/10 text-destructive" : "border border-border bg-muted/40 text-muted-foreground"}`}>
          {status.text}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Available Slots</h2>
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No slots available for this doctor.</p>
        ) : (
          <div className="space-y-2">
            {slots.map((slot) => (
              <div key={slot.id} className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 md:flex-row md:items-center md:justify-between">
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <CalendarClock className="size-4" />
                  {formatDateTime(slot.slot_start)}
                </span>
                <Button
                  size="sm"
                  disabled={bookingSlotId === slot.id}
                  onClick={() => handleBook(slot.id)}
                >
                  {bookingSlotId === slot.id ? "Saving..." : appointmentId ? "Reschedule Here" : "Confirm Booking"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
