"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

export type ScrollProgressSection = {
  id: string;
  label: string;
};

type Size = {
  width: number;
  height: number;
};

export function ScrollProgress({ sections, offset = 92 }: { sections: ScrollProgressSection[]; offset?: number }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  const [pillSize, setPillSize] = useState<Size>();
  const [menuSize, setMenuSize] = useState<Size>();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const progressRef = useRef<SVGCircleElement>(null);
  const pillMeasureRef = useRef<HTMLDivElement>(null);
  const menuMeasureRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef(activeId);
  const frameRef = useRef<number | null>(null);

  const activeLabel = sections.find((section) => section.id === activeId)?.label ?? sections[0]?.label ?? "Überblick";

  useLayoutEffect(() => {
    const measure = () => {
      if (pillMeasureRef.current) {
        setPillSize({ width: pillMeasureRef.current.offsetWidth + 2, height: pillMeasureRef.current.offsetHeight + 2 });
      }
      if (menuMeasureRef.current) {
        setMenuSize({ width: menuMeasureRef.current.offsetWidth + 2, height: menuMeasureRef.current.offsetHeight + 2 });
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (pillMeasureRef.current) observer.observe(pillMeasureRef.current);
    if (menuMeasureRef.current) observer.observe(menuMeasureRef.current);
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => observer.disconnect();
  }, [activeLabel, sections]);

  useEffect(() => {
    const update = () => {
      frameRef.current = null;
      const scrollableDistance = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
      const progress = scrollableDistance === 0 ? 1 : Math.min(Math.max(window.scrollY / scrollableDistance, 0), 1);
      if (progressRef.current) progressRef.current.style.strokeDashoffset = String(1 - progress);
      rootRef.current?.classList.toggle("is-scrollable", scrollableDistance > 16);

      const active = sections.findLast((section) => {
        const top = document.getElementById(section.id)?.getBoundingClientRect().top;
        return top !== undefined && top <= offset;
      });
      const nextId = active?.id ?? sections[0]?.id ?? "";
      if (nextId !== activeIdRef.current) {
        activeIdRef.current = nextId;
        setActiveId(nextId);
      }
    };

    const scheduleUpdate = () => {
      if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [offset, sections]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selectSection = (id: string) => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    activeIdRef.current = id;
    setActiveId(id);
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    triggerRef.current?.focus();
  };

  const size = open ? menuSize : pillSize;
  const surfaceStyle: CSSProperties = size ? { width: size.width, height: size.height } : {};

  return (
    <div ref={rootRef} className="scroll-progress" data-open={open || undefined}>
      <div className="scroll-progress-measure" aria-hidden="true">
        <div ref={pillMeasureRef} className="scroll-progress-pill-content">
          <span className="scroll-progress-ring-placeholder" />
          <span>{activeLabel}</span>
        </div>
        <div ref={menuMeasureRef} className="scroll-progress-menu-content">
          {sections.map((section) => <span key={section.id}>{section.label}</span>)}
        </div>
      </div>

      <div className="scroll-progress-surface" style={surfaceStyle}>
        <button
          ref={triggerRef}
          type="button"
          className="scroll-progress-trigger"
          aria-label="Seitenabschnitte öffnen"
          aria-expanded={open}
          aria-controls="overview-scroll-sections"
          tabIndex={open ? -1 : 0}
          onClick={() => setOpen(true)}
        >
          <svg viewBox="0 0 24 24" className="scroll-progress-ring" aria-hidden="true">
            <circle cx="12" cy="12" r="9.5" pathLength="1" className="scroll-progress-ring-track" />
            <circle ref={progressRef} cx="12" cy="12" r="9.5" pathLength="1" className="scroll-progress-ring-value" />
          </svg>
          <span key={activeId} className="scroll-progress-label">{activeLabel}</span>
        </button>

        <nav id="overview-scroll-sections" className="scroll-progress-menu" aria-label="Abschnitte dieser Seite" aria-hidden={!open}>
          {sections.map((section) => {
            const active = section.id === activeId;
            return (
              <button
                key={section.id}
                type="button"
                className={active ? "is-active" : undefined}
                aria-current={active ? "location" : undefined}
                tabIndex={open ? 0 : -1}
                onClick={() => selectSection(section.id)}
              >
                <span className="scroll-progress-dot" aria-hidden="true" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
