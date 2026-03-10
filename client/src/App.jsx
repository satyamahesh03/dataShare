import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import InstallPWA from './components/InstallPWA';
import Home from './pages/Home';
import TextShare from './pages/TextShare';
import FileShare from './pages/FileShare';
import ViewShare from './pages/ViewShare';
import SearchPage from './pages/SearchPage';
import PublishedPosts from './pages/PublishedPosts';
import SecureText from './pages/SecureText';
import P2PReceive from './pages/P2PReceive';
import P2PSharePage from './pages/P2PSharePage';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import './index.css';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <Router>
          <Header />
          <InstallPWA />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/text" element={<TextShare />} />
            <Route path="/file" element={<FileShare />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/posts" element={<PublishedPosts />} />
            <Route path="/secure/encrypt" element={<SecureText />} />
            <Route path="/secure/decrypt" element={<SecureText />} />
            <Route path="/p2p" element={<P2PSharePage />} />
            <Route path="/p2p/:id" element={<P2PReceive />} />
            <Route path="/share/:code" element={<ViewShare />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Footer />
        </Router>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
