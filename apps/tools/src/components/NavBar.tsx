import { NavLink } from 'react-router-dom';

const links = [
  { to: '/stations', label: 'Stations' },
  { to: '/segments', label: 'Segments' },
  { to: '/assembly', label: 'Assembly' },
];

export function NavBar() {
  return (
    <nav className="flex items-center gap-6 px-4 py-3 border-b border-onay-border bg-onay-card">
      <span className="text-sm font-semibold text-onay-gold tracking-wider uppercase">
        Onay Tools
      </span>
      <div className="flex gap-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `px-3 py-1.5 text-sm rounded ${
                isActive
                  ? 'bg-onay-gold/20 text-onay-gold border border-onay-gold/40'
                  : 'text-onay-muted hover:text-onay-text'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
