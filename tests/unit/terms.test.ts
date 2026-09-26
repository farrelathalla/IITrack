import { describe, expect, it } from "vitest";
import {
  availableTermActions,
  checkTermScheme,
  checkTermTransition,
  financialSummary,
  invoiceStatusLabel,
  paymentFlowIndex,
  paymentStatusLabel,
  receiptStatusLabel,
  stageOfTerm,
  type TermAction,
  type TermStep,
  termStatus,
} from "@/lib/finance/terms";
import { day, NOW, term } from "../support/factories";

const draft = (name: string, percentage: number) => ({
  name,
  percentage,
  amount: percentage * 150_000,
  dueDate: day("2026-10-01"),
  dueNote: null,
});

describe("PRD 4.6: validasi skema termin", () => {
  it("menerima skema dengan total 100% dan termin pertama DP", () => {
    expect(
      checkTermScheme([
        draft("Termin 1 (DP)", 30),
        draft("Termin 2", 40),
        draft("Termin 3 (Final)", 30),
      ]),
    ).toEqual({ valid: true });
  });

  it("menolak total persentase yang bukan 100%", () => {
    const result = checkTermScheme([
      draft("Termin 1 (DP)", 30),
      draft("Termin 2", 40),
    ]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain(
        "Total persentase termin harus 100%, sekarang 70%.",
      );
    }
  });

  it("menolak termin pertama yang bukan DP", () => {
    const result = checkTermScheme([
      draft("Termin 1", 50),
      draft("Termin 2 (DP)", 50),
    ]);
    expect(result.valid).toBe(false);
  });

  it('due date boleh berupa teks seperti "Setelah BAST"', () => {
    const result = checkTermScheme([
      draft("Termin 1 (DP)", 70),
      {
        ...draft("Termin 2 (Final)", 30),
        dueDate: null,
        dueNote: "Setelah BAST",
      },
    ]);
    expect(result).toEqual({ valid: true });

    const missing = checkTermScheme([
      draft("Termin 1 (DP)", 70),
      { ...draft("Termin 2 (Final)", 30), dueDate: null, dueNote: " " },
    ]);
    expect(missing.valid).toBe(false);
  });
});

describe("PRD 5.2: letak termin pada stage", () => {
  it("DP di Stage 5, termin lanjutan di Stage 6, termin final di Stage 7", () => {
    expect(stageOfTerm(1, 3)).toBe(5);
    expect(stageOfTerm(2, 3)).toBe(6);
    expect(stageOfTerm(3, 3)).toBe(7);
    expect(stageOfTerm(1, 1)).toBe(5);
  });
});

