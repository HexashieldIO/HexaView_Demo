import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Value used for sorting; omit to make the column unsortable. */
  sort?: (row: T) => number | string;
  align?: 'right' | 'left';
  width?: number | string;
}

/**
 * Sortable, searchable table. Rows render through column renderers, so tables
 * stay consistent across modules. Pass `search` to show a filter box that matches
 * the returned text.
 */
export function DataTable<T>({
  columns, rows, onRowClick, search, searchPlaceholder = 'Filter…', initialSort, pageSize = 12, toolbar, maxHeight, rowKey, empty = 'Nothing to show.',
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  search?: (row: T) => string;
  searchPlaceholder?: string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  pageSize?: number;
  toolbar?: ReactNode;
  maxHeight?: number;
  rowKey?: (row: T, i: number) => string;
  empty?: ReactNode;
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(initialSort);
  const [limit, setLimit] = useState(pageSize);

  const filtered = useMemo(() => {
    let out = rows;
    if (search && q.trim()) {
      const needle = q.trim().toLowerCase();
      out = out.filter((r) => search(r).toLowerCase().includes(needle));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sort) {
        const f = col.sort;
        out = out.slice().sort((a, b) => {
          const va = f(a);
          const vb = f(b);
          const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, q, sort, columns, search]);

  const shown = filtered.slice(0, limit);

  return (
    <div>
      {(search || toolbar) && (
        <div className="row wrap" style={{ padding: '0 18px 10px', gap: 8 }}>
          {search && (
            <label className="search" style={{ flex: '0 1 260px' }}>
              <Search size={14} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} aria-label="Filter rows" />
            </label>
          )}
          {toolbar}
          <span className="spacer" />
          <span className="muted" style={{ fontSize: 11.5 }}>
            {filtered.length.toLocaleString('en-GB')} {filtered.length === 1 ? 'row' : 'rows'}
          </span>
        </div>
      )}
      <div className="tbl-wrap" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
        <table className="tbl">
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    className={`${c.sort ? 'sortable' : ''} ${c.align === 'right' ? 'r' : ''}`}
                    style={c.width ? { width: c.width } : undefined}
                    onClick={c.sort ? () => setSort({ key: c.key, dir: active && sort?.dir === 'desc' ? 'asc' : 'desc' }) : undefined}
                    aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {c.header}
                    {active && (sort?.dir === 'asc' ? <ArrowUp size={10} style={{ marginLeft: 3 }} /> : <ArrowDown size={10} style={{ marginLeft: 3 }} />)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={rowKey ? rowKey(r, i) : i} className={onRowClick ? 'clickable' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={c.align === 'right' ? 'r' : ''}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={columns.length}>
                  <div className="empty">{empty}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > limit && (
        <div style={{ padding: '10px 18px', textAlign: 'center' }}>
          <button className="btn sm" onClick={() => setLimit((l) => l + pageSize * 2)}>
            Show more ({(filtered.length - limit).toLocaleString('en-GB')} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
