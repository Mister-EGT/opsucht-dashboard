"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, Plus, Shield, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GlobalSearch } from "@/components/global-search";
import { navigationItems, pageLabel } from "@/components/navigation";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ShareCurrentView } from "@/components/share-current-view";
import { useAccount } from "@/components/account-provider";
import { Button } from "@/components/ui/button";
import { cn, safeDecodeURIComponent } from "@/lib/utils";

const navigationGroups = ["Analyse", "Werkzeuge"] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const account = useAccount();
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
          <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 21 20H3L12 3Z" /><path d="m12 8 4 8H8l4-8Z" /></svg></span>
          <span className="brand-copy"><strong>OPSUCHT</strong><small>Wirtschaft</small></span>
          <span className="brand-badge">Live</span>
        </Link>
        <nav className="sidebar-nav">
          {navigationGroups.map((group) => (
            <div className="nav-group" key={group}>
              <p className="nav-group-label">{group}</p>
              {navigationItems.filter((item) => item.group === group).map((item) => (
                <NavigationLink key={item.href} item={item} active={isActive(pathname, item.href)} />
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-account">
          <Link href="/account" className={cn("sidebar-account-link", isActive(pathname, "/account") && "active")}>
            <span><UserRound size={17} aria-hidden="true" /></span>
            <div><strong>{account.loading ? "Konto wird geladen" : account.user ? account.displayName : "Anmelden"}</strong><small>{account.user ? "Profil und Synchronisierung" : "Favoriten geräteübergreifend"}</small></div>
          </Link>
          {account.access?.role === "admin" && account.access.status === "active" ? <Link href="/admin" className={cn("sidebar-admin-link", isActive(pathname, "/admin") && "active")}><Shield size={15} />Administration</Link> : null}
        </div>
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
            <Link href="/account" className="topbar-account" aria-label={account.user ? `Konto von ${account.displayName}` : "Anmelden"}><UserRound size={17} aria-hidden="true" /><span>{account.user ? account.displayName : "Anmelden"}</span></Link>
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
            {account.access?.role === "admin" && account.access.status === "active" ? <Link href="/admin" className={cn("nav-link", isActive(pathname, "/admin") && "active")} onClick={() => setMenuOpen(false)}><span className="nav-icon"><Shield size={18} /></span><span className="nav-copy"><strong>Administration</strong><small>Konten und Cloud-Funktionen</small></span></Link> : null}
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
      <span className="nav-icon"><Icon size={18} aria-hidden="true" /></span>
      <span className="nav-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
    </Link>
  );
}
