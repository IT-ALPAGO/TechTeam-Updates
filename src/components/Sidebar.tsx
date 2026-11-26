import { AlpagoMark, HomeIcon, RefreshIcon } from './Icons';
import type { Health } from '../lib/api';

interface Props {
  health: Health | null;
  onRefresh: () => void;
  loading: boolean;
}

function initials(name?: string): string {
  if (!name) return 'AL';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'AL';
}

export function Sidebar({ health, onRefresh, loading }: Props) {
  const account = health?.account;

  return (
    <aside className="side">
      <div className="brand">
        <AlpagoMark className="mark" />
        <div className="wordmark">ALPAGO</div>
      </div>

      <div className="navlabel">Reporting</div>
      <nav className="nav">
        <button className="item on" type="button" aria-current="page">
          <HomeIcon />
          Overview
        </button>
      </nav>

      <div className="foot">
        <div className="user">
          <div className="av">{initials(account?.name)}</div>
          <div>
            <div className="nm">{account?.name ?? 'Portfolio'}</div>
            <div className="rl">{health?.site ?? 'Alpago Technology'}</div>
          </div>
        </div>
        <button className="signout" type="button" onClick={onRefresh} disabled={loading}>
          <RefreshIcon className={loading ? 'spin' : undefined} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </aside>
  );
}
