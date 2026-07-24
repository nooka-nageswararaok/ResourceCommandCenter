import packageJson from '../../package.json';

const appVersion = packageJson.version || '1.0.0';

export default function MainLayout({
  modules,
  activeRouteKey,
  activeModuleKey,
  sidebarCollapsed,
  onToggleSidebar,
  onNavigate,
  children
}) {
  return (
    <div className={`workspace ${sidebarCollapsed ? 'nav-collapsed' : ''}`}>
      <nav className="side-nav">
        <button
          className="nav-toggle"
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {sidebarCollapsed ? '>' : '<'}
          <span>{sidebarCollapsed ? '' : 'Collapse'}</span>
        </button>

        {modules.map((module) => {
          const isActiveModule = activeModuleKey === module.key;
          const firstChild = module.children[0];

          return (
            <div className="module-group" key={module.key}>
              <button
                className={`module-button ${isActiveModule ? 'active' : ''}`}
                type="button"
                onClick={() => onNavigate(firstChild.key)}
                title={module.label}
              >
                <b>{module.label.charAt(0)}</b>
                <span>{module.label}</span>
              </button>

              {isActiveModule && module.children.length > 1 && (
                <div className="sub-nav">
                  {module.children.map((route) => (
                    <button
                      key={route.key}
                      className={activeRouteKey === route.key ? 'active' : ''}
                      type="button"
                      onClick={() => onNavigate(route.key)}
                      title={route.label}
                    >
                      <b>{route.label.charAt(0)}</b>
                      <span>{route.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="nav-version" title={`App version ${appVersion}`}>
          <span>Version {appVersion}</span>
          <b>v{appVersion}</b>
        </div>
      </nav>

      <section className="content">{children}</section>
    </div>
  );
}
