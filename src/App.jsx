import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './AppContext.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import Home from './pages/Home.jsx';
import CreateRoom from './pages/CreateRoom.jsx';
import JoinRoom from './pages/JoinRoom.jsx';
import Lobby from './pages/Lobby.jsx';
import Retention from './pages/Retention.jsx';
import Auction from './pages/Auction.jsx';
import FinalSquads from './pages/FinalSquads.jsx';
import SoloSetup from './pages/SoloSetup.jsx';
import Recents from './pages/Recents.jsx';
import TournamentSetup from './pages/TournamentSetup.jsx';
import Tournament from './pages/Tournament.jsx';
import HandCricket from './pages/HandCricket.jsx';
import './styles/globals.css';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateRoom />} />
          <Route path="/join" element={<JoinRoom />} />
          <Route path="/lobby/:code" element={<Lobby />} />
          <Route path="/retention/:code" element={<Retention />} />
          <Route path="/auction/:code" element={<Auction />} />
          <Route path="/final/:code" element={<FinalSquads />} />
          <Route path="/solo" element={<SoloSetup />} />
          <Route path="/solo-retention" element={<Retention />} />
          <Route path="/solo-auction" element={<Auction />} />
          <Route path="/solo-final" element={<FinalSquads />} />
          <Route path="/recents" element={<Recents />} />
          <Route path="/tournament-setup" element={<TournamentSetup />} />
          <Route path="/tournament/:id" element={<Tournament />} />
          <Route path="/hand-cricket/:tournamentId" element={<HandCricket />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </AppProvider>
  );
}
