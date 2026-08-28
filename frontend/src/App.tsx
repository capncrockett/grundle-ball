import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { GrundleBowlBetaLayout } from './components/GrundleBowlBetaLayout';
import { ThemeSelector } from './components/ThemeSelector';
import { ConstitutionPage } from './pages/ConstitutionPage';
import { MatchupsPage } from './pages/MatchupsPage';
import PlayoffsIfTodayPage from './pages/PlayoffsIfTodayPage';
import PlayoffsLivePage from './pages/PlayoffsLivePage';
import PlayoffsPage from './pages/PlayoffsPage';
import { StandingsPage } from './pages/StandingsPage';

type NavLinkProps = {
  to: string;
  label: string;
  icon: React.ReactNode;
};

function NavLink({ to, label, icon }: NavLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <Link
      to={to}
      className={`btn btn-ghost btn-sm ${isActive ? 'btn-active font-semibold' : 'opacity-80'}`}
    >
      <span className="flex items-center gap-1">
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </span>
    </Link>
  );
}

type BuildInfo = typeof __BUILD_INFO__;

const fallbackBuildInfo: BuildInfo = {
  buildAt: 'local',
  gitSha: null,
  gitRef: null,
  gitRepo: null,
  gitOwner: null,
  gitCommitMessage: null,
  gitCommitAuthor: null,
  gitPullRequestId: null,
  gitPullRequestTitle: null,
  vercelEnv: null,
  vercelRegion: null,
  vercelUrl: null,
  deploymentId: null,
  projectId: null,
};

const buildInfo: BuildInfo = typeof __BUILD_INFO__ === 'undefined' ? fallbackBuildInfo : __BUILD_INFO__;
const buildRef = buildInfo.gitRef ?? 'local';
const shortSha = buildInfo.gitSha ? buildInfo.gitSha.slice(0, 7) : 'local';
const envLabel = buildInfo.vercelEnv ?? 'development';
const releaseTag = buildRef.startsWith('release/') ? buildRef.slice('release/'.length) : null;
const repoLabel =
  buildInfo.gitOwner && buildInfo.gitRepo
    ? `${buildInfo.gitOwner}/${buildInfo.gitRepo}`
    : buildInfo.gitRepo;
const commitMessage = buildInfo.gitCommitMessage
  ? buildInfo.gitCommitMessage.length > 60
    ? `${buildInfo.gitCommitMessage.slice(0, 57)}...`
    : buildInfo.gitCommitMessage
  : null;
const prTitle = buildInfo.gitPullRequestTitle
  ? buildInfo.gitPullRequestTitle.length > 50
    ? `${buildInfo.gitPullRequestTitle.slice(0, 47)}...`
    : buildInfo.gitPullRequestTitle
  : null;
const prLabel = buildInfo.gitPullRequestId
  ? `#${buildInfo.gitPullRequestId}${prTitle ? ` ${prTitle}` : ''}`
  : null;
const deploymentLabel = buildInfo.deploymentId ? buildInfo.deploymentId.slice(0, 8) : null;
const projectLabel = buildInfo.projectId ? buildInfo.projectId.slice(0, 8) : null;
const buildMetaItems = [
  { label: 'App', value: 'Grundle Ball' },
  { label: 'Env', value: envLabel },
  { label: releaseTag ? 'Release' : 'Branch', value: releaseTag ?? buildRef },
  { label: 'SHA', value: shortSha },
  { label: 'Built', value: buildInfo.buildAt },
  { label: 'Region', value: buildInfo.vercelRegion },
  { label: 'URL', value: buildInfo.vercelUrl },
  { label: 'Repo', value: repoLabel },
  { label: 'Author', value: buildInfo.gitCommitAuthor },
  { label: 'Message', value: commitMessage },
  { label: 'PR', value: prLabel },
  { label: 'Deploy', value: deploymentLabel },
  { label: 'Project', value: projectLabel },
].filter((item): item is { label: string; value: string } => Boolean(item.value));

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-base-200 text-base-content">
      <header className="navbar bg-base-100 shadow-md">
        <div className="navbar-start">
          <span className="btn btn-ghost normal-case text-sm sm:text-xl font-bold">Grundle Ball</span>
        </div>
        <div className="navbar-center">
          <nav className="flex gap-1 sm:gap-2">
            <NavLink
              to="/standings"
              label="Standings"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              }
            />
            <NavLink
              to="/playoffs"
              label="Playoffs"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
              }
            />
            <NavLink
              to="/matchups"
              label="Matchups"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              }
            />
            <NavLink
              to="/constitution"
              label="Constitution"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              }
            />
            <NavLink
              to="/beta/grundle-bowl"
              label="Grundle Bowl"
              icon={
                <span className="w-4 h-4 flex items-center justify-center text-[0.6rem] font-bold rounded-full bg-warning/20 text-warning">
                  β
                </span>
              }
            />
          </nav>
        </div>
        <div className="navbar-end">
          <ThemeSelector />
        </div>
      </header>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Navigate to="/standings" replace />} />
          <Route path="/standings" element={<StandingsPage />} />
          <Route path="/playoffs" element={<PlayoffsPage />} />
          <Route path="/matchups" element={<MatchupsPage />} />
          <Route path="/constitution" element={<ConstitutionPage />} />
          <Route path="/beta/grundle-bowl" element={<Navigate to="/beta/grundle-bowl/live" replace />} />
          <Route
            path="/beta/grundle-bowl/live"
            element={
              <GrundleBowlBetaLayout>
                <PlayoffsLivePage />
              </GrundleBowlBetaLayout>
            }
          />
          <Route
            path="/beta/grundle-bowl/if-today"
            element={
              <GrundleBowlBetaLayout>
                <PlayoffsIfTodayPage />
              </GrundleBowlBetaLayout>
            }
          />
          {/* Legacy links redirect to their new Beta home */}
          <Route path="/playoffs/live" element={<Navigate to="/beta/grundle-bowl/live" replace />} />
          <Route path="/playoffs/if-today" element={<Navigate to="/beta/grundle-bowl/if-today" replace />} />
        </Routes>
      </main>

      <footer className="p-4 mt-24 bg-base-100 text-xs opacity-70">
        <div className="w-full grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-4 gap-y-1">
          {buildMetaItems.map((item) => (
            <span key={`${item.label}:${item.value}`}>
              {item.label}: {item.value}
            </span>
          ))}
        </div>
      </footer>
      <SpeedInsights />
    </div>
  );
}
