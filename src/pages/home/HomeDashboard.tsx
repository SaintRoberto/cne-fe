import { DASHBOARD_REPORT_URL } from '../../config/env';

export function HomeDashboard() {
  return (
    <div className="home-dashboard">
      <iframe className="home-dashboard__iframe" title="Dashboard CNE" src={DASHBOARD_REPORT_URL} />
    </div>
  );
}
