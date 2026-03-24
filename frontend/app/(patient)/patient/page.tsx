"use client";

import Link from "next/link";
import { useLocalAuth } from "@/lib/local-auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cancelPatientPortalAppointment,
  listDoctors,
  listDoctorAvailability,
  registerPatientPortal,
  getPatientPortalMe,
  listPatientPortalAppointments,
  bookPatientPortalSlot,
  type DoctorAvailabilitySlot,
  type DoctorListItem,
  type PatientPortalAppointment,
  type PatientPortalProfile,
} from "@/services/api";
import { Button } from "@/components/ui/button";
import { CalendarClock, Loader2, Stethoscope, User } from "lucide-react";

type AvailabilityMap = Record<string, DoctorAvailabilitySlot[]>;

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function PatientPortalPage() {
  const { user, isLoading, isAuthenticated, logout } = useLocalAuth();

  const [profile, setProfile] = useState<PatientPortalProfile | null>(null);
  const [appointments, setAppointments] = useState<PatientPortalAppointment[]>([]);
  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");

  const [expandedDoctorId, setExpandedDoctorId] = useState<string | null>(null);
  const [availabilityByDoctor, setAvailabilityByDoctor] = useState<AvailabilityMap>({});

  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const authUserId = user?.sub ?? "";

  const loadDoctors = useCallback(async () => {
    const rows = await listDoctors();
    setDoctors(rows);
    if (!selectedDoctorId && rows.length > 0) {
      setSelectedDoctorId(rows[0].id);
    }
  }, [selectedDoctorId]);

  const loadProfileAndAppointments = useCallback(async () => {
    if (!authUserId) return;

    const me = await getPatientPortalMe(authUserId);
    setProfile(me);

    if (me) {
      setName(me.name || "");
      setPhone(me.phone || "");
      const appts = await listPatientPortalAppointments(authUserId);
      setAppointments(appts);
    } else {
      setAppointments([]);
      setName(user?.name || "");
      setPhone("");
    }
  }, [authUserId, user?.name]);

  useEffect(() => {
    if (!isAuthenticated || !authUserId) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    Promise.all([loadDoctors(), loadProfileAndAppointments()])
      .catch((err) => {
        if (active) {
          const text = err instanceof Error ? err.message : "Failed to load patient portal.";
          setMessage(text);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authUserId, isAuthenticated, loadDoctors, loadProfileAndAppointments]);

  useEffect(() => {
    if (!isAuthenticated || !authUserId) return;

    const interval = setInterval(async () => {
      try {
        await loadDoctors();
        if (expandedDoctorId) {
          const slots = await listDoctorAvailability(expandedDoctorId);
          setAvailabilityByDoctor((prev) => ({ ...prev, [expandedDoctorId]: slots }));
        }
      } catch {
        // Ignore background refresh errors; main actions still surface errors.
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [authUserId, expandedDoctorId, isAuthenticated, loadDoctors]);

  const handleRegister = useCallback(async () => {
    if (!authUserId || !user?.email) return;
    if (!name.trim() || !phone.trim() || !selectedDoctorId) {
      setMessage("Please fill name, phone, and primary doctor.");
      return;
    }

    setRegistering(true);
    setMessage(null);
    try {
      const created = await registerPatientPortal({
        auth_user_id: authUserId,
        email: user.email,
        name: name.trim(),
        phone: phone.trim(),
        doctor_id: selectedDoctorId,
      });
      setProfile(created);
      const appts = await listPatientPortalAppointments(authUserId);
      setAppointments(appts);
      setMessage("Patient profile registered successfully.");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Registration failed.";
      setMessage(text);
    } finally {
      setRegistering(false);
    }
  }, [authUserId, name, phone, selectedDoctorId, user?.email]);

  const handleToggleAvailability = useCallback(
    async (doctorId: string) => {
      setMessage(null);
      if (expandedDoctorId === doctorId) {
        setExpandedDoctorId(null);
        return;
      }
      setExpandedDoctorId(doctorId);

      if (availabilityByDoctor[doctorId]) return;

      try {
        const slots = await listDoctorAvailability(doctorId);
        setAvailabilityByDoctor((prev) => ({ ...prev, [doctorId]: slots }));
      } catch (err) {
        const text = err instanceof Error ? err.message : "Could not load slots.";
        setMessage(text);
      }
    },
    [availabilityByDoctor, expandedDoctorId],
  );

  const handleBookSlot = useCallback(
    async (slotId: string, doctorId: string) => {
      if (!authUserId) return;
      if (!profile) {
        setMessage("Please complete patient registration first.");
        return;
      }

      setBookingSlotId(slotId);
      setMessage(null);
      try {
        await bookPatientPortalSlot(slotId, {
          auth_user_id: authUserId,
          consultation_type: "video",
        });
        const [appts, slots] = await Promise.all([
          listPatientPortalAppointments(authUserId),
          listDoctorAvailability(doctorId),
        ]);
        setAppointments(appts);
        setAvailabilityByDoctor((prev) => ({ ...prev, [doctorId]: slots }));
        setMessage("Appointment booked successfully.");
      } catch (err) {
        const text = err instanceof Error ? err.message : "Booking failed.";
        setMessage(text);
      } finally {
        setBookingSlotId(null);
      }
    },
    [authUserId, profile],
  );

  const upcomingAppointments = useMemo(() => appointments, [appointments]);

  const handleCancelAppointment = useCallback(
    async (appointmentId: string) => {
      if (!authUserId) return;
      setMessage(null);
      try {
        await cancelPatientPortalAppointment(appointmentId, {
          auth_user_id: authUserId,
        });
        const appts = await listPatientPortalAppointments(authUserId);
        setAppointments(appts);
        setMessage("Appointment cancelled.");
      } catch (err) {
        const text = err instanceof Error ? err.message : "Cancel failed.";
        setMessage(text);
      }
    },
    [authUserId],
  );

  if (isLoading || loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading patient portal...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-serif text-4xl tracking-tight md:text-5xl">Patient Portal</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to view doctors, register as a patient, and book appointments.
        </p>
        <div className="flex items-center gap-2">
          <Link href="/patient-signIn">
            <Button>Patient Login</Button>
          </Link>
          <Link href="/patient-signUp">
            <Button variant="outline">Create Patient Account</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Patient Portal</p>
            <h1 className="text-sm font-semibold">Welcome, {user?.name || "Patient"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/patient/booking">
              <Button variant="outline" size="sm">Book Appointment</Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 md:grid-cols-3">
        <section className="md:col-span-1">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Patient Registration</h2>

            {profile ? (
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Name:</span> {profile.name}</p>
                <p><span className="text-muted-foreground">Email:</span> {profile.email}</p>
                <p><span className="text-muted-foreground">Phone:</span> {profile.phone}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone Number"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select primary doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} - {doctor.specialty}
                    </option>
                  ))}
                </select>
                <Button disabled={registering} onClick={handleRegister}>
                  {registering ? "Registering..." : "Register Patient Profile"}
                </Button>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">My Appointments</h2>
            {upcomingAppointments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No appointments yet.</p>
            ) : (
              <div className="space-y-2">
                {upcomingAppointments.map((appt) => (
                  <div key={appt.id} className="rounded-lg border border-border/70 bg-background p-2 text-xs">
                    <p className="font-medium">{appt.doctor_name || "Doctor"}</p>
                    <p className="text-muted-foreground">{appt.doctor_specialty || ""}</p>
                    <p>{formatDateTime(appt.slot_start)}</p>
                    <p className="text-muted-foreground capitalize">Status: {appt.status}</p>
                    {appt.status !== "cancelled" && appt.status !== "completed" && appt.status !== "no_show" && (
                      <div className="mt-2 flex gap-2">
                        <Link href={`/patient/booking?appointmentId=${appt.id}`}>
                          <Button size="sm" variant="outline">Reschedule</Button>
                        </Link>
                        <Button size="sm" variant="outline" onClick={() => handleCancelAppointment(appt.id)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="md:col-span-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Doctors</h2>
            <div className="space-y-3">
              {doctors.map((doctor) => {
                const slots = availabilityByDoctor[doctor.id] || [];
                const expanded = expandedDoctorId === doctor.id;

                return (
                  <article key={doctor.id} className="rounded-lg border border-border/70 bg-background p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium">{doctor.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Stethoscope className="size-3" />{doctor.specialty}</span>
                          <span className="inline-flex items-center gap-1"><User className="size-3" />{doctor.language}</span>
                          <span>{doctor.consultation_type}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${doctor.available_now ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                          {doctor.available_now ? "Available now" : `Next: ${formatDateTime(doctor.next_slot_start)}`}
                        </span>
                        <Button size="sm" variant="outline" onClick={() => handleToggleAvailability(doctor.id)}>
                          {expanded ? "Hide slots" : "View slots"}
                        </Button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3 space-y-2">
                        {slots.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No upcoming slots.</p>
                        ) : (
                          slots.map((slot) => (
                            <div key={slot.id} className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 md:flex-row md:items-center md:justify-between">
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <CalendarClock className="size-3.5" />
                                {formatDateTime(slot.slot_start)}
                              </span>
                              <Button
                                size="sm"
                                disabled={bookingSlotId === slot.id || !profile}
                                onClick={() => handleBookSlot(slot.id, doctor.id)}
                              >
                                {bookingSlotId === slot.id ? "Booking..." : "Book Appointment"}
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {message}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
