"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GlobalSearch } from "@/components/global-search";
import { navigationItems, pageLabel } from "@/components/navigation";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ShareCurrentView } from "@/components/share-current-view";
import { Button } from "@/components/ui/button";
import { cn, safeDecodeURIComponent } from "@/lib/utils";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const currentLabel = pageLabel(pathname);
  const detailMaterial = pathname.startsWith("/market/") ? safeDecodeURIComponent(pathname.split("/")[2] ?? "") : null;

  useEffect(() => {
    if (!menuOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>("[data-menu-close]")?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab" || !menuRef.current) return;
      const focusable = [...menuRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hidden);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [menuOpen]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Zum Hauptinhalt springen</a>
      <aside className="sidebar" aria-label="Hauptnavigation">
        <Link href="/" className="brand" aria-label="OPSUCHT Wirtschaft Startseite">
          <span className="brand-mark">OW</span>
          <span><strong>OPSUCHT</strong><small>Wirtschaft</small></span>
        </Link>
        <nav className="sidebar-nav">
          {navigationItems.map((item) => <NavigationLink key={item.href} item={item} active={isActive(pathname, item.href)} />)}
        </nav>
        <div className="sidebar-note">
          <span className="status-dot status-ok" />
          <div><strong>Öffentliche Live-Daten</strong><small>Lesender Zugriff über den sicheren Proxy</small></div>
        </div>
      </aside>

      <div className="app-column">
        <header className="topbar">
          <button className="mobile-menu-button" onClick={() => setMenuOpen(true)} aria-label="Navigation öffnen" aria-expanded={menuOpen} aria-controls="mobile-navigation"><Menu size={21} /></button>
          <div className="breadcrumbs" aria-label="Brotkrümelnavigation">
            <Link href="/">Dashboard</Link>
            {pathname !== "/" ? <><ChevronRight size={14} aria-hidden="true" /><span>{currentLabel}</span></> : null}
            {detailMaterial ? <><ChevronRight size={14} aria-hidden="true" /><span className="truncate">{detailMaterial}</span></> : null}
          </div>
          <div className="topbar-actions">
            <GlobalSearch />
            <ShareCurrentView />
            <Link href="/calculator" className="quick-action"><Plus size={16} aria-hidden="true" /><span>Vergleich</span></Link>
            <ThemeSwitcher />
          </div>
        </header>

        <main id="main-content" className="main-content">{children}</main>
        <footer className="footer">
          <p>Inoffizielles Community-Dashboard. Nicht mit OPSUCHT.NET verbunden.</p>
          <div><Link href="/status">API-Status</Link><Link href="/api-explorer">API-Explorer</Link></div>
        </footer>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Mobile Hauptnavigation">
        {navigationItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} className={cn(isActive(pathname, item.href) && "active")}><Icon size={20} aria-hidden="true" /><span>{item.shortLabel ?? item.label}</span></Link>;
        })}
        <button onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-controls="mobile-navigation"><Menu size={20} aria-hidden="true" /><span>Mehr</span></button>
      </nav>

      {menuOpen ? (
        <div className="mobile-nav-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }}>
          <aside ref={menuRef} id="mobile-navigation" className="mobile-nav-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-navigation-title">
            <div className="mobile-nav-heading"><span id="mobile-navigation-title">Navigation</span><Button data-menu-close variant="ghost" size="icon" onClick={() => setMenuOpen(false)} aria-label="Navigation schließen"><X size={20} /></Button></div>
            <nav>{navigationItems.map((item) => <NavigationLink key={item.href} item={item} active={isActive(pathname, item.href)} onClick={() => setMenuOpen(false)} />)}</nav>
            <ThemeSwitcher />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function NavigationLink({ item, active, onClick }: { item: (typeof navigationItems)[number]; active: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className={cn("nav-link", active && "active")} aria-current={active ? "page" : undefined} onClick={onClick}>
      <Icon size={19} aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}
