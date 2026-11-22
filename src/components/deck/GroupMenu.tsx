import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { actions, useStore } from "../../lib/store";
import { useT } from "../../lib/i18n";
import { IconButton } from "../PinButtons";
import { GroupsIcon } from "../icons";

/** "Add to my groups": tick the user's groups this camera belongs to, or start a new group with it. */
export function GroupMenu({ chKey }: { chKey: string }) {
  const t = useT();
  const groups = useStore((s) => s.customGroups);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  const member = groups.filter((g) => g.keys.includes(chKey)).length;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node) && setOpen(false);
    // A fixed-position menu would drift if its button scrolled or the window resized: just close it.
    const dismiss = (e: Event) => !menuRef.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  // Place the menu against the viewport (it is portalled out of the scrolling panel): below the button, or above
  // it when there isn't room, and clamped inside the window edges.
  useLayoutEffect(() => {
    if (!open) return setPos(null);
    const btn = ref.current?.getBoundingClientRect();
    const menu = menuRef.current?.getBoundingClientRect();
    if (!btn || !menu) return;
    const m = 8;
    const left = Math.min(Math.max(m, btn.right - menu.width), window.innerWidth - menu.width - m);
    // Open on the side with more room; if the list is taller than that, it scrolls inside the menu.
    const spaceBelow = window.innerHeight - btn.bottom - 6 - m;
    const spaceAbove = btn.top - 6 - m;
    const downward = spaceBelow >= menu.height || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(120, downward ? spaceBelow : spaceAbove);
    const height = Math.min(menu.height, maxHeight);
    setPos({ left, top: downward ? btn.bottom + 6 : btn.top - 6 - height, maxHeight });
  }, [open, groups.length]);

  return (
    <span className="group-menu-wrap" ref={ref}>
      <IconButton icon={<GroupsIcon />} label={t.addToGroup} on={member > 0} onPress={() => setOpen((v) => !v)} />
      {open &&
        createPortal(
        <div
          ref={menuRef}
          className="group-menu"
          role="dialog"
          aria-label={t.addToGroup}
          style={{ position: "fixed", left: pos?.left ?? -9999, top: pos?.top ?? -9999, right: "auto", maxHeight: pos?.maxHeight, overflowY: "auto" }}
        >
          <div className="group-menu-title">{t.addToGroup}</div>
          {groups.map((g) => (
            <label key={g.id} className="group-menu-row">
              <input type="checkbox" checked={g.keys.includes(chKey)} onChange={() => actions.toggleInGroup(g.id, chKey)} />
              <span>{g.name}</span>
              <span className="count">{g.keys.length}</span>
            </label>
          ))}
          <form
            className="group-menu-new"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              actions.createGroup(draft, chKey);
              setDraft("");
            }}
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.newGroup} aria-label={t.newGroup} />
            <button type="submit" className="btn">
              {t.create}
            </button>
          </form>
        </div>,
          document.body,
        )}
    </span>
  );
}
