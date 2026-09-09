import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { PageHeader } from "../../components/common/PageHeader";
import { apiFetch } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { subscribeToPush } from "../../lib/push";
import { useAuth } from "../../hooks/useAuth";

interface Child {
  id: string;
  name: string;
  academy_id: string;
  attendance_code: string;
  status: string;
}
interface Report {
  range: { from: string; to: string };
  attendanceRate: number | null;
  totalStudyMinutes: number;
  records: { date: string; status: string; reason: string | null }[];
}

const STATUS_LABEL: Record<string, string> = {
  PRESENT: "출석",
  LATE: "지각",
  ABSENT: "결석",
  EXCUSED: "사유결석",
};

export default function ParentReportPage() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [linkCode, setLinkCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 사전 결석/지각 신청
  const [absenceDate, setAbsenceDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [absenceType, setAbsenceType] = useState<"ABSENCE" | "LATE">("ABSENCE");
  const [absenceReason, setAbsenceReason] = useState("");

  const loadChildren = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ data: Child[] }>("/api/parent/children");
      setChildren(res.data ?? []);
      if (res.data?.length && !selectedId) setSelectedId(res.data[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "자녀 목록 조회 실패");
    } finally {
      setIsLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    if (!selectedId) return;
    apiFetch<Report>(`/api/parent/report?studentId=${selectedId}`)
      .then(setReport)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "리포트 조회 실패"),
      );
  }, [selectedId]);

  const linkChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch<{ student: { id: string; name: string } }>(
        "/api/parent/link",
        { method: "POST", body: JSON.stringify({ linkCode }) },
      );
      setMessage(`${res.student.name} 학생이 연동되었습니다.`);
      setLinkCode("");
      setSelectedId(res.student.id);
      await loadChildren();
    } catch (e) {
      setError(e instanceof Error ? e.message : "연동 실패");
    }
  };

  const requestAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const child = children.find((c) => c.id === selectedId);
    if (!child) return;
    const { error: insErr } = await supabase.from("absence_requests").insert({
      academy_id: child.academy_id,
      student_id: child.id,
      date: absenceDate,
      type: absenceType,
      reason: absenceReason || null,
      requested_by: user?.id ?? null,
    });
    if (insErr) {
      setError(
        insErr.message.includes("unique")
          ? "해당 날짜에 이미 신청 내역이 있습니다."
          : insErr.message,
      );
      return;
    }
    setMessage("사전 신청이 접수되었습니다.");
    setAbsenceReason("");
  };

  const enablePush = async () => {
    setError(null);
    setMessage(null);
    try {
      await subscribeToPush(selectedId);
      setMessage("출결 알림이 활성화되었습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "알림 등록 실패");
    }
  };

  const selectedChild = children.find((c) => c.id === selectedId);

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="자녀 출결 리포트"
        subtitle="주간 리포트 · 사전 결석 신청"
      />

      <div className="mx-auto max-w-2xl space-y-6 p-6">
        {message && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* 자녀 연동 */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            자녀 연동
          </h2>
          <form onSubmit={linkChild} className="flex gap-2">
            <input
              value={linkCode}
              onChange={(e) =>
                setLinkCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="학원에서 받은 6자리 코드"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm tracking-widest"
            />
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              연동
            </button>
          </form>
        </section>

        {isLoading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : children.length === 0 ? (
          <p className="text-sm text-gray-400">
            아직 연동된 자녀가 없습니다. 위에서 코드를 입력해주세요.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={enablePush}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                🔔 출결 알림 켜기
              </button>
            </div>

            {/* 주간 리포트 */}
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">
                주간 리포트{" "}
                {report && (
                  <span className="text-xs font-normal text-gray-400">
                    ({report.range.from} ~ {report.range.to})
                  </span>
                )}
              </h2>
              {!report ? (
                <p className="text-sm text-gray-400">불러오는 중...</p>
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs text-gray-400">출석률</p>
                      <p className="text-xl font-bold text-gray-900">
                        {report.attendanceRate === null
                          ? "—"
                          : `${report.attendanceRate}%`}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs text-gray-400">총 학습시간</p>
                      <p className="text-xl font-bold text-gray-900">
                        {Math.round((report.totalStudyMinutes / 60) * 10) / 10}h
                      </p>
                    </div>
                  </div>
                  {report.records.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      이번 주 출석 기록이 없습니다.
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-100 text-sm">
                      {report.records.map((r, i) => (
                        <li key={i} className="flex justify-between py-2">
                          <span className="text-gray-500">{r.date}</span>
                          <span className="font-medium text-gray-900">
                            {STATUS_LABEL[r.status] ?? r.status}
                            {r.reason ? ` · ${r.reason}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>

            {/* 사전 결석/지각 신청 */}
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">
                사전 결석 / 지각 신청
                {selectedChild ? ` · ${selectedChild.name}` : ""}
              </h2>
              <form onSubmit={requestAbsence} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={absenceDate}
                    onChange={(e) => setAbsenceDate(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={absenceType}
                    onChange={(e) =>
                      setAbsenceType(e.target.value as "ABSENCE" | "LATE")
                    }
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="ABSENCE">결석</option>
                    <option value="LATE">지각</option>
                  </select>
                </div>
                <textarea
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  placeholder="사유 (선택)"
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  신청하기
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
