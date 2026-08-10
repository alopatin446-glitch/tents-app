"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculateMounting,
  captureCurrentPriceSnapshot,
  formatMountingMoney,
} from "@/lib/logic/mountingCalculations";
import {
  BEAM_TYPE_LABELS,
  EXTRA_FOUNDATION_LABELS,
  FOUNDATION_TYPE_LABELS,
  HEIGHT_WORK_LABELS,
  MOUNTING_PRICES,
  MOUNTING_STATUS_LABELS,
  TEAM_CATEGORY_LABELS,
  TEAM_MEMBERS,
  type TeamMemberConfig,
} from "@/constants/pricing";
import type {
  BeamType,
  ExtraFoundationType,
  FoundationType,
  HeightWorkType,
  MountingBeam,
  MountingConfig,
  MountingPriceAuditEntry,
  MountingStatus,
  TeamCategory,
} from "@/types/mounting";
import { logger } from "@/lib/logger";
import { getPrices } from "@/app/actions/prices";
import styles from "./MountingStep.module.css";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

// ─────────────────────────────────────────────────────────────────────────────
// Утилиты работы с датами (Должны быть объявлены ДО нормализатора)
// ─────────────────────────────────────────────────────────────────────────────

function toISODateOnly(raw: string | Date | null | undefined): string | null {
  if (!raw) return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function addDaysISO(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function expandDates(startDate: string, durationDays: number): string[] {
  const safeDuration = Math.max(1, Math.round(Number(durationDays) || 1));
  return Array.from({ length: safeDuration }, (_, index) =>
    addDaysISO(startDate, index),
  );
}

function formatRuDate(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toSafeNumber(raw: string, fallback = 0): number {
  const normalized = raw.replace(",", ".").trim();
  if (normalized === "") return fallback;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Дефолтная конфигурация и Нормализатор
// ─────────────────────────────────────────────────────────────────────────────

export function defaultMountingConfig(): MountingConfig {
  const defaultCategory: TeamCategory = "mid";
  const defaultMemberId =
    TEAM_MEMBERS.find((member) => member.category === defaultCategory)?.id ?? "";

  return {
    enabled: false,
    baseFoundation: "concrete",
    extraFoundations: [],
    mountingBeams: [],
    heightWork: { type: "stairs", active: false },
    distance: 0,
    team: { category: defaultCategory, memberId: defaultMemberId },
    status: "pending",
    mountingDate: null,
    mountingDates: [], // 🔥 НОВОЕ: по умолчанию пустой массив дат
    startTime: "09:00",
    endTime: "18:00",
    durationDays: 1,
    manualPrice: null,
    lossReason: undefined,
    mountingSnapshot: null,
    priceAuditLog: [],
  };
}

interface MountingStepProps {
  clientId: string;
  value: Partial<MountingConfig> | MountingConfig | null | undefined;
  totalAreaM2: number;
  currentUserId: string;
  onChange: (config: MountingConfig) => void;
  onSave: (config: MountingConfig) => Promise<void>;
  isReadOnly?: boolean;
  teamMembers?: TeamMemberConfig[];
}

function normalizeMountingConfig(
  value: MountingStepProps["value"],
): MountingConfig {
  const defaults = defaultMountingConfig();
  const incoming = value ?? {};
  const incomingTeam = incoming.team ?? defaults.team;
  const incomingHeightWork = incoming.heightWork ?? defaults.heightWork;

  // 🔥 АДАПТЕР (МИГРАЦИЯ НА ЛЕТУ)
  let normalizedDates = Array.isArray(incoming.mountingDates) ? incoming.mountingDates : [];

  if (normalizedDates.length === 0 && incoming.mountingDate) {
    const start = incoming.mountingDate;
    const days = incoming.durationDays && incoming.durationDays > 0 ? incoming.durationDays : 1;
    normalizedDates = expandDates(start, days);
  }

  return {
    ...defaults,
    ...incoming,
    extraFoundations: Array.isArray(incoming.extraFoundations)
      ? incoming.extraFoundations
      : defaults.extraFoundations,
    mountingBeams: Array.isArray(incoming.mountingBeams)
      ? incoming.mountingBeams
      : defaults.mountingBeams,
    heightWork: {
      ...defaults.heightWork,
      ...incomingHeightWork,
    },
    team: {
      ...defaults.team,
      ...incomingTeam,
    },
    mountingDate: incoming.mountingDate ?? null,
    mountingDates: normalizedDates, // 🔥 НОВОЕ
    durationDays: normalizedDates.length > 0 ? normalizedDates.length : (incoming.durationDays ?? 1),
    manualPrice: incoming.manualPrice ?? null,
    mountingSnapshot: incoming.mountingSnapshot ?? null,
    priceAuditLog: Array.isArray(incoming.priceAuditLog)
      ? incoming.priceAuditLog
      : defaults.priceAuditLog,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Прочие вспомогательные функции
// ─────────────────────────────────────────────────────────────────────────────

function isManualPriceRequired(beam: MountingBeam): boolean {
  return beam.type === "custom_wood" || beam.type === "custom_metal";
}

function getEffectiveRetail(
  calcRetailFinal: number,
  manualPrice: number | null,
): number {
  return manualPrice !== null ? manualPrice : calcRetailFinal;
}

type PriceRowForMounting = {
  slug: string;
  value: number;
};

type CalendarBlockCheck = {
  isBlocked: boolean;
  message: string;
  details: string[];
};

type CalendarApiEvent = {
  type?: string;
  date?: string | Date | null;
  mountingDate?: string | Date | null;
  durationDays?: number | null;
  isGlobal?: boolean | null;
  memberId?: string | null;
  title?: string | null;
  description?: string | null;
};

const EMPTY_BLOCK_CHECK: CalendarBlockCheck = {
  isBlocked: false,
  message: "",
  details: [],
};

// 🔥 ОБНОВЛЕНО: Проверяет и выходные (dayOff), и личные события (personal)
function buildDayBlockCheck(
  events: CalendarApiEvent[],
  mountingDates: string[],
  memberId: string,
): CalendarBlockCheck {
  if (!mountingDates || mountingDates.length === 0) return EMPTY_BLOCK_CHECK;

  const cleanMountingDates = new Set(mountingDates.filter(Boolean));
  if (cleanMountingDates.size === 0) return EMPTY_BLOCK_CHECK;

  const matchedDetails: string[] = [];

  for (const event of events) {
    // 🔥 Теперь учитываем И выходные, И личные события
    if (event.type !== "dayOff" && event.type !== "personal") continue;

    const eventStart = toISODateOnly(event.date ?? event.mountingDate ?? null);
    if (!eventStart) continue;

    const eventDates = expandDates(eventStart, event.durationDays ?? 1);

    const hasDateIntersection = eventDates.some((date) =>
      cleanMountingDates.has(date),
    );

    if (!hasDateIntersection) continue;

    const isGlobalBlock = Boolean(event.isGlobal);
    const isMemberBlock = Boolean(
      memberId && event.memberId && event.memberId === memberId,
    );

    if (!isGlobalBlock && !isMemberBlock) continue;

    const scopeText = isGlobalBlock ? "все монтажники" : "выбранный монтажник";
    const defaultTitle = event.type === 'dayOff' ? "Выходной" : "Личное событие / заблокировано";
    const title = event.title?.trim() || defaultTitle;
    const datesText = eventDates.map(formatRuDate).join(", ");

    matchedDetails.push(`${title}: ${datesText} (${scopeText})`);
  }

  if (matchedDetails.length === 0) return EMPTY_BLOCK_CHECK;

  return {
    isBlocked: true,
    message: "Одна или несколько дат попадают на выходной или личное событие монтажника.",
    details: matchedDetails,
  };
}

async function fetchCalendarEventsForBlockCheck(
  signal?: AbortSignal,
): Promise<CalendarApiEvent[]> {
  const response = await fetch("/api/calendar/events", {
    method: "GET",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Не удалось проверить календарь: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Главный Компонент
// ─────────────────────────────────────────────────────────────────────────────

export default function MountingStep({
  value,
  totalAreaM2,
  currentUserId,
  onChange,
  onSave,
  isReadOnly = false,
  teamMembers: teamMembersFromProp,
}: MountingStepProps) {
  const config = useMemo(() => normalizeMountingConfig(value), [value]);
  const [isSaving, setIsSaving] = useState(false);
  const [showVolWarn, setShowVolWarn] = useState(false);
  const [manualPriceInput, setManualPriceInput] = useState(
    config.manualPrice === null ? "" : String(config.manualPrice),
  );
  const [dayBlockCheck, setDayBlockCheck] =
    useState<CalendarBlockCheck>(EMPTY_BLOCK_CHECK);
  const [isCheckingDayBlock, setIsCheckingDayBlock] = useState(false);
  const [mountingPriceMap, setMountingPriceMap] = useState<Record<string, number>>({});

  const [confirmUpdatePricesOpen, setConfirmUpdatePricesOpen] = useState(false);
  const [confirmBlockedSaveOpen, setConfirmBlockedSaveOpen] = useState(false);
  const [blockedSaveMessage, setBlockedSaveMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    getPrices()
      .then((result) => {
        if (cancelled) return;
        if (!result.success || !Array.isArray(result.data)) return;

        const nextMap: Record<string, number> = {};
        for (const price of result.data as PriceRowForMounting[]) {
          nextMap[price.slug] = Number(price.value);
        }
        setMountingPriceMap(nextMap);
      })
      .catch((error) => {
        logger.warn("[MountingStep] Не удалось загрузить прайс монтажа", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const [fetchedMembers, setFetchedMembers] = useState<TeamMemberConfig[] | null>(null);

  useEffect(() => {
    if (teamMembersFromProp !== undefined) return;

    let cancelled = false;

    fetch("/api/team-members")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<TeamMemberConfig[]>;
      })
      .then((data) => {
        if (cancelled) return;
        setFetchedMembers(Array.isArray(data) ? data : null);
      })
      .catch((error) => {
        if (cancelled) return;
        logger.warn(
          "[MountingStep] Не удалось загрузить бригаду из API, используется статика",
          error,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [teamMembersFromProp]);

  const effectiveMembers: TeamMemberConfig[] = useMemo(() => {
    if (teamMembersFromProp !== undefined) return teamMembersFromProp;
    if (fetchedMembers !== null) return fetchedMembers;
    return [];
  }, [teamMembersFromProp, fetchedMembers]);

  const calc = useMemo(
    () => calculateMounting(config, totalAreaM2, mountingPriceMap),
    [config, totalAreaM2, mountingPriceMap],
  );

  const systemRetail = calc.retailFinal;
  const effectiveRetail = getEffectiveRetail(systemRetail, config.manualPrice);
  const profitPercentText =
    calc.profitPercent === null ? "—" : `${calc.profitPercent}%`;

  useEffect(() => {
    setManualPriceInput(
      config.manualPrice === null ? "" : String(config.manualPrice),
    );
  }, [config.manualPrice]);

  useEffect(() => {
    if (
      totalAreaM2 > MOUNTING_PRICES.LARGE_VOLUME_THRESHOLD_M2 &&
      config.enabled
    ) {
      setShowVolWarn(true);
    }
  }, [totalAreaM2, config.enabled]);

  useEffect(() => {
    if (!config.enabled || !config.mountingDates || config.mountingDates.length === 0) {
      setDayBlockCheck(EMPTY_BLOCK_CHECK);
      setIsCheckingDayBlock(false);
      return;
    }

    const controller = new AbortController();
    setIsCheckingDayBlock(true);

    fetchCalendarEventsForBlockCheck(controller.signal)
      .then((events) => {
        if (controller.signal.aborted) return;
        setDayBlockCheck(
          buildDayBlockCheck(
            events,
            config.mountingDates || [],
            config.team.memberId,
          ),
        );
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.warn("Не удалось проверить блокировку дня монтажа:", error);
        setDayBlockCheck(EMPTY_BLOCK_CHECK);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsCheckingDayBlock(false);
        }
      });

    return () => controller.abort();
  }, [
    config.enabled,
    config.mountingDates,
    config.team.memberId,
  ]);

  const emitChange = useCallback(
    (nextConfig: MountingConfig) => {
      onChange(nextConfig);
    },
    [onChange],
  );

  const mutate = useCallback(
    (patch: Partial<MountingConfig>) => {
      emitChange({ ...config, ...patch });
    },
    [config, emitChange],
  );

  const pushAuditEntry = useCallback(
    (
      oldPrice: number,
      newPrice: number,
      reason?: string,
    ): MountingPriceAuditEntry => ({
      userId: currentUserId,
      oldPrice,
      newPrice,
      reason,
      timestamp: new Date().toISOString(),
    }),
    [currentUserId],
  );

  const handleToggleEnabled = () => {
    if (isReadOnly) return;
    if (!config.enabled) {
      emitChange({ ...config, enabled: true });
      return;
    }
    mutate({ enabled: false });
  };

  const handleDateChange = (dateStr: string) => {
    if (isReadOnly) return;
    const nextDate = dateStr || null;
    const nextSnapshot = nextDate
      ? (config.mountingSnapshot ??
        captureCurrentPriceSnapshot(config.team.category, mountingPriceMap))
      : null;

    mutate({
      mountingDate: nextDate,
      mountingSnapshot: nextSnapshot,
    });
  };

  const handleTeamCategoryChange = (category: TeamCategory) => {
    if (isReadOnly) return;
    const firstMemberId =
      effectiveMembers.find((member) => member.category === category)?.id ?? "";
    mutate({
      team: { category, memberId: firstMemberId },
    });
  };

  const handleManualPriceCommit = () => {
    if (isReadOnly) return;

    const trimmed = manualPriceInput.trim();
    const previousManualPrice = config.manualPrice;
    const previousEffectiveRetail = getEffectiveRetail(
      systemRetail,
      previousManualPrice,
    );

    if (trimmed === "") {
      if (previousManualPrice === null) return;
      mutate({
        manualPrice: null,
        priceAuditLog: [
          ...config.priceAuditLog,
          pushAuditEntry(
            previousEffectiveRetail,
            systemRetail,
            "Сброс ручной цены",
          ),
        ],
      });
      return;
    }

    const nextManualPrice = Math.max(0, Math.round(toSafeNumber(trimmed, 0)));
    if (previousManualPrice === nextManualPrice) {
      setManualPriceInput(String(nextManualPrice));
      return;
    }

    mutate({
      manualPrice: nextManualPrice,
      priceAuditLog: [
        ...config.priceAuditLog,
        pushAuditEntry(
          previousEffectiveRetail,
          nextManualPrice,
          "Ручное изменение цены монтажа",
        ),
      ],
    });
    setManualPriceInput(String(nextManualPrice));
  };

  const handleUpdatePrices = () => {
    if (isReadOnly) return;
    setConfirmUpdatePricesOpen(true);
  };

  const handleUpdatePricesConfirmed = () => {
    setConfirmUpdatePricesOpen(false);
    const oldEffectiveRetail = effectiveRetail;
    const nextSnapshot = captureCurrentPriceSnapshot(config.team.category, mountingPriceMap);
    const nextConfig: MountingConfig = {
      ...config,
      manualPrice: null,
      mountingSnapshot: nextSnapshot,
      priceAuditLog: [
        ...config.priceAuditLog,
        pushAuditEntry(
          oldEffectiveRetail,
          systemRetail,
          "Обновление до актуальных цен",
        ),
      ],
    };
    emitChange(nextConfig);
  };

  const handleSave = async () => {
    if (isReadOnly || isSaving) return;

    let actualDayBlockCheck = dayBlockCheck;

    if (config.mountingDates && config.mountingDates.length > 0) {
      try {
        const events = await fetchCalendarEventsForBlockCheck();
        actualDayBlockCheck = buildDayBlockCheck(
          events,
          config.mountingDates,
          config.team.memberId,
        );
        setDayBlockCheck(actualDayBlockCheck);
      } catch (error) {
        console.warn(
          "Не удалось выполнить финальную проверку календаря перед сохранением:",
          error,
        );
      }
    }

    if (actualDayBlockCheck.isBlocked) {
      const details = actualDayBlockCheck.details.length
        ? `\n\n${actualDayBlockCheck.details.map((item) => `• ${item}`).join("\n")}`
        : "";
      setBlockedSaveMessage(`${actualDayBlockCheck.message}${details}`);
      setConfirmBlockedSaveOpen(true);
      return;
    }

    await executeSave();
  };

  const executeSave = async () => {
    setIsSaving(true);
    try {
      await onSave(config);
    } finally {
      setIsSaving(false);
    }
  };

  const teamMembersForCategory = useMemo(
    () =>
      effectiveMembers.filter(
        (member) => member.category === config.team.category,
      ),
    [effectiveMembers, config.team.category],
  );

  const canSave =
    !isReadOnly &&
    !isSaving &&
    !calc.hasPriceError &&
    !(calc.isLoss && !config.lossReason?.trim());

  if (!config.enabled) {
    return (
      <div className={styles.panel}>
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Включить расчёт монтажа</span>
          <button
            type="button"
            className={styles.toggle}
            onClick={handleToggleEnabled}
            disabled={isReadOnly}
            aria-label="Включить расчёт монтажа"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.mountingRoot}>
      {showVolWarn && (
        <div
          className={styles.priceErrorBanner}
          style={{ borderColor: "#FFD600", background: "rgba(255,214,0,0.1)" }}
        >
          <div className={styles.priceErrorTitle} style={{ color: "#FFD600" }}>
            ⚠ Внимание: объём {totalAreaM2.toFixed(1)} м²
          </div>
          <button
            type="button"
            onClick={() => setShowVolWarn(false)}
            className={styles.addBtn}
          >
            Скрыть
          </button>
        </div>
      )}

      <div className={styles.panel}>
        <div className={styles.panelTitle}>
          🔧 Конфигурация
          <button
            type="button"
            className={styles.toggleActive}
            onClick={handleToggleEnabled}
            disabled={isReadOnly}
            aria-label="Выключить расчёт монтажа"
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.label}>Базовое основание</label>
          <select
            className={styles.select}
            value={config.baseFoundation}
            onChange={(event) =>
              mutate({ baseFoundation: event.target.value as FoundationType })
            }
            disabled={isReadOnly}
          >
            {Object.entries(FOUNDATION_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.listSection}>
          <div className={styles.listSectionHeader}>
            <span className={styles.listSectionTitle}>Доп. основания</span>
            <button
              type="button"
              className={styles.addBtn}
              onClick={() =>
                mutate({
                  extraFoundations: [
                    ...config.extraFoundations,
                    { type: "wood", length: 1 },
                  ],
                })
              }
              disabled={isReadOnly}
            >
              + Добавить
            </button>
          </div>

          {config.extraFoundations.map((foundation, index) => (
            <div
              key={`${foundation.type}-${index}`}
              className={styles.listItem}
            >
              <div className={styles.listItemField}>
                <span className={styles.listItemLabel}>Тип</span>
                <select
                  className={styles.select}
                  value={foundation.type}
                  onChange={(event) => {
                    const nextFoundations = [...config.extraFoundations];
                    nextFoundations[index] = {
                      ...foundation,
                      type: event.target.value as ExtraFoundationType,
                    };
                    mutate({ extraFoundations: nextFoundations });
                  }}
                  disabled={isReadOnly}
                >
                  {Object.entries(EXTRA_FOUNDATION_LABELS).map(
                    ([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className={styles.listItemFieldSmall}>
                <span className={styles.listItemLabel}>м.п.</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className={styles.input}
                  value={foundation.length}
                  onChange={(event) => {
                    const nextFoundations = [...config.extraFoundations];
                    nextFoundations[index] = {
                      ...foundation,
                      length: toSafeNumber(event.target.value, 0),
                    };
                    mutate({ extraFoundations: nextFoundations });
                  }}
                  disabled={isReadOnly}
                />
              </div>

              <button
                type="button"
                className={styles.removeBtn}
                onClick={() =>
                  mutate({
                    extraFoundations: config.extraFoundations.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })
                }
                disabled={isReadOnly}
                aria-label="Удалить доп. основание"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className={styles.listSection}>
          <div className={styles.listSectionHeader}>
            <span className={styles.listSectionTitle}>Монтажные балки</span>
            <button
              type="button"
              className={styles.addBtn}
              onClick={() =>
                mutate({
                  mountingBeams: [
                    ...config.mountingBeams,
                    { type: "wood_50x50", length: 1, isPainted: false },
                  ],
                })
              }
              disabled={isReadOnly}
            >
              + Добавить
            </button>
          </div>

          {config.mountingBeams.map((beam, index) => (
            <div key={`${beam.type}-${index}`} className={styles.listItem}>
              <div className={styles.listItemField}>
                <span className={styles.listItemLabel}>Тип</span>
                <select
                  className={styles.select}
                  value={beam.type}
                  onChange={(event) => {
                    const nextType = event.target.value as BeamType;
                    const nextBeams = [...config.mountingBeams];
                    nextBeams[index] = {
                      ...beam,
                      type: nextType,
                      customPrice:
                        nextType === "custom_wood" || nextType === "custom_metal"
                          ? (beam.customPrice ?? 0)
                          : undefined,
                      dimensions:
                        nextType === "custom_wood"
                          ? (beam.dimensions ?? { width: 0, height: 0 })
                          : undefined,
                    };
                    mutate({ mountingBeams: nextBeams });
                  }}
                  disabled={isReadOnly}
                >
                  {Object.entries(BEAM_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.listItemFieldSmall}>
                <span className={styles.listItemLabel}>м.п.</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className={styles.input}
                  value={beam.length}
                  onChange={(event) => {
                    const nextBeams = [...config.mountingBeams];
                    nextBeams[index] = {
                      ...beam,
                      length: toSafeNumber(event.target.value, 0),
                    };
                    mutate({ mountingBeams: nextBeams });
                  }}
                  disabled={isReadOnly}
                />
              </div>

              {isManualPriceRequired(beam) && (
                <div className={styles.listItemFieldSmall}>
                  <span className={styles.listItemLabel}>₽/м.п.</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className={styles.input}
                    value={beam.customPrice ?? ""}
                    onChange={(event) => {
                      const nextBeams = [...config.mountingBeams];
                      nextBeams[index] = {
                        ...beam,
                        customPrice: toSafeNumber(event.target.value, 0),
                      };
                      mutate({ mountingBeams: nextBeams });
                    }}
                    disabled={isReadOnly}
                  />
                </div>
              )}

              {beam.type === "custom_wood" && (
                <>
                  <div className={styles.listItemFieldSmall}>
                    <span className={styles.listItemLabel}>Шир., мм</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={styles.input}
                      value={beam.dimensions?.width ?? ""}
                      onChange={(event) => {
                        const nextBeams = [...config.mountingBeams];
                        nextBeams[index] = {
                          ...beam,
                          dimensions: {
                            width: toSafeNumber(event.target.value, 0),
                            height: beam.dimensions?.height ?? 0,
                          },
                        };
                        mutate({ mountingBeams: nextBeams });
                      }}
                      disabled={isReadOnly}
                    />
                  </div>

                  <div className={styles.listItemFieldSmall}>
                    <span className={styles.listItemLabel}>Выс., мм</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={styles.input}
                      value={beam.dimensions?.height ?? ""}
                      onChange={(event) => {
                        const nextBeams = [...config.mountingBeams];
                        nextBeams[index] = {
                          ...beam,
                          dimensions: {
                            width: beam.dimensions?.width ?? 0,
                            height: toSafeNumber(event.target.value, 0),
                          },
                        };
                        mutate({ mountingBeams: nextBeams });
                      }}
                      disabled={isReadOnly}
                    />
                  </div>
                </>
              )}

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={beam.isPainted}
                  onChange={(event) => {
                    const nextBeams = [...config.mountingBeams];
                    nextBeams[index] = {
                      ...beam,
                      isPainted: event.target.checked,
                    };
                    mutate({ mountingBeams: nextBeams });
                  }}
                  disabled={isReadOnly}
                />
                Покрас
              </label>

              <button
                type="button"
                className={styles.removeBtn}
                onClick={() =>
                  mutate({
                    mountingBeams: config.mountingBeams.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })
                }
                disabled={isReadOnly}
                aria-label="Удалить балку"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className={styles.formRow}>
          <label className={styles.label}>
            Расстояние до объекта в одну сторону (км)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            className={styles.input}
            value={config.distance}
            onChange={(event) =>
              mutate({ distance: toSafeNumber(event.target.value, 0) })
            }
            disabled={isReadOnly}
          />
        </div>

        <div className={styles.formRowInline}>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={config.heightWork.active}
              onChange={(event) =>
                mutate({
                  heightWork: {
                    ...config.heightWork,
                    active: event.target.checked,
                  },
                })
              }
              disabled={isReadOnly}
            />
            Высотные работы
          </label>

          <select
            className={styles.select}
            value={config.heightWork.type}
            onChange={(event) =>
              mutate({
                heightWork: {
                  ...config.heightWork,
                  type: event.target.value as HeightWorkType,
                },
              })
            }
            disabled={isReadOnly || !config.heightWork.active}
          >
            {Object.entries(HEIGHT_WORK_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelTitle}>📅 Расписание и бригада</div>

        <div className={styles.formRow}>
          <label className={styles.label}>Категория бригады</label>
          <select
            className={styles.select}
            value={config.team.category}
            onChange={(event) =>
              handleTeamCategoryChange(event.target.value as TeamCategory)
            }
            disabled={isReadOnly}
          >
            {Object.entries(TEAM_CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formRow}>
          <label className={styles.label}>Монтажник</label>
          <select
            className={styles.select}
            value={config.team.memberId}
            onChange={(event) =>
              mutate({
                team: { ...config.team, memberId: event.target.value },
              })
            }
            disabled={isReadOnly}
          >
            <option value="">— Не назначен —</option>
            {teamMembersForCategory.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formRow}>
          <label className={styles.label}>Статус</label>
          <select
            className={`${styles.select} ${styles.statusSelect}`}
            value={config.status}
            onChange={(event) =>
              mutate({ status: event.target.value as MountingStatus })
            }
            disabled={isReadOnly}
          >
            {Object.entries(MOUNTING_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* 🔥 НОВОЕ: Динамический список дат монтажа */}
        <div className={styles.listSection} style={{ marginTop: '15px' }}>
          <div className={styles.listSectionHeader}>
            <span className={styles.listSectionTitle}>
              Даты монтажа ({config.mountingDates?.length || 0} дн.)
            </span>
            <button
              type="button"
              className={styles.addBtn}
              onClick={() => {
                const newDates = [...(config.mountingDates || [])];
                // Если есть предыдущая дата, добавляем следующий день, иначе сегодня
                let nextDateStr = toISODateOnly(new Date()) || "";
                if (newDates.length > 0) {
                  const lastDate = newDates[newDates.length - 1];
                  if (lastDate) {
                    nextDateStr = addDaysISO(lastDate, 1);
                  }
                }
                newDates.push(nextDateStr);

                // Фиксируем прайс при добавлении первой даты
                const nextSnapshot = (newDates.length > 0 && !config.mountingSnapshot)
                  ? captureCurrentPriceSnapshot(config.team.category, mountingPriceMap)
                  : config.mountingSnapshot;

                mutate({
                  mountingDates: newDates,
                  mountingDate: newDates[0] || null, // Обновляем старое поле для совместимости
                  durationDays: newDates.length, // Длина всегда равна массиву
                  mountingSnapshot: nextSnapshot
                });
              }}
              disabled={isReadOnly}
            >
              + Добавить день
            </button>
          </div>

          {(config.mountingDates || []).map((dateStr, index) => (
            <div key={index} className={styles.listItem}>
              <div className={styles.listItemField}>
                <span className={styles.listItemLabel}>День {index + 1}</span>
                <input
                  type="date"
                  className={styles.input}
                  value={dateStr}
                  onChange={(event) => {
                    const newDates = [...(config.mountingDates || [])];
                    newDates[index] = event.target.value;
                    mutate({
                      mountingDates: newDates,
                      mountingDate: newDates[0] || null
                    });
                  }}
                  disabled={isReadOnly}
                />
              </div>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => {
                  const newDates = (config.mountingDates || []).filter((_, i) => i !== index);
                  mutate({
                    mountingDates: newDates,
                    mountingDate: newDates.length > 0 ? newDates[0] : null,
                    durationDays: newDates.length || 1 // Страховка от нуля
                  });
                }}
                disabled={isReadOnly}
                aria-label="Удалить день"
              >
                ✕
              </button>
            </div>
          ))}

          {config.mountingSnapshot && (
            <div style={{ marginTop: '10px' }}>
              <span className={styles.snapshotBadge}>
                📸 Прайс зафиксирован{" "}
                {new Date(config.mountingSnapshot.capturedAt).toLocaleDateString(
                  "ru-RU",
                )}
              </span>
            </div>
          )}
        </div>

        {isCheckingDayBlock && (
          <div
            className={styles.priceErrorBanner}
            style={{
              borderColor: "#94A3B8",
              background: "rgba(148, 163, 184, 0.1)",
            }}
          >
            <div
              className={styles.priceErrorTitle}
              style={{ color: "#CBD5E1" }}
            >
              Проверяем даты по календарю монтажей...
            </div>
          </div>
        )}

        {dayBlockCheck.isBlocked && (
          <div
            className={styles.priceErrorBanner}
            style={{
              borderColor: "#FFD600",
              background: "rgba(255, 214, 0, 0.1)",
            }}
          >
            <div
              className={styles.priceErrorTitle}
              style={{ color: "#FFD600" }}
            >
              ⚠ Даты попадают на выходной
            </div>
            <div style={{ color: "#FDE68A", fontSize: 13, lineHeight: 1.5 }}>
              {dayBlockCheck.message}
            </div>
            {dayBlockCheck.details.length > 0 && (
              <ul className={styles.priceErrorList}>
                {dayBlockCheck.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
            <div style={{ color: "#FDE68A", fontSize: 12, lineHeight: 1.5 }}>
              Сохранение не заблокировано: при нажатии «Сохранить монтаж»
              появится подтверждение.
            </div>
          </div>
        )}

        <div className={styles.formRowInline}>
          <div className={styles.listItemFieldSmall}>
            <span className={styles.listItemLabel}>Начало</span>
            <input
              type="time"
              className={styles.input}
              value={config.startTime}
              onChange={(event) => mutate({ startTime: event.target.value })}
              disabled={isReadOnly}
            />
          </div>

          <div className={styles.listItemFieldSmall}>
            <span className={styles.listItemLabel}>Окончание</span>
            <input
              type="time"
              className={styles.input}
              value={config.endTime}
              onChange={(event) => mutate({ endTime: event.target.value })}
              disabled={isReadOnly}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <label className={styles.label}>Ручная цена монтажа (₽)</label>
          <input
            type="text"
            inputMode="decimal"
            className={`${styles.input} ${calc.isManualOverride ? styles.inputManualOverride : ""}`}
            value={manualPriceInput}
            placeholder={`Системная: ${formatMountingMoney(systemRetail)}`}
            onChange={(event) => setManualPriceInput(event.target.value)}
            onBlur={handleManualPriceCommit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            disabled={isReadOnly}
          />
        </div>

        {calc.isLoss && (
          <div className={styles.lossBanner}>
            <div className={styles.lossBannerTitle}>Убыточный монтаж</div>
            <label className={styles.label}>
              Причина убытка обязательна перед сохранением
            </label>
            <input
              type="text"
              className={styles.input}
              value={config.lossReason ?? ""}
              onChange={(event) => mutate({ lossReason: event.target.value })}
              disabled={isReadOnly}
            />
          </div>
        )}
      </div>

      <div className={styles.resultsPanel}>
        <div className={styles.resultsTitle}>📊 Итоги расчёта</div>

        <div className={styles.resultsGrid}>
          <div className={styles.resultItem}>
            <span className={styles.resultLabel}>База по окнам</span>
            <span className={styles.resultValue}>
              {formatMountingMoney(calc.retailWindowsBase)}
            </span>
          </div>
          <div className={styles.resultItem}>
            <span className={styles.resultLabel}>Доп. основания</span>
            <span className={styles.resultValue}>
              {formatMountingMoney(calc.retailFoundations)}
            </span>
          </div>
          <div className={styles.resultItem}>
            <span className={styles.resultLabel}>Балки</span>
            <span className={styles.resultValue}>
              {formatMountingMoney(calc.retailBeams)}
            </span>
          </div>
          <div className={styles.resultItem}>
            <span className={styles.resultLabel}>ГСМ розница</span>
            <span className={styles.resultValue}>
              {formatMountingMoney(calc.retailDistance)}
            </span>
          </div>
          <div className={styles.resultItem}>
            <span className={styles.resultLabel}>Высотные работы</span>
            <span className={styles.resultValue}>
              {formatMountingMoney(calc.retailHeightWork)}
            </span>
          </div>
          <div className={styles.resultItem}>
            <span className={styles.resultLabel}>Системная розница</span>
            <span className={styles.resultValueAccent}>
              {formatMountingMoney(systemRetail)}
            </span>
          </div>
          <div className={styles.resultItem}>
            <span className={styles.resultLabel}>Итог к клиенту</span>
            <span
              className={
                calc.isManualOverride
                  ? styles.resultValueWarning
                  : styles.resultValueAccent
              }
            >
              {formatMountingMoney(effectiveRetail)}
            </span>
          </div>
          <div className={styles.resultItem}>
            <span className={styles.resultLabel}>Себестоимость</span>
            <span className={styles.resultValue}>
              {formatMountingMoney(calc.costTotal)}
            </span>
          </div>
          <div className={styles.resultItem}>
            <span className={styles.resultLabel}>Прибыль</span>
            <span
              className={
                calc.isLoss ? styles.resultValueLoss : styles.resultValueAccent
              }
            >
              {formatMountingMoney(calc.profit)} ({profitPercentText})
            </span>
          </div>
        </div>

        {calc.isMinimumApplied && (
          <div className={styles.minimumBadge}>
            Применена минимальная стоимость монтажа:{" "}
            {formatMountingMoney(calc.retailAfterMinimum)}
          </div>
        )}

        {calc.hasPriceError && (
          <div className={styles.priceErrorBanner}>
            <div className={styles.priceErrorTitle}>🔴 ОШИБКА ПРАЙСА</div>
            <ul className={styles.priceErrorList}>
              {calc.priceErrorFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
        )}

        {!isReadOnly && (
          <div className={styles.actionsRow}>
            <button
              type="button"
              className={styles.saveBtn}
              disabled={!canSave}
              onClick={handleSave}
            >
              {isSaving ? "Сохранение..." : "Сохранить монтаж"}
            </button>

            {config.mountingSnapshot && (
              <button
                type="button"
                className={styles.updatePricesBtn}
                onClick={handleUpdatePrices}
              >
                Обновить до текущих цен
              </button>
            )}
          </div>
        )}

        <ConfirmDialog
          open={confirmUpdatePricesOpen}
          title="Сбросить ручную цену?"
          description="Ручная цена будет удалена и заменена текущими тарифами прайса."
          confirmLabel="Обновить"
          cancelLabel="Отмена"
          variant="default"
          onConfirm={handleUpdatePricesConfirmed}
          onCancel={() => setConfirmUpdatePricesOpen(false)}
        />

        <ConfirmDialog
          open={confirmBlockedSaveOpen}
          title="Дата монтажа занята"
          description={`${blockedSaveMessage}\n\nСохранить монтаж всё равно?`}
          confirmLabel="Сохранить"
          cancelLabel="Отмена"
          variant="danger"
          onConfirm={async () => {
            setConfirmBlockedSaveOpen(false);
            await executeSave();
          }}
          onCancel={() => setConfirmBlockedSaveOpen(false)}
        />
      </div>
    </div>
  );
}