describe("PRD 5.2: alur status per termin", () => {
  const happyPath: [TermAction, "PM" | "FINANCE", TermStep][] = [
    ["REQUEST_INVOICE", "PM", "INVOICE_REQUESTED"],
    ["PROCESS", "FINANCE", "PROCESSING"],
    ["APPROVE_INVOICE", "FINANCE", "INVOICE_APPROVED"],
    ["MARK_SENT", "FINANCE", "SENT_TO_CLIENT"],
    ["ADD_PROOF", "PM", "PROOF_SUBMITTED"],
    ["APPROVE_PAYMENT", "FINANCE", "PAYMENT_RECEIVED"],
    ["ISSUE_RECEIPT", "FINANCE", "RECEIPT_ISSUED"],
    ["COMPLETE", "FINANCE", "DONE"],
  ];

  it("Minta Invoice sampai termin Lunas mengikuti urutan dan pelakunya", () => {
    let step: TermStep = "NOT_STARTED";
    for (const [action, role, expected] of happyPath) {
      const result = checkTermTransition({
        action,
        step,
        actorRoles: [role],
        financePocAssigned: true,
        stageUnlocked: true,
      });
      expect(result).toEqual({ allowed: true, to: expected });
      step = expected;
    }
  });

  it("PM juga boleh menandai invoice dikirim ke client", () => {
    expect(
      checkTermTransition({
        action: "MARK_SENT",
        step: "INVOICE_APPROVED",
        actorRoles: ["PM"],
        financePocAssigned: true,
        stageUnlocked: true,
      }).allowed,
    ).toBe(true);
  });

  it("PM tidak bisa menyetujui invoice maupun pembayaran", () => {
    for (const action of [
      "PROCESS",
      "APPROVE_INVOICE",
      "APPROVE_PAYMENT",
      "COMPLETE",
    ] as const) {
      const result = checkTermTransition({
        action,
        step: "PROCESSING",
        actorRoles: ["PM"],
        financePocAssigned: true,
        stageUnlocked: true,
      });
      expect(result.allowed).toBe(false);
    }
  });

  it("Minta Invoice nonaktif sebelum Finance POC ditunjuk atau stage termin terbuka", () => {
    const noPoc = checkTermTransition({
      action: "REQUEST_INVOICE",
      step: "NOT_STARTED",
      actorRoles: ["PM"],
      financePocAssigned: false,
      stageUnlocked: true,
    });
    expect(noPoc).toEqual({
      allowed: false,
      reason: "Finance POC belum ditunjuk. Menunggu CFO/VCFO.",
    });

    const locked = checkTermTransition({
      action: "REQUEST_INVOICE",
      step: "NOT_STARTED",
      actorRoles: ["PM"],
      financePocAssigned: true,
      stageUnlocked: false,
    });
    expect(locked.allowed).toBe(false);
  });

  it("penolakan invoice atau bukti transfer wajib disertai alasan", () => {
    const base = {
      actorRoles: ["FINANCE"] as const,
      financePocAssigned: true,
      stageUnlocked: true,
    };
    expect(
      checkTermTransition({
        ...base,
        action: "REJECT_INVOICE",
        step: "INVOICE_REQUESTED",
      }),
    ).toEqual({
      allowed: false,
      reason: "Alasan penolakan wajib diisi.",
    });
    expect(
      checkTermTransition({
        ...base,
        action: "REJECT_INVOICE",
        step: "PROCESSING",
        feedback: "Nominal salah",
      }),
    ).toEqual({ allowed: true, to: "NOT_STARTED" });
    expect(
      checkTermTransition({
        ...base,
        action: "REJECT_PROOF",
        step: "PROOF_SUBMITTED",
        feedback: "Bukti buram",
      }),
    ).toEqual({ allowed: true, to: "SENT_TO_CLIENT" });
  });

  it("satu termin hanya punya satu alur aktif: aksi di luar urutan ditolak", () => {
    const result = checkTermTransition({
      action: "REQUEST_INVOICE",
      step: "PROCESSING",
      actorRoles: ["PM"],
      financePocAssigned: true,
      stageUnlocked: true,
    });
    expect(result.allowed).toBe(false);
  });

  it("tombol yang tersedia mengikuti status dan peran", () => {
    expect(availableTermActions("NOT_STARTED", ["PM"])).toEqual([
      "REQUEST_INVOICE",
    ]);
    expect(availableTermActions("INVOICE_REQUESTED", ["FINANCE"])).toEqual([
      "PROCESS",
      "REJECT_INVOICE",
    ]);
    expect(availableTermActions("INVOICE_REQUESTED", ["PM"])).toEqual([]);
  });
});

describe("PRD 5.3: status yang ditampilkan", () => {
  it("kolom invoice, pembayaran, dan kwitansi mengikuti langkah alur", () => {
    expect([
      invoiceStatusLabel("NOT_STARTED"),
      paymentStatusLabel("NOT_STARTED"),
      receiptStatusLabel("NOT_STARTED"),
    ]).toEqual(["-", "-", "-"]);
    expect(invoiceStatusLabel("PROCESSING")).toBe("Diproses");
    expect(paymentStatusLabel("SENT_TO_CLIENT")).toBe("Belum Lunas");
    expect(paymentStatusLabel("PROOF_SUBMITTED")).toBe("Menunggu Verifikasi");
    expect(paymentStatusLabel("PAYMENT_RECEIVED")).toBe("Lunas");
    expect(receiptStatusLabel("RECEIPT_ISSUED")).toBe("Diterbitkan");
  });

  it("status termin: Lunas hanya setelah Selesai, Overdue bila lewat due date", () => {
    expect(termStatus(term(1, "PAYMENT_RECEIVED"), NOW)).toBe("IN_PROGRESS");
    expect(termStatus(term(1, "DONE"), NOW)).toBe("PAID");
    expect(
      termStatus(term(1, "NOT_STARTED", { dueDate: day("2026-09-21") }), NOW),
    ).toBe("OVERDUE");
    expect(
      termStatus(term(1, "NOT_STARTED", { dueDate: day("2026-09-22") }), NOW),
    ).toBe("NOT_DUE");
  });

  it("posisi stepper alur pembayaran", () => {
    expect(paymentFlowIndex("NOT_STARTED")).toBe(-1);
    expect(paymentFlowIndex("SENT_TO_CLIENT")).toBe(3);
    expect(paymentFlowIndex("PROOF_SUBMITTED")).toBe(3);
    expect(paymentFlowIndex("DONE")).toBe(7);
  });
});

describe("PRD 5.4: ringkasan keuangan dihitung dari termin", () => {
  it("menjumlahkan total, terbayar, dan sisa tagihan", () => {
    expect(
      financialSummary([
        term(1, "DONE", { amount: 4_500_000 }),
        term(2, "PAYMENT_RECEIVED", { amount: 6_000_000 }),
        term(3, "NOT_STARTED", { amount: 4_500_000 }),
      ]),
    ).toEqual({
      total: 15_000_000,
      paid: 4_500_000,
      remaining: 10_500_000,
      paidTerms: 1,
      totalTerms: 3,
    });
  });
});
