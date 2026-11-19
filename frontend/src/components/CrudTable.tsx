// Generic editable table for setup data. Columns describe how each field is edited.
import { Fragment, useState } from "react";
import { api } from "../api";
import { DAY_NAMES, useApp } from "../data";

export interface Column {
  key: string;
  label: string;
  type?: "text" | "number" | "bool" | "select" | "date" | "weekday" | "weekdays" | "multiselect" | "json";
  options?: { value: string | number; label: string }[];
  default?: unknown;
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function display(col: Column, value: any): string { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (value === null || value === undefined || value === "") return "-";
  switch (col.type) {
    case "bool": return value ? "Yes" : "No";
    case "select": return col.options?.find((o) => o.value === value)?.label ?? String(value);
    case "weekday": return DAY_NAMES[value] ?? "-";
    case "weekdays": return (value as number[]).map((d) => DAY_NAMES[d]).join(", ");
    case "multiselect": return (value as number[]).map((v) => col.options?.find((o) => o.value === v)?.label ?? v).join(", ");
    case "json": return JSON.stringify(value);
    default: return String(value);
  }
}

function Editor({ col, value, onChange }: { col: Column; value: any; onChange: (v: any) => void }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  switch (col.type) {
    case "bool":
      return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
    case "number":
      return <input className="input w-16" type="number" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} />;
    case "date":
      return <input className="input" type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <select className="input" value={value ?? ""} onChange={(e) => {
          const opt = col.options?.find((o) => String(o.value) === e.target.value);
          onChange(opt ? opt.value : null);
        }}>
          <option value="">-</option>
          {col.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case "weekday":
      return (
        <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}>
          <option value="">none</option>
          {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
      );
    case "weekdays":
    case "multiselect": {
      const opts = col.type === "weekdays" ? DAY_NAMES.map((d, i) => ({ value: i, label: d })) : col.options ?? [];
      const list: (string | number)[] = value ?? [];
      return (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {opts.map((o) => (
            <label key={o.value} className="text-xs whitespace-nowrap">
              <input type="checkbox" checked={list.includes(o.value)}
                onChange={() => onChange(list.includes(o.value) ? list.filter((x) => x !== o.value) : [...list, o.value])} />
              {o.label}
            </label>
          ))}
        </div>
      );
    }
    case "json":
      return <JsonEditor value={value} onChange={onChange} />;
    default:
      return <input className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

function JsonEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(JSON.stringify(value ?? {}));
  const [bad, setBad] = useState(false);
  return (
    <input className={`input w-48 text-xs ${bad ? "border-danger" : ""}`} value={text}
      onChange={(e) => {
        setText(e.target.value);
        try { onChange(JSON.parse(e.target.value)); setBad(false); } catch { setBad(true); }
      }} />
  );
}

interface Props {
  table: string; // API path, e.g. "employees"
  rows: Row[];
  columns: Column[];
  help?: string;
}

export default function CrudTable({ table, rows, columns, help }: Props) {
  const { reload } = useApp();
  const [editing, setEditing] = useState<Row | null>(null); // row being edited (id undefined = new)
  const [error, setError] = useState("");

  const blank = () => Object.fromEntries(columns.map((c) => [c.key, c.default ?? null]));

  async function save() {
    if (!editing) return;
    setError("");
    try {
      if (editing.id) await api.update(table, editing.id, editing);
      else await api.create(table, editing);
      setEditing(null);
      await reload();
    } catch (e) {
      setError(String(e));
    }
  }

  async function remove(row: Row) {
    if (!confirm("Delete this row? Related assignments are removed too.")) return;
    await api.remove(table, row.id);
    await reload();
  }

  const editorRow = (
    <tr className="bg-warnSoft">
      {columns.map((c) => (
        <td key={c.key} className="p-1 align-top">
          <Editor col={c} value={editing?.[c.key]} onChange={(v) => setEditing({ ...editing, [c.key]: v })} />
        </td>
      ))}
      <td className="p-1 whitespace-nowrap">
        <button className="btn !py-0.5 mr-1" onClick={save}>Save</button>
        <button className="btn-light !py-0.5" onClick={() => setEditing(null)}>Cancel</button>
      </td>
    </tr>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button className="btn" onClick={() => setEditing(blank())}>Add row</button>
        {help && <p className="hint">{help}</p>}
      </div>
      {error && <p className="text-sm text-danger">Couldn't save: {error}</p>}
      <div className="overflow-x-auto">
        <table className="text-sm w-full">
          <thead>
            <tr className="text-left border-b border-line text-muted">
              {columns.map((c) => <th key={c.key} className="px-2 py-1.5 font-semibold">{c.label}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {editing && !editing.id && editorRow}
            {rows.map((row) =>
              editing?.id === row.id ? <Fragment key={row.id}>{editorRow}</Fragment> : (
                <tr key={row.id} className="border-b border-line/60 hover:bg-canvas">
                  {columns.map((c) => <td key={c.key} className="px-2 py-1">{display(c, row[c.key])}</td>)}
                  <td className="p-1 whitespace-nowrap text-right">
                    <button className="text-accent mr-3 hover:underline" onClick={() => setEditing({ ...row })}>Edit</button>
                    <button className="text-danger hover:underline" onClick={() => remove(row)}>Delete</button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
