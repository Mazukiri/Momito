import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Modal, Pressable,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDSAProblem, getDSAStats, listDSAProblems, markSolved, type DSAProblem, type DSAStats } from "../lib/api";

const DIFF_COLORS: Record<string, string> = {
  Easy: "#16a34a",
  Medium: "#d97706",
  Hard: "#dc2626",
};

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={ds.statBox}>
      <Text style={[ds.statVal, { color }]}>{value}</Text>
      <Text style={ds.statLabel}>{label}</Text>
    </View>
  );
}

export default function DSAScreen() {
  const [problems, setProblems] = useState<DSAProblem[]>([]);
  const [stats, setStats] = useState<DSAStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([listDSAProblems(), getDSAStats()]);
    setProblems(p);
    setStats(s);
  }, []);

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  async function handleAdd() {
    if (!url.trim()) return;
    setAdding(true);
    try {
      await addDSAProblem(url.trim());
      setUrl("");
      setShowAdd(false);
      await load();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to add problem");
    } finally {
      setAdding(false);
    }
  }

  async function toggle(p: DSAProblem) {
    await markSolved(p.id, !p.solved);
    await load();
  }

  return (
    <SafeAreaView style={ds.root}>
      <View style={ds.header}>
        <Text style={ds.title}>DSA Tracker</Text>
        <TouchableOpacity style={ds.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={ds.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {stats && (
        <View style={ds.statsRow}>
          <StatBox label="Total" value={stats.total} color="#1f2937" />
          <StatBox label="Solved" value={stats.solved} color="#16a34a" />
          {(["Easy", "Medium", "Hard"] as const).map((d) => (
            <StatBox
              key={d}
              label={d}
              value={`${stats.by_difficulty[d]?.solved ?? 0}/${stats.by_difficulty[d]?.total ?? 0}`}
              color={DIFF_COLORS[d]}
            />
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={problems}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={ds.list}
          ItemSeparatorComponent={() => <View style={ds.sep} />}
          ListEmptyComponent={<Text style={ds.empty}>No problems yet. Tap + Add to start.</Text>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => toggle(item)}
              style={[ds.card, item.solved && ds.cardSolved]}
            >
              <View style={[ds.check, item.solved && ds.checkDone]}>
                {item.solved && <Text style={ds.checkMark}>✓</Text>}
              </View>
              <View style={ds.cardBody}>
                <Text style={[ds.problemTitle, item.solved && ds.solved]}>
                  #{item.leetcode_id} {item.title}
                </Text>
                <View style={ds.tagRow}>
                  <Text style={[ds.diff, { color: DIFF_COLORS[item.difficulty] }]}>{item.difficulty}</Text>
                  {item.topics.slice(0, 3).map((t) => (
                    <View key={t} style={ds.tag}>
                      <Text style={ds.tagText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
              {item.solved_date && <Text style={ds.date}>{item.solved_date}</Text>}
            </Pressable>
          )}
        />
      )}

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={ds.modal}>
          <Text style={ds.modalTitle}>Add LeetCode Problem</Text>
          <Text style={ds.label}>LeetCode URL</Text>
          <TextInput
            style={ds.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://leetcode.com/problems/two-sum/"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          <TouchableOpacity style={[ds.addBtn, { marginTop: 16 }]} onPress={handleAdd} disabled={adding}>
            <Text style={ds.addBtnText}>{adding ? "Adding…" : "Add Problem"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAdd(false)} style={{ marginTop: 12, alignItems: "center" }}>
            <Text style={{ color: "#6b7280" }}>Cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const ds = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  addBtn: { backgroundColor: "#4f46e5", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  statBox: { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 10, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statVal: { fontSize: 18, fontWeight: "700" },
  statLabel: { fontSize: 10, color: "#6b7280", marginTop: 2 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  sep: { height: 8 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardSolved: { backgroundColor: "#f0fdf4" },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  checkDone: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  checkMark: { color: "#fff", fontSize: 12, fontWeight: "700" },
  cardBody: { flex: 1 },
  problemTitle: { fontSize: 14, fontWeight: "600" },
  solved: { color: "#9ca3af", textDecorationLine: "line-through" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  diff: { fontSize: 11, fontWeight: "600" },
  tag: { backgroundColor: "#f3f4f6", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 10, color: "#6b7280" },
  date: { fontSize: 11, color: "#9ca3af" },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 60 },
  modal: { flex: 1, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 20 },
  label: { fontSize: 13, color: "#374151", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: "#fff" },
});
