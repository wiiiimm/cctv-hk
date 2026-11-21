import { useEffect, useRef, useState } from "react";
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
  const member = groups.filter((g) => g.keys.includes(chKey)).length;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <span className="group-menu-wrap" ref={ref}>
      <IconButton icon={<GroupsIcon />} label={t.addToGroup} on={member > 0} onPress={() => setOpen((v) => !v)} />
      {open && (
        <div className="group-menu" role="dialog" aria-label={t.addToGroup}>
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
        </div>
      )}
    </span>
  );
}
