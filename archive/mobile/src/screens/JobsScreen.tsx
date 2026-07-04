import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Modal, Pressable,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createJob, deleteJob, JOB_STATUSES, listJobs, updateJob, type Job, type JobStatus } from "../lib/api";

const STATUS_COLORS: Record<JobStatus, string> = {
  applied: "#3b82f6",
  oa: "#8b5cf6",
  interview: "#f59e0b",
  offer: "#22c55e",
  rejected: "#ef4444",
  withdrawn: "#9ca3af",
};

function Badge({ status }: { status: string }) {
  const color = STATUS_COLORS[status as JobStatus] ?? "#9ca3af";
  return (
    <View style={[s.badge, { backgroundColor: color + "22" }]}>
      <Text style={[s.badgeText, { color }]}>{status}</Text>
    </View>
  );
}

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setJobs(await listJobs());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!company.trim() || !role.trim()) return;
    setAdding(true);
    try {
      const j = await createJob({ company: company.trim(), role: role.trim() });
      setJobs((p) => [j, ...p]);
      setCompany(""); setRole(""); setShowAdd(false);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    } finally {
      setAdding(false);
    }
  }

  function cycleStatus(job: Job) {
    const idx = JOB_STATUSES.indexOf(job.status);
    const next = JOB_STATUSES[(idx + 1) % JOB_STATUSES.length];
    Alert.alert("Update status", `Change to "${next}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Update", onPress: async () => {
          const updated = await updateJob(job.id, { status: next });
          setJobs((p) => p.map((x) => (x.id === updated.id ? updated : x)));
        },
      },
    ]);
  }

  function confirmDelete(id: number) {
    Alert.alert("Delete", "Remove this job?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => { await deleteJob(id); setJobs((p) => p.filter((x) => x.id !== id)); },
      },
    ]);
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Jobs</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(j) => String(j.id)}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          ListEmptyComponent={<Text style={s.empty}>No jobs yet. Tap + Add to start.</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => cycleStatus(item)} onLongPress={() => confirmDelete(item.id)} style={s.card}>
              <View style={s.cardLeft}>
                <Text style={s.company}>{item.company}</Text>
                <Text style={s.roleText}>{item.role}</Text>
                {item.visa_tag === "sponsored" && (
                  <Text style={s.visa}>H1B ✓ ({item.h1b_count_last_year?.toLocaleString()})</Text>
                )}
              </View>
              <View style={s.cardRight}>
                <Badge status={item.status} />
                {item.deadline && <Text style={s.deadline}>Due {item.deadline}</Text>}
              </View>
            </Pressable>
          )}
        />
      )}

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modal}>
          <Text style={s.modalTitle}>New Application</Text>
          <Text style={s.label}>Company</Text>
          <TextInput style={s.input} value={company} onChangeText={setCompany} placeholder="Google" autoFocus />
          <Text style={s.label}>Role</Text>
          <TextInput style={s.input} value={role} onChangeText={setRole} placeholder="Software Engineer L4" />
          <TouchableOpacity style={[s.addBtn, { marginTop: 20 }]} onPress={handleAdd} disabled={adding}>
            <Text style={s.addBtnText}>{adding ? "Adding…" : "Add Job"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAdd(false)} style={{ marginTop: 12, alignItems: "center" }}>
            <Text style={{ color: "#6b7280" }}>Cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  addBtn: { backgroundColor: "#4f46e5", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  sep: { height: 8 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardLeft: { flex: 1 },
  cardRight: { alignItems: "flex-end", gap: 6 },
  company: { fontSize: 15, fontWeight: "600" },
  roleText: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  visa: { fontSize: 11, color: "#16a34a", marginTop: 4 },
  deadline: { fontSize: 11, color: "#9ca3af" },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 60 },
  modal: { flex: 1, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 20 },
  label: { fontSize: 13, color: "#374151", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, marginBottom: 14, backgroundColor: "#fff" },
});
