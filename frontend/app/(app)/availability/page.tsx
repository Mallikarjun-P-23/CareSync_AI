"use client";

import { useLocalAuth } from "@/lib/local-auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createDoctorSlot,
  deleteDoctorSlot,
  listDoctorSlots,
  updateDoctorSlot,
  type DoctorManagedSlot,
} from "@/services/api";
import { Button } from "@/components/ui/button";
import { CalendarClock, Loader2, Plus, Trash2 } from "lucide-react";

function toInputDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function fromInputDateTime(value: string) {
  const date = new Date(value);
  return date.toISOString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AvailabilityPage() {
  const { user } = useLocalAuth();
  const doctorId = user?.sub;

  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<DoctorManagedSlot[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");

  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editStatus, setEditStatus] = useState("available");
  const [savingSlotId, setSavingSlotId] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    if (!doctorId) {
      setSlots([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await listDoctorSlots(doctorId, { includePast: false });
      setSlots(data);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to load availability.";
      setMessage(text);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const filteredSlots = useMemo(() => {
    if (statusFilter === "all") return slots;
    return slots.filter((slot) => slot.status === statusFilter);
  }, [slots, statusFilter]);

  const handleCreate = useCallback(async () => {
    if (!doctorId) return;
    if (!newStart || !newEnd) {
      setMessage("Select both start and end time.");
      return;
    }
    if (new Date(newEnd) <= new Date(newStart)) {
      setMessage("End time must be after start time.");
      return;
    }

    setCreating(true);
    setMessage(null);
    try {
      await createDoctorSlot(doctorId, {
        slot_start: fromInputDateTime(newStart),
        slot_end: fromInputDateTime(newEnd),
      });
      setNewStart("");
      setNewEnd("");
      await fetchSlots();
      setMessage("Slot created.");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Could not create slot.";
      setMessage(text);
    } finally {
      setCreating(false);
    }
  }, [doctorId, fetchSlots, newEnd, newStart]);

  const startEdit = useCallback((slot: DoctorManagedSlot) => {
    setEditingSlotId(slot.id);
    setEditStart(toInputDateTime(slot.slot_start));
    setEditEnd(toInputDateTime(slot.slot_end));
    setEditStatus(slot.status);
    setMessage(null);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!doctorId || !editingSlotId) return;
    if (!editStart || !editEnd) {
      setMessage("Select both start and end time.");
      return;
    }
    if (new Date(editEnd) <= new Date(editStart)) {
      setMessage("End time must be after start time.");
      return;
    }

    setSavingSlotId(editingSlotId);
    setMessage(null);
    try {
      await updateDoctorSlot(doctorId, editingSlotId, {
        slot_start: fromInputDateTime(editStart),
        slot_end: fromInputDateTime(editEnd),
        status: editStatus,
      });
      setEditingSlotId(null);
      await fetchSlots();
      setMessage("Slot updated.");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Could not update slot.";
      setMessage(text);
    } finally {
      setSavingSlotId(null);
    }
  }, [doctorId, editEnd, editStart, editStatus, editingSlotId, fetchSlots]);

  const handleDelete = useCallback(async (slotId: string) => {
    if (!doctorId) return;
    setSavingSlotId(slotId);
    setMessage(null);
    try {
      await deleteDoctorSlot(doctorId, slotId);
      await fetchSlots();
      setMessage("Slot deleted.");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Could not delete slot.";
      setMessage(text);
    } finally {
      setSavingSlotId(null);
    }
  }, [doctorId, fetchSlots]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Manage Availability</h1>
        <p className="text-sm text-muted-foreground">
          Create, edit, and remove upcoming appointment slots.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Create Slot</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            type="datetime-local"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <Button disabled={creating} onClick={handleCreate}>
            <Plus className="mr-2 size-4" />
            {creating ? "Creating..." : "Create Slot"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Upcoming Slots</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
          >
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="booked">Booked</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading slots...
          </div>
        ) : filteredSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No slots found.</p>
        ) : (
          <div className="space-y-2">
            {filteredSlots.map((slot) => {
              const isEditing = editingSlotId === slot.id;
              return (
                <div key={slot.id} className="rounded-lg border border-border p-3">
                  {isEditing ? (
                    <div className="grid gap-2 md:grid-cols-4">
                      <input
                        type="datetime-local"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
                      />
                      <input
                        type="datetime-local"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
                      />
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
                      >
                        <option value="available">available</option>
                        <option value="cancelled">cancelled</option>
                        <option value="reserved">reserved</option>
                      </select>
                      <div className="flex gap-2">
                        <Button size="sm" disabled={savingSlotId === slot.id} onClick={handleUpdate}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingSlotId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="inline-flex items-center gap-1 text-sm font-medium">
                          <CalendarClock className="size-4" />
                          {formatDateTime(slot.slot_start)}
                        </p>
                        <p className="text-xs text-muted-foreground">Ends: {formatDateTime(slot.slot_end)}</p>
                        <p className="text-xs capitalize text-muted-foreground">Status: {slot.status}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={slot.status === "booked"}
                          onClick={() => startEdit(slot)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={slot.status === "booked" || savingSlotId === slot.id}
                          onClick={() => handleDelete(slot.id)}
                        >
                          <Trash2 className="mr-1 size-3.5" />Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {message && (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {message}
        </div>
      )}
    </div>
  );
}
