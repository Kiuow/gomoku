import React from 'react';
import { Route, Routes } from 'react-router-dom';

import HomePage from './pages/Home/HomePage';
import RoomPage from './pages/Room/RoomPage';
import SoloPage from './pages/Solo/SoloPage';
import SoloSetupPage from './pages/Solo/SoloSetupPage';
import KifuListPage from './pages/Kifu/KifuListPage';
import KifuReplayPage from './pages/Kifu/KifuReplayPage';
import PracticePage from './pages/Practice/PracticePage';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="room/:roomCode" element={<RoomPage />} />
        <Route path="solo" element={<SoloSetupPage />} />
        <Route path="solo/:roomCode" element={<SoloPage />} />
        <Route path="kifu" element={<KifuListPage />} />
        <Route path="kifu/:kifuId" element={<KifuReplayPage />} />
        <Route path="practice" element={<PracticePage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
