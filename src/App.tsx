import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
