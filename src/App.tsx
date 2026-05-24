import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Atmosphere from './components/Atmosphere';
import RouteTransition from './components/RouteTransition';
import HomePage from './pages/Home';
import ImportPage from './pages/Import';
import CharactersPage from './pages/Characters';
import CharacterEditPage from './pages/Characters/Edit';
import ChatPage from './pages/Chat';
import TimelinePage from './pages/Timeline';
import WhatIfPage from './pages/WhatIf';
import SettingsPage from './pages/Settings';
import OnboardingPage from './pages/Onboarding';
import GroupsPage from './pages/Groups';
import GroupChatPage from './pages/Groups/GroupChat';
import NotFoundPage from './pages/NotFound';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <RouteTransition>
      <Routes location={location}>
        <Route path="/" element={<HomePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/characters" element={<CharactersPage />} />
        <Route path="/characters/:id/edit" element={<CharacterEditPage />} />
        <Route path="/characters/:id/chat" element={<ChatPage />} />
        <Route path="/characters/:id/timeline" element={<TimelinePage />} />
        <Route path="/characters/:id/whatif" element={<WhatIfPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/:id" element={<GroupChatPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </RouteTransition>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Atmosphere />
      <AnimatedRoutes />
    </BrowserRouter>
  );
}

export default App;
